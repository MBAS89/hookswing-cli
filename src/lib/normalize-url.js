/**
 * Normalize a user-provided URL for local forwarding/testing.
 *
 * Rules:
 * - "3000"         → "http://localhost:3000"
 * - "localhost:3000" → "http://localhost:3000"
 * - "127.0.0.1:3000" → "http://127.0.0.1:3000"
 * - "0.0.0.0:3000"   → "http://0.0.0.0:3000"
 * - Full URLs        → left as-is
 */
function normalizeUrl(url) {
  if (!url) return url;

  // Already has a protocol
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  // Just a port number (e.g. "3000")
  if (/^\d+$/.test(url)) {
    return `http://localhost:${url}`;
  }

  // Host:port without protocol (e.g. "localhost:3000", "127.0.0.1:3000")
  if (/^[a-zA-Z0-9_.-]+(:\d+)?$/.test(url)) {
    return `http://${url}`;
  }

  return url;
}

module.exports = { normalizeUrl };
