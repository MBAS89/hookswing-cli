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

    writeConfig({
      apiUrl: baseURL,
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
    });

    console.log(chalk.green(`✓ Authenticated as ${res.data.user.email}`));
  } catch (err) {
    console.error(chalk.red('Authentication failed:'), err.response?.data?.error || err.message);
    process.exit(1);
  }
}

module.exports = login;
