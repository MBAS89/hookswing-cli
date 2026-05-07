const WebSocket = require('ws');
const axios = require('axios');
const chalk = require('chalk');
const { readConfig } = require('../lib/config');
const { formatWebhookLine } = require('../lib/formatter');

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
    const project = projects.data.projects.find((p) => p.slug === slug);
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

  const ws = new WebSocket(`${wsUrl}/ws?token=${config.accessToken}`);

  ws.on('open', () => {
    ws.send(JSON.stringify({ action: 'subscribe', slug }));
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type !== 'webhook' || !msg.data) return;

      const webhook = msg.data;
      total++;

      try {
        const start = Date.now();

        // Sanitize headers — remove hop-by-hop and length headers
        const headers = { ...webhook.headers };
        delete headers['content-length'];
        delete headers['transfer-encoding'];
        delete headers['connection'];
        delete headers['host'];
        delete headers['expect'];
        delete headers['keep-alive'];

        // Use rawBody when available (preserves exact bytes for signature verification)
        // Fall back to parsed body for older webhooks or non-JSON payloads
        let body = webhook.rawBody || webhook.body;
        if (!webhook.rawBody && body && typeof body === 'object') {
          body = JSON.stringify(body);
          headers['content-type'] = headers['content-type'] || 'application/json';
        }

        const res = await axios({
          method: webhook.method,
          url: localUrl,
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

  ws.on('error', (err) => {
    console.error(chalk.red('WebSocket error:'), err.message);
  });

  process.on('SIGINT', () => {
    console.log();
    console.log(chalk.gray(`Requests: ${total}  │  Success: ${success}  │  Failed: ${failed}`));
    ws.close();
    process.exit(0);
  });
}

module.exports = forward;
