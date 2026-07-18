# DotCloak — Secure .env File Editor

A VS Code extension for viewing and editing `.env` files with privacy and security as the default.

## Why this exists

`.env` files contain secrets — API keys, database URLs, tokens. Standard text editors leave them fully visible. DotCloak masks values by default so you can work without exposing credentials on screen, during screenshares, or in recordings.

## What it does

- **Opens `.env` files** in a custom editor with a table layout
- **Masks all values** (`***`) by default when locked
- **One-click unlock** to reveal values when you need them
- **Inline editing** — add, edit, rename, delete keys
- **Search & sort** keys client-side (nothing leaves your machine)
- **Section headers** from `# Comment` lines displayed as visual groups
- **Auto-lock on exit** — switching to plain text mode unlocks first so no stray masking leaks into your editor

## Security guarantees

| Concern | How DotCloak handles it |
|---|---|
| **Data sent to servers** | Never. All processing is local. No telemetry, no analytics, no network calls. The only external link is an optional Ko-fi button (donation). |
| **Secrets in screenshots/recordings** | Masked by default (`***`). Values only visible when explicitly unlocked. |
| **Credentials in editor chrome** | No sidebar, no tree view, no emoji — just a clean table. |
| **Accidental exposure during editing** | Lock mode prevents value visibility. Unlock is per-session and resets when switching files. |
| **Vendor lock-in** | DotCloak is open source (MIT). Your `.env` files stay standard — no custom format or metadata injected. |

## Usage

1. Open any `.env` file
2. If using the default text editor, click the **DotCloak: Open in DotCloak Mode** CodeLens above the editor
3. Or right-click the file → **Open with** → **DotCloak Custom Editor**
4. Use the toolbar to lock/unlock, add keys, or exit back to plain text

### Commands

| Command | Description |
|---|---|
| `DotCloak: Toggle Lock` | Switch between masked and visible values |
| `DotCloak: Add Key` | Add a new environment variable |
| `DotCloak: Edit Key` | Modify an existing key or its value |
| `DotCloak: Delete Key` | Remove an environment variable |
| `DotCloak: Search` | Filter the key table |
| `DotCloak: Toggle Mode` | Switch between DotCloak and plain text |
| `DotCloak: Refresh` | Reload the `.env` file from disk |

## Transparency

- **Open source** under the MIT License — review the code at [github.com/wagekusuma/dotcloak](https://github.com/wagekusuma/dotcloak)
- **No background processes** — the extension only activates when you open an `.env` file
- **No external requests** — except the Ko-fi button you explicitly click
- **No file modification** beyond what you explicitly edit through the UI

## License

MIT
