const chalk = require('chalk');
const { getApi } = require('../lib/api');

async function list() {
  try {
    const api = getApi();
    const res = await api.get('/projects');
    const projects = res.data.projects;

    console.log(chalk.white('Your Projects:'));
    for (const p of projects) {
      const count = p._count?.webhooks || 0;
      console.log(`  ${chalk.cyan(p.slug)}  ${p.name.padEnd(20)}  ${count} webhooks`);
    }
  } catch (err) {
    console.error(chalk.red('Failed to list projects:'), err.response?.data?.error || err.message);
    process.exit(1);
  }
}

module.exports = list;
