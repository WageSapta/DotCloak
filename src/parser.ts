import * as vscode from 'vscode';
import { EnvEntry, EnvFile } from './types';

// Matches .env files: .env, .env.local, .env.development, .env.production, .env.example, etc.
const ENV_FILE_PATTERNS = [
  /\.env$/,
  /\.env\.\w+$/,
];

/**
 * Check if a given filename is an .env file.
 */
export function isEnvFile(uri: vscode.Uri): boolean {
  const fileName = uri.fsPath.split('/').pop() || '';
  return ENV_FILE_PATTERNS.some(pattern => pattern.test(fileName));
}

/**
 * Parse .env file content into structured entries.
 * Supports:
 *   - KEY=VALUE
 *   - KEY="quoted value"
 *   - KEY='single quoted'
 *   - KEY=value # inline comment
 *   - # comment lines
 *   - export KEY=VALUE
 *   - empty lines
 */
export function parseEnvContent(content: string, uri: vscode.Uri): EnvFile {
  const lines = content.split('\n');
  const entries: EnvEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE (with optional export)
    const exportPrefix = 'export ';
    let parseLine = trimmed;
    if (parseLine.startsWith(exportPrefix)) {
      parseLine = parseLine.slice(exportPrefix.length);
    }

    const eqIndex = parseLine.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = parseLine.slice(0, eqIndex).trim();
    let value = parseLine.slice(eqIndex + 1).trim();
    let comment: string | undefined;

    // Extract inline comment (not inside quotes)
    let inlineCommentIdx = -1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let j = 0; j < value.length; j++) {
      const ch = value[j];
      if (ch === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (ch === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      } else if (ch === '#' && !inSingleQuote && !inDoubleQuote && j > 0 && value[j - 1] === ' ') {
        inlineCommentIdx = j;
        break;
      }
    }

    if (inlineCommentIdx !== -1) {
      comment = value.slice(inlineCommentIdx).trim();
      value = value.slice(0, inlineCommentIdx).trim();
    }

    // Remove surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries.push({
      key,
      value,
      comment,
      line: i,
      start: line.indexOf(key),
      end: line.length,
    });
  }

  return { uri, entries, rawContent: content, lines };
}

/**
 * Rebuild .env file content from entries.
 * Preserves comments and empty lines, rewrites values at their positions.
 */
export function rebuildEnvContent(envFile: EnvFile): string {
  const lines = [...envFile.lines];

  for (const entry of envFile.entries) {
    const originalLine = lines[entry.line];
    const prefix = originalLine.slice(0, originalLine.indexOf(entry.key));
    const keyPart = entry.key;
    const newValue = entry.value;

    // Preserve inline comment if existed
    let commentPart = '';
    if (entry.comment) {
      commentPart = ` # ${entry.comment}`;
    }

    lines[entry.line] = `${prefix}${keyPart}=${newValue}${commentPart}`;
  }

  return lines.join('\n');
}

/**
 * Add a new key-value pair to the entries.
 */
export function addEntry(envFile: EnvFile, key: string, value: string): EnvFile {
  const newLine = envFile.lines.length;
  const newLineContent = `${key}=${value}`;
  const entries = [...envFile.entries, {
    key,
    value,
    line: newLine,
    start: 0,
    end: newLineContent.length,
  }];
  const lines = [...envFile.lines, newLineContent];

  return { ...envFile, entries, lines };
}

/**
 * Update an existing entry's key and/or value.
 */
export function updateEntry(
  envFile: EnvFile,
  oldKey: string,
  newKey: string,
  newValue: string,
): EnvFile {
  const entry = envFile.entries.find(e => e.key === oldKey);
  if (!entry) {
    return envFile;
  }

  const updatedEntries = envFile.entries.map(e =>
    e.key === oldKey ? { ...e, key: newKey, value: newValue } : e,
  );

  const originalLine = envFile.lines[entry.line];
  const prefix = originalLine.slice(0, originalLine.indexOf(oldKey));
  let commentPart = '';
  if (entry.comment) {
    commentPart = ` # ${entry.comment}`;
  }

  const updatedLines = [...envFile.lines];
  updatedLines[entry.line] = `${prefix}${newKey}=${newValue}${commentPart}`;

  return { ...envFile, entries: updatedEntries, lines: updatedLines };
}

/**
 * Delete an entry.
 */
export function deleteEntry(envFile: EnvFile, key: string): EnvFile {
  const entry = envFile.entries.find(e => e.key === key);
  if (!entry) {
    return envFile;
  }

  const updatedLines = [...envFile.lines];
  updatedLines[entry.line] = '';

  return {
    ...envFile,
    entries: envFile.entries.filter(e => e.key !== key),
    lines: updatedLines,
  };
}
