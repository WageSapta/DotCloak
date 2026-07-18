import * as vscode from 'vscode';
import { WorkspaceStateManager } from './state';
import { isEnvFile } from './parser';

/**
 * Manages inline masking decorations for .env files.
 * Replaces values with *** when locked, reveals them when unlocked.
 */
export class InlineMaskingDecorator implements vscode.Disposable {
  private readonly decorationType: vscode.TextEditorDecorationType;
  private readonly disposables: vscode.Disposable[] = [];
  private revealTimer: NodeJS.Timeout | undefined;

  constructor(private readonly stateManager: WorkspaceStateManager) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      // Hide the actual text
      letterSpacing: '-0.5ch',
      // Show *** instead
      after: {
        contentText: '***',
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
      },
    });

    // Listen to state changes
    this.disposables.push(
      stateManager.onDidChange(() => this.updateAllEditors()),
    );

    // Listen to active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.updateAllEditors()),
    );

    // Listen to document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === e.document) {
          this.updateEditor(editor);
        }
      }),
    );
  }

  /**
   * Apply masking decorations to all visible .env editors.
   */
  updateAllEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateEditor(editor);
    }
  }

  /**
   * Apply masking to a specific editor.
   */
  updateEditor(editor: vscode.TextEditor): void {
    if (!isEnvFile(editor.document.uri)) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const state = this.stateManager.getState();

    // If plain mode or unlocked, show everything
    if (state.mode === 'plain' || !state.locked) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const envFile = this.stateManager.getCurrentEnvFile();
    if (!envFile) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const decorations: vscode.DecorationOptions[] = [];

    for (const entry of envFile.entries) {
      // Bounds check - file may have been modified externally
      if (entry.line >= editor.document.lineCount) {
        continue;
      }

      const line = editor.document.lineAt(entry.line);
      const lineText = line.text;

      // Find the value position in the line
      const eqIndex = lineText.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }

      const valueStart = eqIndex + 1;
      const valueEnd = lineText.length;

      // Skip empty values
      if (valueStart >= valueEnd) {
        continue;
      }

      // Check if value is a comment
      const afterEq = lineText.slice(valueStart).trim();
      if (afterEq.startsWith('#')) {
        continue;
      }

      const range = new vscode.Range(
        new vscode.Position(entry.line, valueStart),
        new vscode.Position(entry.line, valueEnd),
      );

      decorations.push({ range });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  /**
   * Reveal values for 60 seconds (called from webview).
   */
  revealTemporarily(): void {
    const state = this.stateManager.getState();
    if (!state.locked) {
      return; // Already unlocked
    }

    // Temporarily unlock
    this.stateManager.setState({ locked: false });

    // Clear any existing timer
    if (this.revealTimer) {
      clearTimeout(this.revealTimer);
    }

    // Re-lock after 60 seconds
    this.revealTimer = setTimeout(() => {
      this.stateManager.setState({ locked: true });
      this.revealTimer = undefined;
    }, 60_000);
  }

  dispose(): void {
    if (this.revealTimer) {
      clearTimeout(this.revealTimer);
      this.revealTimer = undefined;
    }
    this.decorationType.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
