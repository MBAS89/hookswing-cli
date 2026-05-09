const axios = require('axios');
const chalk = require('chalk');
const { readConfig } = require('../lib/config');
const { normalizeUrl } = require('../lib/normalize-url');

const providers = [
  'stripe', 'github', 'paypal', 'shopify', 'twilio',
  'slack', 'discord', 'microsoft_teams', 'sendgrid', 'mailgun',
  'zoom', 'calendly', 'typeform', 'google', 'square', 'generic',
];

async function test(provider, eventType, rawUrl) {
  const targetUrl = normalizeUrl(rawUrl);
  const config = readConfig();
  if (!config?.accessToken) {
    console.error(chalk.red('Not authenticated. Run: hookswing login'));
    process.exit(1);
  }

  if (!provider || !eventType || !targetUrl) {
    console.error(chalk.red('Usage: hookswing test <provider> <event-type> <target-url>'));
    console.log(chalk.gray('  Example: hookswing test stripe invoice.payment_succeeded https://hookswing.com/hook/abc123'));
    console.log(chalk.gray('  Providers: ' + providers.join(', ')));
    process.exit(1);
  }

  if (!providers.includes(provider)) {
    console.error(chalk.red(`Unknown provider: ${provider}`));
    console.log(chalk.gray('  Available: ' + providers.join(', ')));
    process.exit(1);
  }

  const apiUrl = config.apiUrl || 'https://hookswing.com';

  try {
    console.log(chalk.gray(`Sending ${chalk.white(provider)}/${chalk.white(eventType)} → ${targetUrl}...`));
  if (rawUrl !== targetUrl) {
    console.log(chalk.gray(`  (normalized from "${rawUrl}")`));
  }

    const res = await axios.post(`${apiUrl}/api/tester/send`, {
      targetUrl,
      provider,
      eventType,
    }, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
      timeout: 30000,
    });

    const { response, responseTime, source, error } = res.data;

    if (error && !response) {
      console.error(chalk.red(`✗ ${error}`));
      process.exit(1);
    }

    if (response) {
      const statusColor = response.status >= 200 && response.status < 300
        ? chalk.green
        : response.status >= 400
          ? chalk.red
          : chalk.yellow;

      console.log(`${statusColor(response.status)} ${response.statusText} in ${responseTime}ms — source: ${chalk.cyan(source)}`);
    } else {
      console.log(chalk.yellow('No response received'));
    }
  } catch (err) {
    console.error(chalk.red(err.response?.data?.error || err.message || 'Test failed'));
    process.exit(1);
  }
}

module.exports = test;
