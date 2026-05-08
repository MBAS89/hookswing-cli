const WebSocket = require('ws');
const axios = require('axios');
const chalk = require('chalk');
const { readConfig, writeConfig, clearConfig } = require('../lib/config');
const { formatWebhookLine } = require('../lib/formatter');

async function refreshToken() {
  const config = readConfig();
  if (!config?.refreshToken) return null;

  try {
    const res = await axios.post(`${config.apiUrl}/api/auth/refresh`, {
      refreshToken: config.refreshToken,
    });

    writeConfig({
      apiUrl: config.apiUrl,
      accessToken: res.data.accessToken,
      refreshToken: config.refreshToken,
    });

    return res.data.accessToken;
  } catch {
    return null;
  }
}

async function forward(slug, localUrl, options) {
  const config = readConfig();
  if (!config?.accessToken) {
    console.error(chalk.red('Not authenticated. Run: hookswing login'));
    process.exit(1);
  }

  const apiUrl = config.apiUrl || 'https://hookswing.com';
  const wsUrl = apiUrl.replace(/^http/, 'ws');

  // Get project info
  let projectName = slug;
  try {
    const projects = await axios.get(`${apiUrl}/api/projects`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    const project = projects.data.projects.find((p) => p.slug === slug || p.customSlug === slug);
    if (project) projectName = project.name;
  } catch {
    // ignore
  }

  console.log(chalk.cyan('🪝 HookSwing Forwarder'));
  console.log(chalk.gray(`   Project: ${projectName} (${slug})`));
  console.log(chalk.gray(`   Target:  ${localUrl}`));
  console.log();
  console.log(chalk.gray('   [Press Ctrl+C to stop]'));
  console.log();

  let total = 0;
  let success = 0;
  let failed = 0;
  let reconnectAttempts = 0;
  let authRetries = 0;
  let isConnected = false;
  const maxAuthRetries = 3;
  let ws = null;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let heartbeatTimeout = null;
  let shuttingDown = false;
  let silentReconnect = false;

  function clearTimers() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (heartbeatTimeout) { clearTimeout(heartbeatTimeout); heartbeatTimeout = null; }
  }

  function startHeartbeat() {
    clearTimers();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ action: 'heartbeat' }));
        heartbeatTimeout = setTimeout(() => {
          if (process.env.HOOKSWING_DEBUG) {
            console.log(chalk.yellow('\n[DEBUG] Heartbeat timeout — forcing reconnect'));
          }
          ws.terminate();
        }, 10000);
      }
    }, 20000);
  }

  function connect(token) {
    if (shuttingDown) return;

    const cfg = readConfig();
    const connectToken = token || cfg?.accessToken;

    if (!connectToken) {
      console.error(chalk.red('\nAuthentication lost. Run: hookswing login'));
      process.exit(1);
    }

    const wsUrlWithToken = `${wsUrl}/ws?token=${encodeURIComponent(connectToken)}`;

    if (process.env.HOOKSWING_DEBUG) {
      console.log(chalk.gray(`[DEBUG] Connecting to: ${wsUrl}/ws?token=***`));
    }

    ws = new WebSocket(wsUrlWithToken);

    ws.on('open', () => {
      reconnectAttempts = 0;
      authRetries = 0;
      isConnected = true;

      if (silentReconnect) {
        // Briefly show we're back, then resume silent operation
        process.stdout.write(chalk.green('\r✓ Back online          \n'));
        silentReconnect = false;
      } else if (!isConnected) {
        console.log(chalk.green('✓ Connected'));
      }

      ws.send(JSON.stringify({ action: 'subscribe', slug }));
      startHeartbeat();
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'heartbeat') {
          if (heartbeatTimeout) {
            clearTimeout(heartbeatTimeout);
            heartbeatTimeout = null;
          }
          return;
        }

        if (msg.type !== 'webhook' || !msg.data) return;

        const webhook = msg.data;
        total++;

        try {
          const start = Date.now();

          const headers = { ...webhook.headers };
          delete headers['content-length'];
          delete headers['transfer-encoding'];
          delete headers['connection'];
          delete headers['host'];
          delete headers['expect'];
          delete headers['keep-alive'];

          let body = webhook.rawBody || webhook.body;
          if (!webhook.rawBody && body && typeof body === 'object') {
            body = JSON.stringify(body);
            headers['content-type'] = headers['content-type'] || 'application/json';
          }

          const res = await axios({
            method: webhook.method,
            url: localUrl.replace(/\/$/, '') + (webhook.path || ''),
            headers,
            data: body,
            timeout: 30000,
            validateStatus: () => true,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          });
          const responseTime = Date.now() - start;

          webhook.statusCode = res.status;
          webhook.responseTime = responseTime;

          if (res.status >= 200 && res.status < 300) success++;
          else failed++;
        } catch (err) {
          webhook.statusCode = 0;
          webhook.responseTime = 0;
          failed++;
        }

        if (!options.quiet) {
          console.log(formatWebhookLine(webhook, options.verbose));
        } else if (failed > 0 && webhook.statusCode >= 500) {
          console.log(formatWebhookLine(webhook, false));
        }

        if (total === 50) {
          console.log();
          console.log(chalk.yellow('💡 Unlock 90-day history and replay at hookswing.io'));
        }
      } catch {
        // ignore invalid messages
      }
    });

    ws.on('unexpected-response', (req, res) => {
      if (process.env.HOOKSWING_DEBUG) {
        console.error(chalk.red(`[DEBUG] HTTP ${res.statusCode} during WebSocket upgrade: ${res.statusMessage}`));
      }
    });

    ws.on('error', (err) => {
      if (process.env.HOOKSWING_DEBUG) {
        console.error(chalk.red('\n[DEBUG] WebSocket error:'), err.message);
      }
    });

    ws.on('close', async (code, reason) => {
      if (shuttingDown) return;
      clearTimers();
      isConnected = false;

      const reasonStr = reason?.toString() || '';

      if (process.env.HOOKSWING_DEBUG) {
        console.log(chalk.gray(`[DEBUG] WebSocket closed — code: ${code}, reason: "${reasonStr}"`));
      }

      // 1008 = Policy Violation — server explicitly rejected us (auth)
      if (code === 1008) {
        authRetries++;
        if (authRetries > maxAuthRetries) {
          console.error(chalk.red('\nAuthentication failed after 3 attempts. Run: hookswing login'));
          clearConfig();
          process.exit(1);
        }

        console.log(chalk.yellow(`\n⚠ Session expired. Refreshing... (attempt ${authRetries}/${maxAuthRetries})`));
        const newToken = await refreshToken();
        if (!newToken) {
          console.error(chalk.red('\nToken refresh failed. Run: hookswing login'));
          clearConfig();
          process.exit(1);
        }
        silentReconnect = true;
        reconnectTimer = setTimeout(() => connect(newToken), 500);
        return;
      }

      // 1006 and others = network blip. Reconnect silently.
      reconnectAttempts++;
      const delay = Math.min(500 * Math.pow(2, Math.min(reconnectAttempts - 1, 5)), 15000);

      if (reconnectAttempts === 1) {
        // First disconnect — try immediately, show nothing
        silentReconnect = true;
        reconnectTimer = setTimeout(() => connect(), 500);
      } else if (reconnectAttempts <= 3) {
        // Brief disconnects — still silent, short backoff
        silentReconnect = true;
        reconnectTimer = setTimeout(() => connect(), delay);
      } else {
        // Persistent issue — show a subtle message
        silentReconnect = false;
        process.stdout.write(chalk.gray(`\rReconnecting${'.'.repeat(reconnectAttempts % 4)}              `));
        reconnectTimer = setTimeout(() => {
          silentReconnect = true;
          connect();
        }, delay);
      }
    });
  }

  // Start connection
  connect();

  // Keep process alive
  const keepAlive = setInterval(() => {}, 60000);

  process.on('SIGINT', () => {
    shuttingDown = true;
    clearTimers();
    clearInterval(keepAlive);
    console.log();
    console.log(chalk.gray(`Requests: ${total}  │  Success: ${success}  │  Failed: ${failed}`));
    if (ws) ws.close();
    process.exit(0);
  });
}

module.exports = forward;
