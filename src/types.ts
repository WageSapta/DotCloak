import * as vscode from 'vscode';

export interface EnvEntry {
  key: string;
  value: string;
  comment?: string;
  line: number;
  start: number; // Start position in line
  end: number;   // End position in line
}

export interface EnvFile {
  uri: vscode.Uri;
  entries: EnvEntry[];
  rawContent: string;
  lines: string[];
}

export interface WorkspaceState {
  locked: boolean;
  mode: 'dotcloak' | 'plain';
}

