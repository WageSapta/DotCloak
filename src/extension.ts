import * as vscode from 'vscode';
import { WorkspaceStateManager } from './state';
import { InlineMaskingDecorator } from './decorator';
import { DotCloakCustomEditorProvider } from './providers/customEditor';
import { isEnvFile, addEntry, updateEntry, deleteEntry } from './parser';

/**
 * CodeLens provider for .env files.
 * Shows a button to switch to DotCloak mode when in plain text editor.
 */
class EnvFileCodeLensProvider implements vscode.CodeLensProvider {
  constructor(private readonly stateManager: WorkspaceStateManager) {}

  async provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
    // Only show for .env files that are in plain mode
    if (!isEnvFile(document.uri)) {
      return [];
    }

    const state = this.stateManager.getState();
    if (state.mode !== 'plain') {
      return [];
    }

    // Add a CodeLens at line 0 with a command to open in DotCloak mode
    const range = new vscode.Range(0, 0, 0, 0);
    const dotCloakCommand: vscode.CodeLens = new vscode.CodeLens(range, {
      title: 'DotCloak: Open in DotCloak Mode',
      command: 'dotcloak.openInDotCloak',
      arguments: [document.uri],
    });

    return [dotCloakCommand];
  }
}

let stateManager: WorkspaceStateManager;
let decorator: InlineMaskingDecorator;

