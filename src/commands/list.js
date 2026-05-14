const chalk = require('chalk');
const { getApi } = require('../lib/api');

async function list() {
  try {
    const api = getApi();
    const res = await api.get('/projects');
    const projects = res.data.projects;

    if (!projects || projects.length === 0) {
      console.log(chalk.yellow('No projects found. Create one at https://hookswing.com/dashboard'));
      return;
    }

    console.log(chalk.white('Your Projects:'));
    console.log();

    for (const p of projects) {
      const count = p._count?.webhooks || 0;
      const slugLabel = chalk.cyan(p.slug);
      const customLabel = p.customSlug ? chalk.cyan(p.customSlug) : null;
      const teamLabel = p.team ? chalk.gray(`[${p.team.name}]`) : '';

      let line = `  ${slugLabel}`;
      if (customLabel) {
        line += `  /  ${customLabel}`;
      }
      line += `  ${p.name.padEnd(20)}  ${count} webhooks  ${teamLabel}`;

      console.log(line);
    }
  } catch (err) {
    if (err.response?.status === 401) {
      console.error(chalk.red('Authentication expired. Run: hookswing login'));
    } else {
      console.error(chalk.red('Failed to list projects:'), err.response?.data?.error || err.message);
    }
    process.exit(1);
  }
}

module.exports = list;
