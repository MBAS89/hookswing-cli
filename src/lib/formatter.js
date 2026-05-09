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

function colorMethod(method) {
  const m = method.toUpperCase();
  if (m.startsWith('GET')) return chalk.hex('#7dd3fc').bold(m);
  if (m.startsWith('POST')) return chalk.hex('#86efac').bold(m);
  if (m.startsWith('PUT')) return chalk.hex('#fbbf24').bold(m);
  if (m.startsWith('PATCH')) return chalk.hex('#c084fc').bold(m);
  if (m.startsWith('DELETE')) return chalk.hex('#f87171').bold(m);
  return chalk.bold(m);
}

function colorStatus(status) {
  if (!status || status === '—') return chalk.gray('—');
  const s = String(status);
  if (status >= 500) return chalk.hex('#f87171')(s);
  if (status >= 400) return chalk.hex('#fbbf24')(s);
  if (status >= 300) return chalk.hex('#c084fc')(s);
  return chalk.hex('#34d399')(s);
}

function formatWebhookLine(webhook, verbose) {
  const time = chalk.gray(`[${timestamp()}]`);

  // Build source label with event type when available
  let sourceLabel = webhook.source || 'custom';
  if (webhook.eventType) {
    sourceLabel += ':' + webhook.eventType;
  }

  // Pad raw strings, then color the entire padded result
  const method = colorMethod(webhook.method.toUpperCase().padEnd(7));
  const path = chalk.white((webhook.path || '/').padEnd(18));
  const status = colorStatus(webhook.statusCode).padEnd(5);
  const source = chalk.gray(`(${sourceLabel})`);

  let line = `${time} ${method} ${path} ${status} ${source}`;

  if (webhook.statusCode && webhook.statusCode >= 500) {
    line += ' ' + chalk.red('⚠ Server Error');
  }

  if (verbose && webhook.body) {
    line += '\n' + chalk.gray(JSON.stringify(webhook.body, null, 2));
  }

  return line;
}

function printLogo() {
  const logo = `
${chalk.hex('#10b981')('  ██╗  ██╗ ██████╗  ██████╗ ██╗  ██╗███████╗██╗    ██╗██╗███╗   ██╗ ██████╗ ')}
${chalk.hex('#34d399')('  ██║  ██║██╔═══██╗██╔═══██╗██║ ██╔╝██╔════╝██║    ██║██║████╗  ██║██╔════╝ ')}
${chalk.hex('#6ee7b7')('  ███████║██║   ██║██║   ██║█████╔╝ ███████╗██║ █╗ ██║██║██╔██╗ ██║██║  ███╗')}
${chalk.hex('#34d399')('  ██╔══██║██║   ██║██║   ██║██╔═██╗ ╚════██║██║███╗██║██║██║╚██╗██║██║   ██║')}
${chalk.hex('#10b981')('  ██║  ██║╚██████╔╝╚██████╔╝██║  ██╗███████║╚███╔███╔╝██║██║ ╚████║╚██████╔╝')}
${chalk.hex('#059669')('  ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝ ╚══╝╚══╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝ ')}
  `;
  console.log(logo);
}

module.exports = { timestamp, formatBytes, formatWebhookLine, printLogo };