export function activate(context: vscode.ExtensionContext) {
  // Initialize state manager
  stateManager = new WorkspaceStateManager(context);

  // Initialize providers
  decorator = new InlineMaskingDecorator(stateManager);
  const customEditorProvider = new DotCloakCustomEditorProvider(stateManager);

  // Register custom editor provider for .env files
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      DotCloakCustomEditorProvider.viewType,
      customEditorProvider
    )
  );

  // Auto-detect and load .env file
  stateManager.findEnvFile().then((uri) => {
    if (uri) {
      stateManager.loadEnvFile(uri).then(() => {
        decorator.updateAllEditors();
      });
    }
  });

  // Watch for .env files being opened
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (isEnvFile(doc.uri)) {
        stateManager.loadEnvFile(doc.uri).then(() => {
          decorator.updateAllEditors();
        });
      }
    })
  );

  // Listen to state changes and update decorations
  context.subscriptions.push(
    stateManager.onDidChange(() => {
      decorator.updateAllEditors();
    })
  );

  // Register all commands
  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.addKey', async () => {
      const envFile = stateManager.getCurrentEnvFile();
      if (!envFile) {
        vscode.window.showErrorMessage('No .env file loaded');
        return;
      }

      const key = await vscode.window.showInputBox({
        prompt: 'Enter environment variable key',
        placeHolder: 'API_KEY',
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Key cannot be empty';
          }
          if (!/^[A-Z_][A-Z0-9_]*$/i.test(value.trim())) {
            return 'Key must be a valid identifier (letters, numbers, underscores)';
          }
          if (envFile.entries.some(e => e.key === value.trim())) {
            return 'Key already exists';
          }
          return null;
        },
      });

      if (!key) return;

      const value = await vscode.window.showInputBox({
        prompt: `Enter value for ${key}`,
        placeHolder: 'your-secret-value',
      });

      if (value === undefined) return;

      // addEntry imported at top
      const updated = addEntry(envFile, key.trim(), value);
      await stateManager.setCurrentEnvFile(updated);
      vscode.window.showInformationMessage(`Added ${key}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.editKey', async (key?: string) => {
      const envFile = stateManager.getCurrentEnvFile();
      if (!envFile) {
        vscode.window.showErrorMessage('No .env file loaded');
        return;
      }

      // If no key provided, show quick pick
      if (!key) {
        const items = envFile.entries.map(e => ({
          label: e.key,
          description: e.value.substring(0, 20) + (e.value.length > 20 ? '...' : ''),
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select key to edit',
        });

        if (!selected) return;
        key = selected.label;
      }

      const entry = envFile.entries.find(e => e.key === key);
      if (!entry) return;

      const newKey = await vscode.window.showInputBox({
        prompt: 'Edit key name',
        value: entry.key,
      });

      if (!newKey) return;

      const newValue = await vscode.window.showInputBox({
        prompt: `Edit value for ${newKey}`,
        value: entry.value,
      });

      if (newValue === undefined) return;

      // updateEntry imported at top
      const updated = updateEntry(envFile, key, newKey.trim(), newValue);
      await stateManager.setCurrentEnvFile(updated);
      vscode.window.showInformationMessage(`Updated ${newKey}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.deleteKey', async (key?: string) => {
      const envFile = stateManager.getCurrentEnvFile();
      if (!envFile) {
        vscode.window.showErrorMessage('No .env file loaded');
        return;
      }

      // If no key provided, show quick pick
      if (!key) {
        const items = envFile.entries.map(e => ({
          label: e.key,
          description: e.value.substring(0, 20) + (e.value.length > 20 ? '...' : ''),
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select key to delete',
        });

        if (!selected) return;
        key = selected.label;
      }

      const confirmed = await vscode.window.showWarningMessage(
        `Delete ${key}?`,
        'Delete',
        'Cancel'
      );

      if (confirmed !== 'Delete') return;

      // deleteEntry imported at top
      const updated = deleteEntry(envFile, key);
      await stateManager.setCurrentEnvFile(updated);
      vscode.window.showInformationMessage(`Deleted ${key}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.toggleReveal', () => {
      decorator.revealTemporarily();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.copyKeys', async () => {
      const envFile = stateManager.getCurrentEnvFile();
      if (!envFile) {
        vscode.window.showErrorMessage('No .env file loaded');
        return;
      }

      const keys = envFile.entries.map(e => e.key).join('\n');
      await vscode.env.clipboard.writeText(keys);
      vscode.window.showInformationMessage(
        `Copied ${envFile.entries.length} keys to clipboard`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.exportMasked', async () => {
      const envFile = stateManager.getCurrentEnvFile();
      if (!envFile) {
        vscode.window.showErrorMessage('No .env file loaded');
        return;
      }

      const masked = envFile.lines.map((line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (!match) return line;

        const [, key, value] = match;

        // Don't mask comments or empty values
        if (value.trim().startsWith('#') || !value.trim()) {
          return line;
        }

        return `${key}=***`;
      });

      const doc = await vscode.workspace.openTextDocument({
        content: masked.join('\n'),
        language: 'env',
      });

      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage('Masked .env opened in editor');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.toggleMode', async () => {
      await stateManager.toggleMode();
      const mode = stateManager.getState().mode;
      vscode.window.showInformationMessage(
        `DotCloak ${mode === 'plain' ? 'disabled (plain mode)' : 'enabled'}`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.toggleLock', async () => {
      await stateManager.toggleLock();
      const locked = stateManager.getState().locked;
      vscode.window.showInformationMessage(
        `DotCloak ${locked ? 'locked' : 'unlocked'}`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.search', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search environment keys',
        placeHolder: 'Enter search term',
      });

      if (query === undefined) return;
      stateManager.setSearchQuery(query);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.refresh', async () => {
      const envFile = stateManager.getCurrentEnvFile();
      if (!envFile) {
        const uri = await stateManager.findEnvFile();
        if (uri) {
          await stateManager.loadEnvFile(uri);
        }
      } else {
        await stateManager.loadEnvFile(envFile.uri);
      }
      vscode.window.showInformationMessage('DotCloak refreshed');
    })
  );

  // Add the selectKey command referenced by tree view
  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.selectKey', (key: string) => {
      // When user clicks a key in the tree, show edit/delete options
      vscode.window.showQuickPick(
        [
          { label: '✏️ Edit', description: `Edit ${key}`, action: 'edit' },
          { label: '🗑️ Delete', description: `Delete ${key}`, action: 'delete' },
        ],
        { placeHolder: `What would you like to do with ${key}?` }
      ).then((selected) => {
        if (selected?.action === 'edit') {
          vscode.commands.executeCommand('dotcloak.editKey', key);
        } else if (selected?.action === 'delete') {
          vscode.commands.executeCommand('dotcloak.deleteKey', key);
        }
      });
    })
  );

  // Context menu commands for .env files
  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.openWithDotcloak', (uri: vscode.Uri) => {
      vscode.commands.executeCommand('vscode.openWith', uri, 'dotcloak.customEditor');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.openAsText', async (uri: vscode.Uri) => {
      await stateManager.setState({ locked: false, mode: 'plain' });
      await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
    })
  );

  // Register CodeLens provider for .env files
  const codeLensProvider = new EnvFileCodeLensProvider(stateManager);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ pattern: '**/.env*' }, codeLensProvider)
  );

  // Register dotcloak.openInDotCloak command
  context.subscriptions.push(
    vscode.commands.registerCommand('dotcloak.openInDotCloak', async (uri: vscode.Uri) => {
      // Set mode to dotcloak and open in DotCloak view
      await stateManager.setMode('dotcloak');
      await vscode.commands.executeCommand('vscode.openWith', uri, 'dotcloak.customEditor');
    })
  );

  // Push disposables
  context.subscriptions.push(stateManager, decorator);
}

export function deactivate() {
  // Cleanup handled by disposables
}
