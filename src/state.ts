import * as vscode from 'vscode';
import { EnvFile, WorkspaceState } from './types';
import { parseEnvContent, rebuildEnvContent, isEnvFile } from './parser';

const STATE_KEY = 'dotcloak.workspaceState';
const DEFAULT_STATE: WorkspaceState = {
  locked: true,
  mode: 'dotcloak',
};

export class WorkspaceStateManager implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  public readonly onDidChange = this._onDidChange.event;

  private currentEnvFile: EnvFile | undefined;
  private envFileUri: vscode.Uri | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private searchQuery = '';
  private cachedState: WorkspaceState;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.cachedState = context.workspaceState.get<WorkspaceState>(STATE_KEY, DEFAULT_STATE);

    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/.env*');
    this.disposables.push(fileWatcher);
    this.disposables.push(
      fileWatcher.onDidChange(uri => this.onFileChanged(uri)),
      fileWatcher.onDidCreate(uri => this.onFileChanged(uri)),
      fileWatcher.onDidDelete(uri => this.onFileDeleted(uri)),
    );
  }

  getState(): WorkspaceState {
    return this.cachedState;
  }

  async setState(partial: Partial<WorkspaceState>): Promise<void> {
    this.cachedState = { ...this.cachedState, ...partial };
    await this.context.workspaceState.update(STATE_KEY, this.cachedState);
    this._onDidChange.fire();
  }

  /**
   * Toggle lock state.
   */
  async toggleLock(): Promise<void> {
    const state = this.getState();
    await this.setState({ locked: !state.locked });
  }

  /**
   * Toggle mode between dotcloak and plain.
   */
  async toggleMode(): Promise<void> {
    const state = this.getState();
    await this.setState({ mode: state.mode === 'dotcloak' ? 'plain' : 'dotcloak' });
  }

  /**
   * Set mode explicitly.
   */
  async setMode(mode: 'dotcloak' | 'plain'): Promise<void> {
    await this.setState({ mode });
  }

  /**
   * Load and parse an .env file. Returns the parsed structure.
   */
  async loadEnvFile(uri: vscode.Uri): Promise<EnvFile | undefined> {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const content = doc.getText();
      this.envFileUri = uri;
      this.currentEnvFile = parseEnvContent(content, uri);
      return this.currentEnvFile;
    } catch {
      return undefined;
    }
  }

  /**
   * Get the currently loaded .env file (if any).
   */
  getCurrentEnvFile(): EnvFile | undefined {
    return this.currentEnvFile;
  }

  /**
   * Write the current envFile back to disk.
   */
  async writeCurrentFile(): Promise<void> {
    if (!this.envFileUri || !this.currentEnvFile) {
      return;
    }

    const newContent = rebuildEnvContent(this.currentEnvFile);
    const bytes = new TextEncoder().encode(newContent);

    await vscode.workspace.fs.writeFile(this.envFileUri, bytes);
  }

  /**
   * Replace the current envFile (e.g., after CRUD operations) and write.
   */
  async setCurrentEnvFile(envFile: EnvFile): Promise<void> {
    this.currentEnvFile = envFile;
    this.envFileUri = envFile.uri;
    await this.writeCurrentFile();
  }

  /**
   * Search query for filtering keys in TreeView.
   */
  getSearchQuery(): string {
    return this.searchQuery;
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this._onDidChange.fire();
  }

  /**
   * Auto-detect the first .env file in the workspace.
   */
  async findEnvFile(): Promise<vscode.Uri | undefined> {
    const files = await vscode.workspace.findFiles(
      '**/.env*',
      '**/node_modules/**',
      10,
    );

    // Prefer exact `.env`, then `.env.local`, then others
    const envFile = files.find(f => f.fsPath.endsWith('/.env'));
    if (envFile) {
      return envFile;
    }

    const localFile = files.find(f => f.fsPath.endsWith('/.env.local'));
    if (localFile) {
      return localFile;
    }

    return files.find(f => isEnvFile(f));
  }

  private async onFileChanged(uri: vscode.Uri): Promise<void> {
    if (!isEnvFile(uri)) {
      return;
    }

    // Only reload if it's the currently tracked file
    if (this.envFileUri && uri.fsPath === this.envFileUri.fsPath) {
      await this.loadEnvFile(uri);
      this._onDidChange.fire();
    }
  }

  private onFileDeleted(uri: vscode.Uri): void {
    if (this.envFileUri && uri.fsPath === this.envFileUri.fsPath) {
      this.currentEnvFile = undefined;
      this.envFileUri = undefined;
      this._onDidChange.fire();
    }
  }

  dispose(): void {
    this._onDidChange.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
