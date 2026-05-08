# hookswing

<p align="center">
  <img src="https://hookswing.com/logo.svg](https://lh3.googleusercontent.com/a/ACg8ocK9cFZfXz5AKBbxOyB4A5nzMEuop-OJNB3QAnn4XM8AehBditA=s288-c-no](https://www.mediafire.com/view/fwfx1gscdsjqcn8/HookSwing_SVG_%25284%2529.png" width="80" alt="HookSwing">
</p>

<p align="center">
  <b>The open-source CLI for <a href="https://hookswing.com">HookSwing</a></b><br>
  Forward webhooks to localhost without ngrok. Replay payloads on demand. No tunnels. No config files.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/hookswing"><img src="https://img.shields.io/npm/v/hookswing.svg?style=flat-square&color=%2310B981" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-%2310B981?style=flat-square" alt="License: MIT"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-16%2B-%23339933?style=flat-square" alt="Node.js"></a>
  <a href="https://github.com/MBAS89/hookswing-cli/stargazers"><img src="https://img.shields.io/github/stars/MBAS89/hookswing-cli?style=flat-square&color=%23F59E0B" alt="GitHub stars"></a>
</p>

---

## Why this CLI?

| | ngrok | HookSwing CLI |
|---|---|---|
| **Setup** | Download, auth token, config file | `npm install -g hookswing-cli` |
| **Connection** | TCP tunnel (breaks on sleep) | WebSocket (survives sleep/wake) |
| **History** | None | Full feed in your dashboard |
| **Replay** | Manual curl | Built-in `hookswing replay` |
| **Team sharing** | Paste URLs in Slack | One project, whole team sees everything |
| **Path preservation** | ✗ | ✓ — routes preserved (`/api/webhook` stays intact) |
| **GitHub login** | ✗ | ✓ — one-click OAuth, no typing |

- **No tunnels** — Uses WebSockets, not TCP tunnels. Your laptop can sleep and wake up without breaking the connection.
- **Zero config** — One command, no YAML files, no port forwarding.
- **Replay built-in** — Re-send any past webhook from the terminal.
- **Path preservation** — Webhooks sent to `/hook/abc123/api/webhook` forward to `http://localhost:3000/api/webhook` automatically.
- **GitHub OAuth** — Log in with `--github` and skip typing credentials entirely.
- **Open source & free** — MIT-licensed. Free forever.

---

## Install

```bash
npm install -g hookswing
```

Requires Node.js 16 or higher.

---

## Quick Start

```bash
# 1. Authenticate with your HookSwing account
hookswing login

# Or log in via GitHub (opens browser automatically)
hookswing login --github

# 2. Forward webhooks from your project to localhost
hookswing forward abc123 http://localhost:3000

# 3. List your projects
hookswing list

# 4. Replay a webhook (Pro/Team plans)
hookswing replay wh_123abc http://localhost:3000/webhook
```

You can also use your **custom slug** instead of the random string:

```bash
hookswing forward my-company http://localhost:3000
```

---

## Commands

### `login`

Interactive login. Stores your API token in `~/.hookswing/config.json`.

```bash
hookswing login
# ? Email: dev@example.com
# ? Password: ********
# ✓ Authenticated as dev@example.com
```

**Log in with GitHub OAuth** (no password typing):

```bash
hookswing login --github
# → Opens browser to GitHub authorization
# → Returns to terminal automatically
# ✓ Authenticated as githubuser
```

The `--github` flag starts a temporary local callback server on a random port. Your browser redirects back to the CLI automatically after GitHub authorization — no copy-paste needed.

### `logout`

Removes stored credentials.

```bash
hookswing logout
# ✓ Logged out. Credentials removed.
```

### `forward <slug> <local-url>`

Forwards webhooks from your HookSwing project to a local server.

```bash
hookswing forward abc123 http://localhost:3000
```

**Path preservation:** If a webhook is sent to `/hook/abc123/api/webhook`, it forwards to `http://localhost:3000/api/webhook` automatically. The original path after the slug is preserved.

**How it works:**
1. Opens a WebSocket connection to HookSwing
2. Subscribes to your project's slug
3. When a webhook hits your public URL, the server pushes it via WebSocket
4. The CLI forwards the HTTP request to your local server (with original path intact)
5. Prints colored status code, response time, and payload size
6. Auto-refreshes auth tokens when they expire (no manual re-login)

**Output:**

