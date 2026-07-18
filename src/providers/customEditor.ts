import * as vscode from 'vscode';
import { WorkspaceStateManager } from '../state';
import { parseEnvContent } from '../parser';

export class DotCloakCustomEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'dotcloak.customEditor';

  constructor(private readonly stateManager: WorkspaceStateManager) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };

    const sendData = () => {
      const envFile = parseEnvContent(document.getText(), document.uri);
      const sections: { line: number; title: string }[] = [];
      for (let i = 0; i < envFile.lines.length; i++) {
        const trimmed = envFile.lines[i].trim();
        if (trimmed.startsWith('# ') && trimmed.length > 2) {
          sections.push({ line: i, title: trimmed.slice(2).trim() });
        }
      }
      webviewPanel.webview.postMessage({
        type: 'updateData',
        entries: envFile.entries.map(e => ({ key: e.key, value: e.value, line: e.line })),
        sections,
        count: envFile.entries.length,
      });
    };

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length) {
        sendData();
      }
    });

    const stateSubscription = this.stateManager.onDidChange(() => {
      webviewPanel.webview.postMessage({
        type: 'updateState',
        locked: this.stateManager.getState().locked,
        searchQuery: this.stateManager.getSearchQuery(),
      });
    });

    const messageHandler = async (message: Record<string, unknown>) => {
      switch (message.type) {
        case 'toggleLock':
          await this.stateManager.toggleLock();
          break;
        case 'toggleMode':
          if (this.stateManager.getState().mode === 'dotcloak') {
            await this.stateManager.setState({ locked: false });
          }
          await this.stateManager.toggleMode();
          webviewPanel.dispose();
          await vscode.window.showTextDocument(document);
          break;
        case 'openBMC':
          await vscode.env.openExternal(vscode.Uri.parse('https://ko-fi.com/wagekusuma'));
          break;
        case 'edit':
          await this.editEntry(document, message.key as string, message.newValue as string);
          break;
        case 'editKeyValue':
          await this.editKeyValue(document, message.oldKey as string, message.key as string, message.value as string);
          break;
        case 'delete':
          await this.deleteEntry(document, message.key as string);
          break;
        case 'add':
          await this.addEntry(document, message.key as string, message.value as string);
          break;
      }
    };

    webviewPanel.webview.onDidReceiveMessage(messageHandler);

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      stateSubscription.dispose();
    });

    const envFile = parseEnvContent(document.getText(), document.uri);
    const sections: { line: number; title: string }[] = [];
    for (let i = 0; i < envFile.lines.length; i++) {
      const trimmed = envFile.lines[i].trim();
      if (trimmed.startsWith('# ') && trimmed.length > 2) {
        sections.push({ line: i, title: trimmed.slice(2).trim() });
      }
    }

    const filename = document.uri.fsPath.split('/').pop() || document.uri.fsPath;

    webviewPanel.webview.html = this.getHtml({
      entries: envFile.entries.map(e => ({ key: e.key, value: e.value, line: e.line })),
      sections,
      count: envFile.entries.length,
      locked: this.stateManager.getState().locked,
      searchQuery: this.stateManager.getSearchQuery(),
      filename,
    });
  }

  private async editKeyValue(
    document: vscode.TextDocument,
    oldKey: string,
    newKey: string,
    newValue: string,
  ): Promise<void> {
    const envFile = parseEnvContent(document.getText(), document.uri);
    const entry = envFile.entries.find((e) => e.key === oldKey);
    if (!entry) return;

    const edit = new vscode.WorkspaceEdit();
    const line = document.lineAt(entry.line);
    const eqIndex = line.text.indexOf('=');
    if (eqIndex === -1) return;

    const newLineText = `${newKey}=${newValue}`;
    edit.replace(
      document.uri,
      new vscode.Range(entry.line, 0, entry.line, line.text.length),
      newLineText,
    );

    await vscode.workspace.applyEdit(edit);
  }

  private async editEntry(
    document: vscode.TextDocument,
    key: string,
    newValue: string,
  ): Promise<void> {
    const envFile = parseEnvContent(document.getText(), document.uri);
    const entry = envFile.entries.find((e) => e.key === key);
    if (!entry) return;

    const edit = new vscode.WorkspaceEdit();
    const line = document.lineAt(entry.line);
    const eqIndex = line.text.indexOf('=');
    if (eqIndex === -1) return;

    const valueStart = eqIndex + 1;
    edit.replace(
      document.uri,
      new vscode.Range(entry.line, valueStart, entry.line, line.text.length),
      newValue,
    );

    await vscode.workspace.applyEdit(edit);
  }

  private async deleteEntry(
    document: vscode.TextDocument,
    key: string,
  ): Promise<void> {
    const envFile = parseEnvContent(document.getText(), document.uri);
    const entry = envFile.entries.find((e) => e.key === key);
    if (!entry) return;

    const edit = new vscode.WorkspaceEdit();
    edit.delete(
      document.uri,
      new vscode.Range(entry.line, 0, entry.line + 1, 0),
    );

    await vscode.workspace.applyEdit(edit);
  }

  private async addEntry(
    document: vscode.TextDocument,
    key: string,
    value: string,
  ): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const lastLine = document.lineAt(document.lineCount - 1);
    const lastLineEmpty = lastLine.text.trim() === '';
    const insertPos = new vscode.Position(lastLine.lineNumber, lastLine.text.length);
    const newText = lastLineEmpty ? `${key}=${value}` : `\n${key}=${value}`;

    edit.insert(document.uri, insertPos, newText);
    await vscode.workspace.applyEdit(edit);
  }

  private getHtml(initial: {
    entries: { key: string; value: string; line: number }[];
    sections: { line: number; title: string }[];
    count: number;
    locked: boolean;
    searchQuery: string;
    filename: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DotCloak</title>
<style>
  :root {
    --amber: oklch(0.78 0.14 68);
    --teal: oklch(0.60 0.10 200);
    --void: oklch(0.14 0.000 0);
    --panel: oklch(0.20 0.003 250);
    --border: oklch(0.30 0.000 0);
    --ink: oklch(0.90 0.005 250);
    --muted: oklch(0.55 0.005 250);
    --danger: oklch(0.65 0.22 25);
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --font-mono: "JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", monospace;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--void);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: 13px;
    padding: 12px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .toolbar-title {
    font-weight: 600;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-right: auto;
  }

  .lock-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--amber);
    display: inline-block;
    transition: opacity 150ms;
  }
  .lock-dot.unlocked { opacity: 0.4; }

  .search-wrap {
    position: relative;
    flex: 1;
    min-width: 140px;
    max-width: 280px;
    margin-bottom: 10px;
  }

  .search-input {
    width: 100%;
    padding: 4px 8px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: 13px;
    outline: none;
    transition: border-color 150ms;
  }
  .search-input:focus { border-color: var(--amber); }
  .search-input::placeholder { color: var(--muted); }

  .btn {
    padding: 4px 10px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: 12px;
    cursor: pointer;
    transition: border-color 150ms, color 150ms;
    white-space: nowrap;
  }
  .btn:hover { border-color: var(--muted); }
  .btn:focus { outline: 1px solid var(--amber); outline-offset: 1px; }
  .btn:active { background: var(--border); }

  .btn-primary {
    border-color: var(--amber);
    color: var(--amber);
  }
  .btn-primary:hover { background: oklch(0.78 0.14 68 / 0.1); }

  .btn-danger {
    border-color: var(--danger);
    color: var(--danger);
  }
  .btn-danger:hover { background: oklch(0.65 0.22 25 / 0.1); }

  .btn-sm {
    padding: 2px 6px;
    font-size: 11px;
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 3px;
    max-height: calc(100vh - 140px);
    overflow-y: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
    min-width: 600px;
  }

  th {
    background: var(--panel);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    user-select: none;
    cursor: pointer;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  th:hover { color: var(--ink); }

  .sort-indicator {
    display: inline-block;
    width: 12px;
    text-align: center;
    font-size: 10px;
    color: var(--amber);
    margin-left: 2px;
  }

  .col-key { width: auto; min-width: 30%; }
  .col-value { width: auto; }
  .col-actions { white-space: nowrap; }
  th.col-value { cursor: default; }
  th.col-value:hover { color: var(--muted); }
  th.col-actions { cursor: default; }
  th.col-actions:hover { color: var(--muted); }

  td.col-actions .actions-wrap {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  td.col-actions .btn { flex-shrink: 0; }

  td {
    padding: 5px 10px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  tr:last-child td { border-bottom: none; }
  tr:hover td { background: oklch(0.22 0.003 250); }

  .section-row td {
    background: var(--panel);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--muted);
    font-weight: 600;
    padding: 8px 10px 4px;
    border-bottom: none;
    cursor: default;
  }
  .section-row:hover td { background: var(--panel); }
  .section-row + tr td { border-top: none; }

  td.col-key {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 13px;
  }

  td.col-value {
    font-family: var(--font-mono);
    font-size: 13px;
  }
  td.col-value.masked {
    color: var(--muted);
    font-style: italic;
  }

  td.col-actions {
    white-space: nowrap;
    width: 1px;
  }

  .empty {
    text-align: center;
    color: var(--muted);
    padding: 32px 12px;
    font-size: 12px;
  }

  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: oklch(0 0 0 / 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .dialog {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 14px;
    width: 90%;
    max-width: 300px;
  }

  .dialog-title {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 10px;
  }

  .dialog-label {
    font-size: 11px;
    color: var(--muted);
    display: block;
    margin-bottom: 3px;
    margin-top: 8px;
  }
  .dialog-label:first-of-type { margin-top: 0; }

  .dialog-input {
    width: 100%;
    padding: 4px 8px;
    background: var(--void);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: 13px;
    outline: none;
  }
  .dialog-input:focus { border-color: var(--amber); }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 12px;
  }

  .count {
    font-size: 11px;
    color: var(--muted);
    margin-top: 6px;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }
  .kofi-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    background: #72a4f2;
    border: none;
    border-radius: 6px;
    color: #fff;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms;
    flex-shrink: 0;
  }
  .kofi-btn:hover {
    background: #5b8fe0;
    transform: translateY(-1px);
  }
  .kofi-icon {
    font-size: 13px;
  }
</style>
</head>
<body>

<div class="toolbar">
  <div class="toolbar-title">
    <span class="lock-dot" id="lockDot"></span>
    <span>DotCloak</span>
    <span style="font-weight:400;color:var(--muted);font-size:12px">${initial.filename}</span>
  </div>
  <button class="btn" id="lockBtn">Locked</button>
  <button class="btn btn-primary" id="addBtn">+ Add</button>
  <button class="btn btn-danger" id="exitModeBtn">Exit Mode</button>
  <button class="kofi-btn" id="bmcBtn">
    <span class="kofi-icon">☕</span>
    Support me on Ko-fi
  </button>
</div>

<div class="search-wrap">
  <input class="search-input" id="searchInput" type="text" placeholder="Search keys..." aria-label="Search environment keys" />
</div>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th class="col-key" data-sort="key">Key <span class="sort-indicator" id="sortKey"></span></th>
        <th class="col-value">Value</th>
        <th class="col-actions">Actions</th>
      </tr>
    </thead>
    <tbody id="tableBody"></tbody>
  </table>
</div>

<div class="footer">
  <span class="count" id="countInfo">${initial.count} key${initial.count !== 1 ? 's' : ''}</span>
</div>

<script>
  const vscode = acquireVsCodeApi();

  var entries = ${JSON.stringify(initial.entries)};
  var sections = ${JSON.stringify(initial.sections)};
  var isLocked = ${initial.locked};
  var sortCol = null;
  var sortAsc = true;
  var searchQuery = ${JSON.stringify(initial.searchQuery)};

  const tableBody = document.getElementById('tableBody');
  const searchInput = document.getElementById('searchInput');
  const sortKeyEl = document.getElementById('sortKey');
  const countInfo = document.getElementById('countInfo');
  const lockDot = document.getElementById('lockDot');
  const lockBtn = document.getElementById('lockBtn');

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function updateLockUI() {
    lockDot.className = 'lock-dot' + (isLocked ? '' : ' unlocked');
    lockBtn.textContent = isLocked ? 'Locked' : 'Unlocked';
  }

  function findSection(line) {
    var match = null;
    for (var j = 0; j < sections.length; j++) {
      if (sections[j].line < line) { match = sections[j]; }
      else { break; }
    }
    return match;
  }

  function renderTable() {
    var filtered = entries;

    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      filtered = entries.filter(function(e) { return e.key.toLowerCase().includes(q); });
    }

    var sorted = filtered.slice();
    if (sortCol) {
      sorted.sort(function(a, b) {
        var av = a[sortCol] || '';
        var bv = b[sortCol] || '';
        var cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
        return sortAsc ? cmp : -cmp;
      });
    } else {
      sorted.sort(function(a, b) { return a.line - b.line; });
    }

    sortKeyEl.textContent = sortCol === 'key' ? (sortAsc ? '\\u25B2' : '\\u25BC') : '';

    if (sorted.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="3" class="empty">No matching keys</td></tr>';
      countInfo.textContent = '0 keys';
      return;
    }

    countInfo.textContent = sorted.length + ' key' + (sorted.length !== 1 ? 's' : '') +
      (searchQuery ? ' (filtered)' : '');

    var html = '';
    var lastSectionLine = -1;
    for (var i = 0; i < sorted.length; i++) {
      var entry = sorted[i];
      var entrySection = findSection(entry.line);
      var sectionLine = entrySection ? entrySection.line : -1;
      if (sectionLine !== lastSectionLine && entrySection) {
        html += '<tr class="section-row"><td colspan="3">' + esc(entrySection.title) + '</td></tr>';
        lastSectionLine = sectionLine;
      }
      var dv = isLocked ? '***' : esc(entry.value);
      var maskedCls = isLocked ? ' masked' : '';
      html += '<tr data-key="' + escAttr(entry.key) + '">' +
        '<td class="col-key">' + esc(entry.key) + '</td>' +
        '<td class="col-value' + maskedCls + '">' + dv + '</td>' +
        '<td class="col-actions">' +
          '<span class="actions-wrap">' +
            '<button class="btn btn-sm btn-edit" data-key="' + escAttr(entry.key) + '" data-value="' + escAttr(entry.value) + '">Edit</button>' +
            '<button class="btn btn-sm btn-danger btn-del" data-key="' + escAttr(entry.key) + '">Delete</button>' +
          '</span>' +
        '</td></tr>';
    }
    tableBody.innerHTML = html;
  }

  document.querySelector('th[data-sort="key"]').addEventListener('click', function() {
    if (sortCol !== 'key') {
      sortCol = 'key';
      sortAsc = true;
    } else if (sortAsc) {
      sortAsc = false;
    } else {
      sortCol = null;
    }
    renderTable();
  });

  searchInput.addEventListener('input', function(e) {
    searchQuery = e.target.value;
    renderTable();
  });

  document.getElementById('lockBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'toggleLock' });
  });

  document.getElementById('addBtn').addEventListener('click', function() {
    showAddDialog();
  });

  document.getElementById('exitModeBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'toggleMode' });
  });

  document.getElementById('bmcBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'openBMC' });
  });

  tableBody.addEventListener('click', function(e) {
    var target = e.target;
    if (target.classList.contains('btn-edit')) {
      showEditDialog(target.getAttribute('data-key'), target.getAttribute('data-value'));
    }
    if (target.classList.contains('btn-del')) {
      showDeleteDialog(target.getAttribute('data-key'));
    }
  });

  window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'updateState') {
      isLocked = msg.locked;
      searchQuery = msg.searchQuery || '';
      searchInput.value = searchQuery;
      updateLockUI();
      renderTable();
    } else if (msg.type === 'updateData') {
      entries = msg.entries;
      sections = msg.sections;
      countInfo.textContent = msg.count + ' key' + (msg.count !== 1 ? 's' : '');
      renderTable();
    }
  });

  function createOverlay(html) {
    var overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    return overlay;
  }

  function showAddDialog() {
    var overlay = createOverlay(
      '<div class="dialog">' +
        '<div class="dialog-title">Add Key</div>' +
        '<label class="dialog-label">Key</label>' +
        '<input class="dialog-input" id="addKey" type="text" placeholder="KEY_NAME" />' +
        '<label class="dialog-label">Value</label>' +
        '<input class="dialog-input" id="addVal" type="text" placeholder="value" />' +
        '<div class="dialog-actions">' +
          '<button class="btn" id="addCancel">Cancel</button>' +
          '<button class="btn btn-primary" id="addOk">Add</button>' +
        '</div>' +
      '</div>'
    );
    document.getElementById('addKey').focus();
    document.getElementById('addOk').addEventListener('click', function() {
      var k = document.getElementById('addKey').value.trim();
      var v = document.getElementById('addVal').value;
      if (k) {
        vscode.postMessage({ type: 'add', key: k, value: v });
      }
      overlay.remove();
    });
    document.getElementById('addCancel').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') document.getElementById('addOk').click();
      if (e.key === 'Escape') overlay.remove();
    });
  }

  function showEditDialog(key, currentValue) {
    var overlay = createOverlay(
      '<div class="dialog">' +
        '<div class="dialog-title">Edit: ' + esc(key) + '</div>' +
        '<label class="dialog-label">Key</label>' +
        '<input class="dialog-input" id="editKey" type="text" value="' + escAttr(key) + '" />' +
        '<label class="dialog-label">Value</label>' +
        '<input class="dialog-input" id="editVal" type="text" value="' + escAttr(currentValue) + '" />' +
        '<div class="dialog-actions">' +
          '<button class="btn" id="editCancel">Cancel</button>' +
          '<button class="btn btn-primary" id="editOk">Save</button>' +
        '</div>' +
      '</div>'
    );
    var keyInput = document.getElementById('editKey');
    var valInput = document.getElementById('editVal');
    keyInput.focus();
    keyInput.select();
    document.getElementById('editOk').addEventListener('click', function() {
      var nk = keyInput.value.trim();
      var nv = valInput.value;
      if (nk) {
        if (nk !== key) {
          vscode.postMessage({ type: 'editKeyValue', oldKey: key, key: nk, value: nv });
        } else {
          vscode.postMessage({ type: 'edit', key: key, newValue: nv });
        }
      }
      overlay.remove();
    });
    document.getElementById('editCancel').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') document.getElementById('editOk').click();
      if (e.key === 'Escape') overlay.remove();
    });
  }

  function showDeleteDialog(key) {
    var overlay = createOverlay(
      '<div class="dialog">' +
        '<div class="dialog-title">Delete Key</div>' +
        '<p style="font-size:12px;color:var(--muted);margin-bottom:8px;">Are you sure you want to delete <strong>' + esc(key) + '</strong>?</p>' +
        '<div class="dialog-actions">' +
          '<button class="btn" id="delCancel">Cancel</button>' +
          '<button class="btn btn-danger" id="delOk">Delete</button>' +
        '</div>' +
      '</div>'
    );
    document.getElementById('delOk').addEventListener('click', function() {
      vscode.postMessage({ type: 'delete', key: key });
      overlay.remove();
    });
    document.getElementById('delCancel').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') document.getElementById('delOk').click();
      if (e.key === 'Escape') overlay.remove();
    });
    document.getElementById('delOk').focus();
  }

  updateLockUI();
  searchInput.value = searchQuery;
  renderTable();
</script>
</body>
</html>`;
  }
}
