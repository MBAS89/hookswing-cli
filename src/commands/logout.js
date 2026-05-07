const chalk = require('chalk');
const { clearConfig } = require('../lib/config');

function logout() {
  clearConfig();
  console.log(chalk.green('✓ Logged out. Credentials removed.'));
}

module.exports = logout;
