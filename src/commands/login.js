const inquirer = require('inquirer');
const chalk = require('chalk');
const { writeConfig } = require('../lib/config');
const { getApi } = require('../lib/api');

async function login() {
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
