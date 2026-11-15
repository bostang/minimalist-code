import { monaco, createEditor } from './src/monaco-setup.js';
import { EDITOR_CONFIG } from './src/config.js';
import { PREFERRED_LANGUAGES, registerCustomLanguages } from './src/languages.js';
import { registerFormatters } from './src/formatters.js';
import { registerShortcuts } from './src/shortcuts.js';
import { initLanguageSelector, createStatusMessage } from './src/status-bar.js';
import { getInitialTheme, initThemeToggle, toMonacoTheme } from './src/theme.js';
import { loadDocument, enableAutoSave } from './src/persistence.js';

function start() {
  const status = createStatusMessage(document.getElementById('status-message'));

  registerCustomLanguages();
  registerFormatters(monaco, {
    onError: (message) => status.show(message, { error: true, timeout: 8000 })
  });

  const saved = loadDocument({ languages: PREFERRED_LANGUAGES, defaultLanguage: EDITOR_CONFIG.defaultLanguage });
  const editor = createEditor(document.getElementById('editor'), {
    ...saved,
    theme: toMonacoTheme(getInitialTheme())
  });

  registerShortcuts(monaco, editor);
  initLanguageSelector(monaco, editor, document.getElementById('lang-select'), PREFERRED_LANGUAGES);
  initThemeToggle(monaco, editor, document.getElementById('theme-toggle'));
  enableAutoSave(monaco, editor, {
    languages: PREFERRED_LANGUAGES,
    onSaveFailed: () =>
      status.show('Not saved: browser storage is full or blocked. Copy your work somewhere safe.', { error: true, timeout: 0 }),
    onSaveRecovered: () => status.show('Saved')
  });

  editor.focus();
}

try {
  start();
} catch (err) {
  console.error(err);
  const message = document.createElement('p');
  message.className = 'fatal-error';
  message.textContent = 'The editor failed to start. Please reload the page or try an up-to-date browser.';
  document.getElementById('editor').replaceChildren(message);
}
