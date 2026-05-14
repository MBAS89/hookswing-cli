const inquirer = require('inquirer');
const chalk = require('chalk');
const http = require('http');
const { URL } = require('url');
const { writeConfig } = require('../lib/config');
const { getApi } = require('../lib/api');

async function oauthLogin(provider, baseURL) {
  const server = http.createServer();
  let serverResolved = false;

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const port = (server.address() || {}).port;
  if (!port) {
    console.error(chalk.red('Failed to start local callback server'));
    process.exit(1);
  }

  const authUrl = `${baseURL}/api/auth/${provider}?mode=cli&callback_port=${port}`;
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  console.log(chalk.cyan(`🔗 ${providerName} OAuth Login`));
  console.log('');
  console.log(chalk.gray('Opening browser...'));
  console.log('');

  // Try to open browser automatically
  try {
    const { exec } = require('child_process');
    const platform = process.platform;
    if (platform === 'darwin') exec(`open "${authUrl}"`);
    else if (platform === 'win32') exec(`start "" "${authUrl}"`);
    else exec(`xdg-open "${authUrl}"`);
  } catch {
    console.log(chalk.yellow('Could not open browser automatically.'));
    console.log(chalk.white('Please open this URL manually:'));
    console.log(chalk.underline(authUrl));
  }

  // Wait for the callback
  const tokens = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!serverResolved) {
        server.close();
        reject(new Error('Login timed out. Please try again.'));
      }
    }, 120000); // 2 minute timeout

    server.on('request', (req, res) => {
      if (serverResolved) return;

      const url = new URL(req.url || '/', `http://localhost:${port}`);
      const accessToken = url.searchParams.get('accessToken');
      const refreshToken = url.searchParams.get('refreshToken');

      if (accessToken && refreshToken) {
        serverResolved = true;
        clearTimeout(timeout);

        // Show success page in browser
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html>
<head><title>HookSwing CLI — Login Success</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.container{max-width:480px;text-align:center;padding:32px;background:#1e293b;border:1px solid #334155;border-radius:16px}
.icon{font-size:48px;margin-bottom:16px}
h1{font-size:22px;margin-bottom:8px;color:#fff}
p{color:#94a3b8;font-size:14px;line-height:1.5}
</style>
</head>
<body>
<div class="container">
<div class="icon">✅</div>
<h1>Login Successful</h1>
<p>You can close this window and return to your terminal.</p>
</div>
</body>
</html>`);

        server.close();
        resolve({ accessToken, refreshToken });
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Invalid callback</h1><p>Missing tokens. Please try again.</p>');
      }
    });
  });

  return tokens;
}

async function login(options = {}) {
  // --- OAuth login (GitHub or Google) ---
  if (options.github || options.google) {
    const api = getApi();
    const baseURL = api.defaults.baseURL.replace('/api', '');
    const provider = options.github ? 'github' : 'google';

    const tokens = await oauthLogin(provider, baseURL);

    writeConfig({
      apiUrl: baseURL,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });

    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
    console.log(chalk.green(`✓ Authenticated with ${providerName}`));
    return;
  }

  // --- Email/Password login ---
  const answers = await inquirer.prompt([
    { type: 'input', name: 'email', message: 'Email:' },
    { type: 'password', name: 'password', message: 'Password:' },
  ]);

  try {
    const api = getApi();
    const res = await api.post('/auth/login', {
      email: answers.email,
      password: answers.password,
    });

    const baseURL = api.defaults.baseURL.replace('/api', '');

    // Debug: show raw response if user is having issues
    if (process.env.HOOKSWING_DEBUG) {
      console.log(chalk.gray('[DEBUG] Response:'), JSON.stringify(res.data, null, 2));
    }

    // Handle email verification required
    if (res.data.requiresEmailVerification) {
      console.log(chalk.yellow('⚠ Email not verified.'));
      console.log(chalk.gray(`   We sent a verification code to ${res.data.email}`));
      console.log(chalk.gray('   Please verify your email on the web dashboard before using the CLI.'));
      process.exit(1);
    }

    // Handle 2FA required
    if (res.data.requires2FA) {
      const { code } = await inquirer.prompt([
        { type: 'input', name: 'code', message: '2FA Code:' },
      ]);

      const verifyRes = await api.post('/auth/login/2fa', {
        tempToken: res.data.tempToken,
        code,
      });

      writeConfig({
        apiUrl: baseURL,
        accessToken: verifyRes.data.accessToken,
        refreshToken: verifyRes.data.refreshToken,
      });

      console.log(chalk.green(`✓ Authenticated as ${answers.email}`));
      return;
    }

    // Normal login success
    if (!res.data.accessToken) {
      console.error(chalk.red('Authentication failed: Unexpected response from server'));
      console.error(chalk.gray('Response:'), JSON.stringify(res.data, null, 2));
      console.error(chalk.gray('\nTry running with HOOKSWING_DEBUG=1 for more details.'));
      process.exit(1);
    }

    writeConfig({
      apiUrl: baseURL,
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
    });

    const displayEmail = res.data.user?.email || answers.email;
    console.log(chalk.green(`✓ Authenticated as ${displayEmail}`));
  } catch (err) {
    if (err.response) {
      console.error(chalk.red('Authentication failed:'), err.response.data?.error || `HTTP ${err.response.status}`);
      if (process.env.HOOKSWING_DEBUG) {
        console.error(chalk.gray('[DEBUG] Status:'), err.response.status);
        console.error(chalk.gray('[DEBUG] Body:'), JSON.stringify(err.response.data, null, 2));
      }
    } else {
      console.error(chalk.red('Authentication failed:'), err.message);
    }
    process.exit(1);
  }
}

module.exports = login;
