import type { Connection } from '../db/connections.js';
import type { ApiKey } from '../db/api-keys.js';

interface LoginData {
  error: string | undefined;
}

interface DashboardData {
  token: string;
  connections: Connection[];
  apiKeys: ApiKey[];
  toolCount: number;
}

export function adminPage(view: 'login', data: LoginData): string;
export function adminPage(view: 'dashboard', data: DashboardData): string;
export function adminPage(view: 'login' | 'dashboard', data: LoginData | DashboardData): string {
  if (view === 'login') return loginPage(data as LoginData);
  return dashboardPage(data as DashboardData);
}

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f1117; color: #e1e4e8; min-height: 100vh; }
    .container { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: #8b949e; margin-bottom: 32px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 24px; margin-bottom: 16px; }
    .card h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    label { display: block; font-size: 13px; color: #8b949e; margin-bottom: 6px; }
    input[type="text"], input[type="password"] { width: 100%; padding: 8px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #e1e4e8; font-size: 14px; margin-bottom: 16px; }
    input:focus { outline: none; border-color: #58a6ff; }
    button, .btn { display: inline-block; padding: 8px 16px; border-radius: 6px; border: 1px solid #30363d; background: #21262d; color: #e1e4e8; font-size: 14px; cursor: pointer; text-decoration: none; }
    button:hover, .btn:hover { background: #30363d; }
    .btn-primary { background: #238636; border-color: #238636; color: #fff; }
    .btn-primary:hover { background: #2ea043; }
    .btn-danger { background: #da3633; border-color: #da3633; color: #fff; }
    .btn-danger:hover { background: #f85149; }
    .btn-google { background: #fff; color: #333; border: 1px solid #ddd; padding: 10px 20px; font-size: 15px; }
    .btn-google:hover { background: #f5f5f5; }
    .btn-google svg { vertical-align: middle; margin-right: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #21262d; font-size: 13px; }
    th { color: #8b949e; font-weight: 500; }
    .mono { font-family: "SF Mono", Monaco, monospace; font-size: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
    .badge-green { background: #1b4332; color: #52c41a; }
    .badge-red { background: #3d1f1f; color: #f85149; }
    .stat { text-align: center; }
    .stat .num { font-size: 28px; font-weight: 700; color: #58a6ff; }
    .stat .label { font-size: 12px; color: #8b949e; }
    .stats { display: flex; gap: 24px; margin-bottom: 24px; }
    .stats > div { flex: 1; }
    .empty { color: #484f58; font-style: italic; padding: 16px 0; }
    .key-display { background: #0d1117; border: 1px solid #238636; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 13px; word-break: break-all; margin: 12px 0; color: #7ee787; }
    .flash { background: #1b4332; border: 1px solid #238636; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; color: #7ee787; }
    .flash-error { background: #3d1f1f; border-color: #f85149; color: #f85149; }
    .actions { display: flex; gap: 8px; align-items: center; }
  </style>
</head>
<body>
  <div class="container">${body}</div>
</body>
</html>`;
}

function loginPage(data: LoginData): string {
  return shell('Gatelet', `
    <h1>Gatelet</h1>
    <p class="subtitle">MCP permission proxy for AI agents</p>
    <div class="card">
      <h2>Sign in</h2>
      ${data.error ? `<div class="flash flash-error">${data.error}</div>` : ''}
      <form method="get" action="/">
        <label for="token">Admin Token</label>
        <input type="password" id="token" name="token" placeholder="Paste your admin token" required>
        <button type="submit" class="btn-primary">Sign in</button>
      </form>
      <p style="margin-top: 16px; font-size: 12px; color: #484f58;">The admin token was printed when you started the server.</p>
    </div>
  `);
}

function dashboardPage(data: DashboardData): string {
  const { token, connections, apiKeys, toolCount } = data;

  const connectionsHtml = connections.length === 0
    ? '<p class="empty">No connections yet. Connect a Google account below.</p>'
    : `<table>
        <tr><th>Account</th><th>Provider</th><th>Created</th><th></th></tr>
        ${connections.map(c => `
          <tr>
            <td class="mono">${esc(c.account_name)}</td>
            <td>${esc(c.provider_id)}</td>
            <td>${c.created_at}</td>
            <td><button class="btn btn-danger" onclick="deleteConnection('${c.id}')">Remove</button></td>
          </tr>
        `).join('')}
      </table>`;

  const apiKeysHtml = apiKeys.length === 0
    ? '<p class="empty">No API keys yet.</p>'
    : `<table>
        <tr><th>Name</th><th>ID</th><th>Last used</th><th>Status</th><th></th></tr>
        ${apiKeys.map(k => `
          <tr>
            <td>${esc(k.name)}</td>
            <td class="mono">${k.id}</td>
            <td>${k.last_used_at ?? 'Never'}</td>
            <td>${k.revoked_at ? '<span class="badge badge-red">Revoked</span>' : '<span class="badge badge-green">Active</span>'}</td>
            <td>${!k.revoked_at ? `<button class="btn btn-danger" onclick="revokeKey('${k.id}')">Revoke</button>` : ''}</td>
          </tr>
        `).join('')}
      </table>`;

  return shell('Gatelet Admin', `
    <h1>Gatelet</h1>
    <p class="subtitle">MCP permission proxy</p>

    <div id="flash"></div>

    <div class="stats">
      <div class="card stat">
        <div class="num">${connections.length}</div>
        <div class="label">Connections</div>
      </div>
      <div class="card stat">
        <div class="num">${toolCount}</div>
        <div class="label">Tools</div>
      </div>
      <div class="card stat">
        <div class="num">${apiKeys.filter(k => !k.revoked_at).length}</div>
        <div class="label">API Keys</div>
      </div>
    </div>

    <div class="card">
      <h2>Connections</h2>
      ${connectionsHtml}
      <div style="margin-top: 16px;">
        <a href="/api/connections/oauth/google/start?token=${token}" class="btn btn-google">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Connect Google Calendar
        </a>
      </div>
    </div>

    <div class="card">
      <h2>API Keys</h2>
      ${apiKeysHtml}
      <div style="margin-top: 16px;" class="actions">
        <input type="text" id="key-name" placeholder="Key name (e.g. My Agent)" style="margin-bottom: 0; flex: 1;">
        <button class="btn btn-primary" onclick="createKey()">Create Key</button>
      </div>
      <div id="new-key"></div>
    </div>

    <script>
      const TOKEN = ${JSON.stringify(token)};
      const headers = { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

      function flash(msg, error) {
        const el = document.getElementById('flash');
        el.innerHTML = '<div class="flash ' + (error ? 'flash-error' : '') + '">' + msg + '</div>';
        setTimeout(() => el.innerHTML = '', 5000);
      }

      function reload() { window.location.href = '/?token=' + TOKEN; }

      async function deleteConnection(id) {
        if (!confirm('Remove this connection?')) return;
        await fetch('/api/connections/' + id, { method: 'DELETE', headers });
        reload();
      }

      async function revokeKey(id) {
        if (!confirm('Revoke this API key?')) return;
        await fetch('/api/api-keys/' + id, { method: 'DELETE', headers });
        reload();
      }

      async function createKey() {
        const name = document.getElementById('key-name').value.trim();
        if (!name) return alert('Enter a name');
        const res = await fetch('/api/api-keys', { method: 'POST', headers, body: JSON.stringify({ name }) });
        const data = await res.json();
        document.getElementById('new-key').innerHTML =
          '<div class="key-display">Copy this key (shown once):<br><br><strong>' + data.key + '</strong></div>';
      }

    </script>
  `);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
