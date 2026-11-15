import { readSetting, writeSetting, onSettingChangedElsewhere } from './storage.js';

// Auto-saves the document and its language to localStorage, so a reload or a closed tab
// never loses work. Saves are debounced while typing and flushed when the page is hidden.

const CONTENT = 'content';
const LANGUAGE = 'language';
const SAVE_DELAY_MS = 400;

/** The last saved document, or defaults for a first visit. */
export function loadDocument({ languages, defaultLanguage }) {
  const language = readSetting(LANGUAGE);
  return {
    value: readSetting(CONTENT) ?? '',
    language: languages.includes(language) ? language : defaultLanguage
  };
}

/**
 * @param {typeof import('monaco-editor')} monaco
 * @param {import('monaco-editor').editor.IStandaloneCodeEditor} editor
 * @param {{ languages: string[], onSaveFailed: () => void, onSaveRecovered: () => void }} options
 */
export function enableAutoSave(monaco, editor, { languages, onSaveFailed, onSaveRecovered }) {
  let timer = null;
  let failing = false;
  let applyingRemoteChange = false;

  const save = () => {
    clearTimeout(timer);
    timer = null;
    const model = editor.getModel();
    if (!model) return;
    const saved = writeSetting(CONTENT, model.getValue()) && writeSetting(LANGUAGE, model.getLanguageId());
    if (!saved && !failing) onSaveFailed();
    if (saved && failing) onSaveRecovered();
    failing = !saved;
  };

  const scheduleSave = () => {
    if (applyingRemoteChange) return;
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  };

  const flush = () => {
    if (timer) save();
  };

  editor.onDidChangeModelContent(scheduleSave);
  editor.onDidChangeModelLanguage(() => {
    if (!applyingRemoteChange) save();
  });

  // Timers don't run once a page is being unloaded, so save pending edits right away.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  // Another tab saved: adopt its document instead of overwriting it with ours later.
  onSettingChangedElsewhere(CONTENT, (value) => {
    const model = editor.getModel();
    if (!model || value === null || value === model.getValue()) return;
    clearTimeout(timer);
    timer = null;
    applyingRemoteChange = true;
    try {
      // An undoable edit (unlike setValue) that keeps this tab's cursor where it was.
      editor.pushUndoStop();
      editor.executeEdits('sync-from-other-tab', [{ range: model.getFullModelRange(), text: value }], editor.getSelections());
      editor.pushUndoStop();
    } finally {
      applyingRemoteChange = false;
    }
  });

  onSettingChangedElsewhere(LANGUAGE, (language) => {
    const model = editor.getModel();
    if (!model || !languages.includes(language) || language === model.getLanguageId()) return;
    applyingRemoteChange = true;
    try {
      monaco.editor.setModelLanguage(model, language);
    } finally {
      applyingRemoteChange = false;
    }
  });
}
