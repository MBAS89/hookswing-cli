const { Command } = require('commander');
const pkg = require('../package.json');
const login = require('./commands/login');
const logout = require('./commands/logout');
const forward = require('./commands/forward');
const list = require('./commands/list');
const replay = require('./commands/replay');
const test = require('./commands/test');

const program = new Command();

program
  .name('hookswing')
  .description('HookSwing CLI — catch, forward, and replay webhooks')
  .version(pkg.version);

program
  .command('login')
  .description('Authenticate with HookSwing')
  .option('--github', 'Login with GitHub OAuth (for users who signed up via GitHub)')
  .option('--google', 'Login with Google OAuth (for users who signed up via Google)')
  .action(login);

program
  .command('logout')
  .description('Remove stored credentials')
  .action(logout);

program
  .command('forward <slug> <local-url>')
  .description('Forward webhooks from a project to your local server')
  .option('-v, --verbose', 'Print full JSON body for every webhook')
  .option('--no-color', 'Disable colored output')
  .option('-q, --quiet', 'Only print errors')
  .addHelpText('after', `
Examples:
  $ hookswing forward abc123 3000
  $ hookswing forward abc123 localhost:3000
  $ hookswing forward abc123 http://localhost:3000
  $ hookswing forward my-company http://localhost:3000/api/webhook
`)
  .action(forward);

program
  .command('list')
  .description('List your projects')
  .action(list);

program
  .command('replay <webhook-id> <local-url>')
  .description('Replay a webhook against a local URL')
  .addHelpText('after', `
Examples:
  $ hookswing replay wh_abc123 3000
  $ hookswing replay wh_abc123 localhost:3000/api/webhook
  $ hookswing replay wh_abc123 http://localhost:3000/webhook
`)
  .action(replay);

program
  .command('test <provider> <event-type> <target-url>')
  .description('Send a realistic test payload to any URL')
  .addHelpText('after', `
Examples:
  $ hookswing test stripe invoice.payment_succeeded 3000
  $ hookswing test stripe invoice.payment_succeeded localhost:3000
  $ hookswing test github push http://localhost:3000/webhook
  $ hookswing test shopify orders/create https://hookswing.com/hook/abc123
`)
  .action(test);

program.parse();
