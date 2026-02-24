import type { Connection } from '../db/connections.js';
import type { ApiKey } from '../db/api-keys.js';
import type { AuditEntry } from '../db/audit.js';

interface LoginData {
  error: string | undefined;
}

interface DashboardData {
  token: string;
  connections: Connection[];
  apiKeys: ApiKey[];
  toolCount: number;
  auditEntries: AuditEntry[];
  auditOffset: number;
  auditTotal: number;
  oauthProviders: Array<{ id: string; displayName: string; configured: boolean; hasBuiltinCreds: boolean }>;
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
    textarea { width: 100%; padding: 8px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #e1e4e8; font-family: "SF Mono", Monaco, monospace; font-size: 12px; line-height: 1.5; resize: vertical; }
    textarea:focus { outline: none; border-color: #58a6ff; }
    button, .btn { display: inline-block; padding: 8px 16px; border-radius: 6px; border: 1px solid #30363d; background: #21262d; color: #e1e4e8; font-size: 14px; cursor: pointer; text-decoration: none; }
    button:hover, .btn:hover { background: #30363d; }
    .btn-primary { background: #238636; border-color: #238636; color: #fff; }
    .btn-primary:hover { background: #2ea043; }
    .btn-danger { background: #da3633; border-color: #da3633; color: #fff; }
    .btn-danger:hover { background: #f85149; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }
    .btn-oauth { background: #fff; color: #333; border: 1px solid #ddd; padding: 10px 20px; font-size: 15px; margin-right: 8px; margin-bottom: 8px; }
    .btn-oauth:hover { background: #f5f5f5; }
    .btn-oauth svg { vertical-align: middle; margin-right: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #21262d; font-size: 13px; }
    th { color: #8b949e; font-weight: 500; }
    .mono { font-family: "SF Mono", Monaco, monospace; font-size: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
    .badge-green { background: #1b4332; color: #52c41a; }
    .badge-red { background: #3d1f1f; color: #f85149; }
    .badge-yellow { background: #3d3520; color: #d29922; }
    .stat { text-align: center; }
    .stat .num { font-size: 28px; font-weight: 700; color: #58a6ff; }
    .stat .label { font-size: 12px; color: #8b949e; }
    .stats { display: flex; gap: 24px; margin-bottom: 24px; }
    .stats > div { flex: 1; }
    .empty { color: #484f58; font-style: italic; padding: 16px 0; }
    .key-display { background: #0d1117; border: 1px solid #238636; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 13px; word-break: break-all; margin: 12px 0; color: #7ee787; }
    .config-block { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 12px; font-family: "SF Mono", Monaco, monospace; font-size: 12px; white-space: pre; overflow-x: auto; color: #e1e4e8; margin: 12px 0; position: relative; }
    .config-block .copy-btn { position: absolute; top: 8px; right: 8px; }
    .flash { background: #1b4332; border: 1px solid #238636; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; color: #7ee787; }
    .flash-error { background: #3d1f1f; border-color: #f85149; color: #f85149; }
    .actions { display: flex; gap: 8px; align-items: center; }
    details { margin-top: 8px; }
    details summary { cursor: pointer; color: #58a6ff; font-size: 13px; }
    details summary:hover { text-decoration: underline; }
    .inline-flash { font-size: 12px; margin-top: 6px; padding: 4px 8px; border-radius: 4px; display: inline-block; }
    .pagination { display: flex; gap: 8px; justify-content: center; margin-top: 16px; }
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

const PROVIDER_ICONS: Record<string, string> = {
  google_calendar: `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`,
  outlook_calendar: `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#0078D4" d="M44 10H20c-1.1 0-2 .9-2 2v24c0 1.1.9 2 2 2h24c1.1 0 2-.9 2-2V12c0-1.1-.9-2-2-2z"/><path fill="#0364B8" d="M26 24l-8.5 5.5V18.5L26 24z"/><path fill="#0078D4" d="M2 13l14-5v32L2 35V13z"/><path fill="#28A8EA" d="M18 10v28H6c-1.1 0-2-.9-2-2V12c0-1.1.9-2 2-2h12z" opacity=".5"/><path fill="#fff" d="M10 20c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"/></svg>`,
  google_gmail: `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M6 8h36v32H6z"/><path fill="#FFF" d="M6 8l18 14L42 8" stroke="#EA4335" stroke-width="0"/><path fill="#C5221F" d="M6 8l18 14L42 8v4L24 26 6 12z"/><path fill="#F1F1F1" d="M6 12l18 14 18-14v24c0 2.2-1.8 4-4 4H10c-2.2 0-4-1.8-4-4V12z"/></svg>`,
};

function dashboardPage(data: DashboardData): string {
  const { token, connections, apiKeys, toolCount, auditEntries, auditOffset, auditTotal, oauthProviders } = data;

  const connectionsHtml = connections.length === 0
    ? '<p class="empty">No connections yet. Connect an account below.</p>'
    : `<table>
        <tr><th>Account</th><th>Provider</th><th>Created</th><th></th></tr>
        ${connections.map(c => `
          <tr>
            <td class="mono">${esc(c.account_name)}</td>
            <td>${esc(c.provider_id)}</td>
            <td>${c.created_at}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteConnection('${c.id}')">Remove</button></td>
          </tr>
          <tr>
            <td colspan="4" style="padding: 0 12px 12px;">
              <details>
                <summary>Edit Policy</summary>
                <div style="margin-top: 8px;">
                  <textarea id="policy-${c.id}" rows="12">${esc(c.policy_yaml)}</textarea>
                  <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center;">
                    <button class="btn btn-primary btn-sm" onclick="savePolicy('${c.id}')">Save Policy</button>
                    <span id="policy-flash-${c.id}"></span>
                  </div>
                </div>
              </details>
            </td>
          </tr>
        `).join('')}
      </table>`;

  const oauthButtonsHtml = oauthProviders.map(p => {
    const icon = PROVIDER_ICONS[p.id] ?? '';
    if (p.configured) {
      return `<a href="/api/connections/oauth/${esc(p.id)}/start?token=${token}" class="btn btn-oauth">${icon} Connect ${esc(p.displayName)}</a>`;
    }
    return `<span class="btn btn-oauth" style="opacity: 0.5; cursor: not-allowed;" title="Configure OAuth credentials in Settings below">${icon} Connect ${esc(p.displayName)} <span style="font-size: 11px; color: #da3633;">(not configured)</span></span>`;
  }).join('\n        ');

  const settingsHtml = oauthProviders.filter(p => !p.hasBuiltinCreds).map(p => `
    <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #21262d;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <strong>${esc(p.displayName)}</strong>
        ${p.configured
          ? '<span class="badge badge-green">Configured</span>'
          : '<span class="badge badge-red">Not configured</span>'}
      </div>
      <label for="oauth-id-${esc(p.id)}">Client ID</label>
      <input type="text" id="oauth-id-${esc(p.id)}" placeholder="Application (client) ID">
      <label for="oauth-secret-${esc(p.id)}">Client Secret</label>
      <input type="password" id="oauth-secret-${esc(p.id)}" placeholder="Client secret value">
      <div style="display: flex; gap: 8px; align-items: center;">
        <button class="btn btn-primary btn-sm" onclick="saveOAuthCreds('${esc(p.id)}')">Save</button>
        <span id="oauth-flash-${esc(p.id)}"></span>
      </div>
    </div>
  `).join('');

  const providersWithBuiltinOnly = oauthProviders.filter(p => p.hasBuiltinCreds);
  const builtinSettingsHtml = providersWithBuiltinOnly.length > 0
    ? `<details style="margin-bottom: 16px;">
        <summary>Override built-in credentials</summary>
        <div style="margin-top: 12px;">
          <p style="font-size: 12px; color: #8b949e; margin-bottom: 12px;">These providers have built-in credentials. Override only if you want to use your own.</p>
          ${providersWithBuiltinOnly.map(p => `
            <div style="margin-bottom: 12px;">
              <strong>${esc(p.displayName)}</strong> <span class="badge badge-green">Built-in</span>
              <div style="margin-top: 8px;">
                <label for="oauth-id-${esc(p.id)}">Client ID</label>
                <input type="text" id="oauth-id-${esc(p.id)}" placeholder="Leave empty to use built-in">
                <label for="oauth-secret-${esc(p.id)}">Client Secret</label>
                <input type="password" id="oauth-secret-${esc(p.id)}" placeholder="Leave empty to use built-in">
                <div style="display: flex; gap: 8px; align-items: center;">
                  <button class="btn btn-primary btn-sm" onclick="saveOAuthCreds('${esc(p.id)}')">Save</button>
                  <span id="oauth-flash-${esc(p.id)}"></span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </details>`
    : '';

  const activeKeys = apiKeys.filter(k => !k.revoked_at);

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
            <td>${!k.revoked_at ? `<button class="btn btn-danger btn-sm" onclick="revokeKey('${k.id}')">Revoke</button>` : ''}</td>
          </tr>
        `).join('')}
      </table>`;

  const mcpConfigJson = JSON.stringify({
    mcpServers: {
      gatelet: {
        url: 'http://localhost:4000/mcp',
        headers: {
          Authorization: `Bearer ${activeKeys.length > 0 ? '<YOUR_API_KEY>' : '(create an API key first)'}`,
        },
      },
    },
  }, null, 2);

  // Audit log table
  const auditHtml = auditEntries.length === 0
    ? '<p class="empty">No audit entries yet.</p>'
    : `<table>
        <tr><th>Timestamp</th><th>Tool</th><th>Result</th><th>Duration</th></tr>
        ${auditEntries.map(e => `
          <tr>
            <td class="mono" style="font-size: 11px;">${esc(e.timestamp)}</td>
            <td class="mono">${esc(e.tool_name)}</td>
            <td>${resultBadge(e.result)}</td>
            <td>${e.duration_ms !== null ? e.duration_ms + 'ms' : '-'}</td>
          </tr>
          ${(e.original_params || e.mutated_params || e.deny_reason) ? `
          <tr>
            <td colspan="4" style="padding: 0 12px 8px;">
              <details>
                <summary>Details</summary>
                <div style="margin-top: 8px; font-size: 12px;">
                  ${e.deny_reason ? `<div style="margin-bottom: 6px;"><strong>Deny reason:</strong> ${esc(e.deny_reason)}</div>` : ''}
                  ${e.original_params ? `<div style="margin-bottom: 6px;"><strong>Original params:</strong><pre class="config-block" style="margin-top: 4px;">${esc(e.original_params)}</pre></div>` : ''}
                  ${e.mutated_params ? `<div><strong>Mutated params:</strong><pre class="config-block" style="margin-top: 4px;">${esc(e.mutated_params)}</pre></div>` : ''}
                </div>
              </details>
            </td>
          </tr>` : ''}
        `).join('')}
      </table>`;

  const pageSize = 25;
  const hasPrev = auditOffset > 0;
  const hasNext = auditOffset + pageSize < auditTotal;

  const paginationHtml = (hasPrev || hasNext) ? `
    <div class="pagination">
      ${hasPrev ? `<a href="/?token=${token}&audit_offset=${Math.max(0, auditOffset - pageSize)}" class="btn btn-sm">Prev</a>` : ''}
      <span style="color: #8b949e; font-size: 12px; line-height: 28px;">${auditOffset + 1}&ndash;${Math.min(auditOffset + pageSize, auditTotal)} of ${auditTotal}</span>
      ${hasNext ? `<a href="/?token=${token}&audit_offset=${auditOffset + pageSize}" class="btn btn-sm">Next</a>` : ''}
    </div>
  ` : '';

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
        <div class="num">${activeKeys.length}</div>
        <div class="label">API Keys</div>
      </div>
    </div>

    <div class="card">
      <h2>Connections</h2>
      ${connectionsHtml}
      <div style="margin-top: 16px;">
        ${oauthButtonsHtml}
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

    <div class="card">
      <h2>Agent Config</h2>
      <p style="font-size: 13px; color: #8b949e; margin-bottom: 12px;">Add this to your agent's MCP configuration:</p>
      <div class="config-block"><button class="btn btn-sm copy-btn" onclick="copyConfig()">Copy</button>${esc(mcpConfigJson)}</div>
    </div>

    ${(settingsHtml || builtinSettingsHtml) ? `
    <div class="card">
      <h2>OAuth Settings</h2>
      ${settingsHtml}
      ${builtinSettingsHtml}
    </div>
    ` : ''}

    <div class="card">
      <h2>Audit Log</h2>
      ${auditHtml}
      ${paginationHtml}
    </div>

    <script>
      const TOKEN = ${JSON.stringify(token)};
      const headers = { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

      function flash(msg, error) {
        const el = document.getElementById('flash');
        el.innerHTML = '<div class="flash ' + (error ? 'flash-error' : '') + '">' + msg + '</div>';
        setTimeout(() => el.innerHTML = '', 5000);
      }

      function inlineFlash(elId, msg, error) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.innerHTML = '<span class="inline-flash ' + (error ? 'flash-error' : 'flash') + '">' + msg + '</span>';
        setTimeout(() => el.innerHTML = '', 4000);
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
        const configJson = JSON.stringify({
          mcpServers: {
            gatelet: {
              url: 'http://localhost:4000/mcp',
              headers: { Authorization: 'Bearer ' + data.key }
            }
          }
        }, null, 2);
        document.getElementById('new-key').innerHTML =
          '<div class="key-display">Copy this key (shown once):<br><br><strong>' + data.key + '</strong></div>' +
          '<div class="config-block">' + configJson.replace(/</g, '&lt;') + '</div>';
      }

      async function savePolicy(id) {
        const textarea = document.getElementById('policy-' + id);
        if (!textarea) return;
        try {
          const res = await fetch('/api/connections/' + id + '/policy', {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'text/yaml' },
            body: textarea.value,
          });
          const data = await res.json();
          if (res.ok) {
            inlineFlash('policy-flash-' + id, 'Saved. Takes effect on new agent sessions.');
          } else {
            inlineFlash('policy-flash-' + id, data.error || 'Save failed', true);
          }
        } catch (err) {
          inlineFlash('policy-flash-' + id, 'Network error', true);
        }
      }

      async function saveOAuthCreds(providerId) {
        const clientId = document.getElementById('oauth-id-' + providerId)?.value?.trim();
        const clientSecret = document.getElementById('oauth-secret-' + providerId)?.value?.trim();
        if (!clientId || !clientSecret) {
          inlineFlash('oauth-flash-' + providerId, 'Both fields required', true);
          return;
        }
        try {
          const res = await fetch('/api/settings/oauth/' + providerId, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
          });
          const data = await res.json();
          if (res.ok) {
            inlineFlash('oauth-flash-' + providerId, 'Saved!');
            setTimeout(reload, 1000);
          } else {
            inlineFlash('oauth-flash-' + providerId, data.error || 'Save failed', true);
          }
        } catch (err) {
          inlineFlash('oauth-flash-' + providerId, 'Network error', true);
        }
      }

      function copyConfig() {
        const block = document.querySelector('.config-block');
        if (!block) return;
        const text = block.textContent.replace('Copy', '').trim();
        navigator.clipboard.writeText(text).then(() => {
          flash('Copied to clipboard');
        });
      }

    </script>
  `);
}

function resultBadge(result: string): string {
  switch (result) {
    case 'allowed': return '<span class="badge badge-green">Allowed</span>';
    case 'denied': return '<span class="badge badge-red">Denied</span>';
    case 'error': return '<span class="badge badge-yellow">Error</span>';
    default: return `<span class="badge">${esc(result)}</span>`;
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