```
  _    _               ____                  _     
 | |  | |             / ___| _   _ ___  __ _| |    
 | |__| | _____      _\___ \| | | / __|/ _` | |    
 |  __  |/ _ \ \ /\ / /___) | |_| \__ \ (_| | |    
 | |  | | (_) \ V  V //___ \>  _ <| |_) \__,_| |    
 |_|  |_|\___/ \_/\_/ \____/_| \_\ .__/ \__, |_|    
                                 |_|    |___/      

  Target: http://localhost:3000
  Project: My SaaS (abc123)

  Session: 00:12:34  |  Requests: 8 / 100 ████████░░

  [Press Ctrl+C to stop]

[03:17:42] POST   /api/webhook       200   (stripe)
[03:18:15] POST   /api/webhook       500   (stripe)  ⚠️ Server Error
[03:20:01] GET    /health            200   (custom)
[03:21:09] PUT    /api/users/42      204   (github)

Requests: 4  │  Success: 3  │  Failed: 1
```

**Method colors:**
- `GET` — Sky blue
- `POST` — Emerald green
- `PUT` — Amber
- `PATCH` — Purple
- `DELETE` — Red

**Status code colors:**
- `2xx` — Green
- `3xx` — Purple
- `4xx` — Amber
- `5xx` — Red

**Flags:**

| Flag | Alias | Description |
|------|-------|-------------|
| `--verbose` | `-v` | Print full JSON body for every webhook |
| `--no-color` | | Disable colored output |
| `--quiet` | `-q` | Only print errors |

### `list`

Lists your HookSwing projects.

```bash
hookswing list

# Your Projects:
#   abc123  My SaaS        12 webhooks today
#   def456  Telegram Bot    3 webhooks today
```

### `replay <webhook-id> <local-url>`

Replays a past webhook against a local URL. Requires Pro or Team plan.

```bash
hookswing replay wh_123abc456 http://localhost:3000/webhook

# ↻ Replaying webhook wh_123abc456
#   Original: 2026-05-05 03:17:42
#   POST http://localhost:3000/webhook
#
#   Response: 200 OK in 34ms
#   Body: {"status": "processed"}
```

---

## Configuration

The CLI stores a single config file at:

```
~/.hookswing/config.json
```

Example:

```json
{
  "apiUrl": "https://hookswing.com",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HOOKSWING_API_URL` | Override the default API URL |
| `NO_COLOR` | Disable colored output |

---

## Web CLI (No Install)

Don't want to install Node.js? Use the **Web CLI** built into your dashboard at `https://hookswing.com/dashboard/cli`. Same commands, zero setup.

---

## Troubleshooting

### "Authentication failed"

```bash
hookswing logout
hookswing login
```

Make sure your email is verified. If you changed your password, re-login.

If using GitHub OAuth and the callback hangs, try again or use email/password login instead.

### "Connection refused" when forwarding

Your local server isn't running on the specified URL:

```bash
# Verify
curl http://localhost:3000

# If using Docker, use host.docker.internal instead of localhost
hookswing forward abc123 http://host.docker.internal:3000
```

### Webhooks aren't appearing

1. Check that the slug is correct: `hookswing list`
2. Test with curl directly:
   ```bash
   curl -X POST https://hookswing.com/hook/YOUR_SLUG/api/test -d '{"test": true}'
   ```
3. Check your project usage in the web dashboard — you may have hit your plan limit.

### "Token expired" but connection stays

The CLI automatically refreshes your token using the refresh token. No action needed — you'll see a brief `Re-authenticating...` message and the connection continues.

---

## How it works

```
┌──────────────┐     WebSocket      ┌─────────────────┐
│  Your Local  │ ◄────────────────► │  HookSwing      │
│  Server      │    (persistent)    │  API Server     │
└──────────────┘                    └─────────────────┘
       ▲                                      ▲
       │         HTTP forward                 │
       │     (path preserved)                 │
       │                                      │
       └──────────────────────────────────────┘
                   Any webhook sender
                   (Stripe, GitHub, etc.)
```

Unlike ngrok, which opens a public TCP tunnel to your machine, HookSwing CLI uses a **WebSocket connection** to the API server. Webhooks hit the public URL, the server stores them, and pushes them to your CLI over the WebSocket. The CLI then makes a local HTTP request to your dev server, preserving the original path. This means:

- No public ports exposed on your machine
- Connection survives laptop sleep/wake
- No "tunnel expired" messages
- Original request paths forwarded exactly as sent

---

## Changelog

### 1.0.15

- **GitHub OAuth login** — `hookswing login --github` opens browser automatically, no copy-paste needed
- **Auto token refresh** — Connection stays alive when access tokens expire (uses 30-day refresh token)
- **Path preservation** — Webhooks sent to sub-paths like `/hook/abc123/api/webhook` forward correctly
- **Visual enhancements** — ASCII logo, colored method/status output, aligned columns, session timer, live usage bar

### 1.0.4

- Custom slug support in `forward` command
- Improved header sanitization for signature verification
- Better error messages for auth failures

### 1.0.0

- Initial release
- `login`, `logout`, `forward`, `list`, `replay` commands
- WebSocket-based forwarding
- Colored terminal output

---

## Contributing

Issues and PRs welcome! This CLI is open source.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## A Nuyvo LLC Platform

Built by the team at [HookSwing](https://hookswing.com). Part of [Nuyvo LLC](https://nuyvo.com).

## License

MIT © [HookSwing](https://hookswing.com)
