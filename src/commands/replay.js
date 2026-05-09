const axios = require('axios');
const chalk = require('chalk');
const { readConfig } = require('../lib/config');
const { normalizeUrl } = require('../lib/normalize-url');

async function replay(webhookId, rawUrl) {
  const localUrl = normalizeUrl(rawUrl);
  const config = readConfig();
  if (!config?.accessToken) {
    console.error(chalk.red('Not authenticated. Run: hookswing login'));
    process.exit(1);
  }

  const apiUrl = config.apiUrl || 'https://hookswing.com';

  console.log(chalk.cyan(`↻ Replaying webhook ${webhookId}`));
  if (rawUrl !== localUrl) {
    console.log(chalk.gray(`  (normalized from "${rawUrl}" → ${localUrl})`));
  }

  try {
    const res = await axios.post(
      `${apiUrl}/api/webhooks/${webhookId}/replay`,
      { targetUrl: localUrl },
      { headers: { Authorization: `Bearer ${config.accessToken}` } }
    );

    const { status, responseTime } = res.data;
    const color = status >= 200 && status < 300 ? chalk.green : chalk.red;
    console.log(color(`  Response: ${status} OK in ${responseTime}ms`));
  } catch (err) {
    console.error(chalk.red('Replay failed:'), err.response?.data?.error || err.message);
    process.exit(1);
  }
}

module.exports = replay;
