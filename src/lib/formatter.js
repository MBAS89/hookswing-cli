const chalk = require('chalk');

function timestamp() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

function formatWebhookLine(webhook, verbose) {
  const time = chalk.gray(`[${timestamp()}]`);
  const method = chalk.bold(webhook.method.toUpperCase().padEnd(6));
  const status = webhook.statusCode
    ? webhook.statusCode >= 500
      ? chalk.red(webhook.statusCode)
      : webhook.statusCode >= 400
      ? chalk.yellow(webhook.statusCode)
      : chalk.green(webhook.statusCode)
    : chalk.gray('—');
  const size = formatBytes(webhook.body ? JSON.stringify(webhook.body).length : 0).padStart(6);
  const rt = webhook.responseTime ? `${webhook.responseTime}ms`.padStart(5) : '—'.padStart(5);
  const source = webhook.source || 'custom';

  let line = `${time} ${method} ${status} ${size} ${rt} ${source}`;
  if (webhook.statusCode && webhook.statusCode >= 500) {
    line += chalk.red('  ⚠️ Server Error');
  }

  if (verbose && webhook.body) {
    line += '\n' + chalk.gray(JSON.stringify(webhook.body, null, 2));
  }

  return line;
}

module.exports = { timestamp, formatBytes, formatWebhookLine };
