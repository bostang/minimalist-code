/**
 * Bottom-right language picker, kept in sync with "Change Language Mode" in the Command Palette.
 */
export function initLanguageSelector(monaco, editor, selectElement, preferredOrder) {
  const langMap = new Map(monaco.languages.getLanguages().map((l) => [l.id, l]));

  preferredOrder.forEach((id) => {
    const lang = langMap.get(id);
    if (!lang) return;
    const opt = document.createElement('option');
    opt.value = lang.id;
    opt.textContent = lang.aliases?.[0] || lang.id;
    selectElement.appendChild(opt);
  });

  selectElement.value = editor.getModel().getLanguageId();

  selectElement.addEventListener('change', (e) => {
    monaco.editor.setModelLanguage(editor.getModel(), e.target.value);
    editor.focus();
  });

  editor.onDidChangeModelLanguage((e) => {
    selectElement.value = e.newLanguage;
  });
}

/**
 * Bottom-left message area (announced to screen readers).
 * @param {HTMLElement} element
 */
export function createStatusMessage(element) {
  let timer = null;

  const clear = () => {
    clearTimeout(timer);
    element.textContent = '';
    element.classList.remove('is-error');
  };

  /**
   * @param {string} text
   * @param {{ error?: boolean, timeout?: number }} [options] timeout 0 keeps the message until cleared
   */
  const show = (text, { error = false, timeout = 5000 } = {}) => {
    clear();
    element.textContent = text;
    element.classList.toggle('is-error', error);
    if (timeout > 0) timer = setTimeout(clear, timeout);
  };

  return { show, clear };
}
