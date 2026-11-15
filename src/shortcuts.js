export function registerShortcuts(monaco, editor) {
  // VS Code binds Format Document to Shift+Alt+F, except on Linux where the default is
  // Ctrl+Shift+I, which browsers reserve for DevTools. Make Shift+Alt+F work everywhere.
  monaco.editor.addKeybindingRule({
    keybinding: monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
    command: 'editor.action.formatDocument',
    when: 'editorTextFocus && !editorReadonly'
  });

  // Ctrl/Cmd+Shift+P opens the Command Palette instead of the browser's print/private-window shortcut.
  window.addEventListener('keydown', (e) => {
    if (e.isComposing || !(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return;
    // `code` is layout-independent, so this also works with non-Latin keyboard layouts.
    if (e.code === 'KeyP' || e.key.toLowerCase() === 'p') {
      e.preventDefault();
      editor.focus();
      editor.trigger('keyboard', 'editor.action.quickCommand', null);
    }
  }, { capture: true });
}
