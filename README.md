# Minimalist Code

A lightweight, self-hosted VS Code editing canvas powered by **Monaco Editor**. Built for speed and simplicity—it strips away the file explorer, integrated terminal, extension host, and ~10 MB of background language workers, leaving only the authentic VS Code text canvas, syntax highlighting, document formatters, and keyboard shortcuts.

## Features

- **Lightweight Bundle:** Excludes heavy TS/HTML/CSS/JSON language workers and 70+ unused grammars. The production build is ~0.8 MB gzipped for the editor core, plus small per-language chunks.
- **9 Supported Languages (Lazy-Loaded):**
  - `Plain Text`, `Markdown`, `Log` (custom tokenizer), `SQL`, `JSON` (zero-worker tokenizer), `Java`, `Python`, `JavaScript`, and `HTML`.
- **Quick Language Switcher:** VS Code-style status bar selector in the bottom-right corner (synced with the Command Palette).
- **Light / Dark Theme:** Toggle with the sun/moon button in the status bar or **Preferences: Toggle Between Light/Dark Themes** in the Command Palette. Follows your OS setting until you choose; your choice is remembered.
- **Built-In Document Formatters (`Shift+Alt+F`):** Zero-dependency formatters for `JSON`, `SQL`, `HTML`, `Java`, `JavaScript`, `Python`, and `Markdown`. They only change whitespace and layout: string and template-literal contents, number precision, key order, `<pre>`/`<textarea>` text and fenced code blocks are never altered. Invalid JSON is reported in the status bar with its line and column.
- **Browser Shortcut Protection:** Intercepts `Ctrl+Shift+P` so it opens the Command Palette instead of the browser's Print dialog.
- **Configurable Indentation:** Easily switch between 2-space and 4-space tabs via `src/config.js`.
- **Auto-Save Persistence:** Saves the document and its language to `localStorage` as you type, and restores them on reload. Open tabs stay in sync. If storage is full or blocked, the status bar warns you that your work is not being saved.

## Project Structure

```text
minimalist-code/
├── index.html               # App shell, theme colors, status bar layout
├── index.js                 # Main entry point wiring all modules
├── vite.config.mjs          # Vite config, Monaco ESM path aliases, Content-Security-Policy
├── firebase.json            # Firebase Hosting: headers, caching, predeploy build
├── .firebaserc              # Firebase project ID
├── package.json
├── public/                  # Icons and web app manifest (copied as-is)
├── test/
│   └── formatters.test.js   # Formatter unit tests (node --test)
└── src/
    ├── config.js            # User settings (tabSize, insertSpaces, defaultLanguage)
    ├── monaco-setup.js      # Core Monaco imports, editor worker, editor factory
    ├── languages.js         # Built-in grammars and custom JSON/Log tokenizers
    ├── formatters.js        # Document formatting providers (Shift+Alt+F)
    ├── shortcuts.js         # Keyboard overrides (Ctrl+Shift+P, Shift+Alt+F)
    ├── status-bar.js        # Language dropdown and status messages
    ├── theme.js             # Light/dark theme toggle
    ├── persistence.js       # Auto-save and cross-tab sync
    └── storage.js           # localStorage wrapper that never throws
```

## Getting Started

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
```

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Start the dev server with hot reload |
| `npm test` | Run the formatter unit tests |
| `npm run build` | Build the production bundle into `dist/` |
| `npm run preview` | Serve `dist/` locally at `http://localhost:4173` |

### Optional: Run as a Standalone Desktop App
To prevent your browser from intercepting shortcuts like `Ctrl+W`, `Ctrl+N`, or `Ctrl+T`:
1. Open the app in Chrome or Edge.
2. Click the browser menu (`⋮`) → **Cast, save, and share** → **Install page as app** (or **Create shortcut** → check **Open as window**).

## Deploying

Live site: **https://minimalist-code-2bf77.web.app** (Firebase Hosting, project `minimalist-code-2bf77`).

### Firebase Hosting

The Firebase CLI is a pinned dev dependency, so no global install is needed. Sign in once per machine:

```bash
npx firebase login
```

| Command | What it does |
| :--- | :--- |
| `npm run deploy:preview` | Deploy to a temporary preview URL (expires after 7 days) to check a release first |
| `npm run deploy` | Deploy to the live site |

Both run the tests and a fresh production build first (the `predeploy` hook in `firebase.json`), so a failing test stops the deploy. `firebase.json` also sets the security headers and caching rules listed below. To roll back, use **Hosting → Release history** in the Firebase console.

No secrets or `.env` file are needed: the app uses no Firebase SDK, and the CLI keeps your login in your user profile, outside the repo. The project ID in `.firebaserc` is public (it is part of the site URL).

### Any other static host

`npm run build` produces a fully static site in `dist/`. Upload it to any static host (Netlify, Cloudflare Pages, GitHub Pages, S3 + CloudFront, nginx, …). Asset URLs are relative, so it also works from a sub-path such as `https://example.com/editor/`. Serve it over HTTPS.

The build already includes:

- A strict **Content-Security-Policy** `<meta>` tag (scripts only from the site itself, plus the hash of the inline theme script). Styles allow `'unsafe-inline'` because Monaco injects styles at runtime.
- **`third-party-licenses.md`** with the license notices of the bundled libraries (Monaco is MIT-licensed and requires its notice to be distributed).

Some protections can only be sent as HTTP headers (`firebase.json` already sets these for Firebase). Configure them on other hosts:

```text
X-Frame-Options: DENY
Content-Security-Policy: frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Recommended caching: files under `assets/` have content hashes in their names, so serve them with `Cache-Control: public, max-age=31536000, immutable`; serve `index.html` with `Cache-Control: no-cache` so users get new releases immediately.

Documents are stored only in the visitor's browser (`localStorage`); nothing is sent to a server.

## Configuration

Edit `src/config.js` to customize editor defaults, then rebuild with `npm run build`:

```javascript
export const EDITOR_CONFIG = {
  tabSize: 4,          // Set to 2 or 4 (default: 4)
  insertSpaces: true,  // true = spaces, false = hard tabs (\t)
  defaultLanguage: 'plaintext'
};
```

Formatters use the editor's current indentation, so changing it at runtime from the Command Palette (**Indent Using Spaces**, **Change Tab Display Size**) also applies to formatting.

## Useful Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl+Shift+P` or `F1` | Open Command Palette |
| `Shift+Alt+F` | Format Document (on Linux, `Ctrl+Shift+I` also works) |
| `Ctrl+F` / `Ctrl+H` | Find / Replace |
| `Ctrl+D` | Select Next Occurrence (Multi-cursor) |
| `Alt+Click` | Insert Additional Cursor |
| `Ctrl+/` | Toggle Line Comment |
| `Alt+Up` / `Alt+Down` | Move Line Up / Down |
| `Shift+Alt+Down` | Duplicate Line Down |
| `Ctrl+Shift+K` | Delete Line |
| `Ctrl++` / `Ctrl+-` | Zoom Editor Font In / Out |
