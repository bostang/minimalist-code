import * as monaco from 'monaco-core';
import EditorWorker from 'monaco-vs/editor/editor.worker.js?worker';
import { EDITOR_CONFIG } from './config.js';

// Core editor UI & keyboard shortcuts
import 'monaco-vs/base/browser/ui/codicons/codicon/codicon.css';
import 'monaco-vs/editor/browser/coreCommands.js';
import 'monaco-vs/editor/browser/widget/codeEditor/codeEditorWidget.js';
import 'monaco-vs/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-vs/editor/contrib/caretOperations/browser/caretOperations.js';
import 'monaco-vs/editor/contrib/caretOperations/browser/transpose.js';
import 'monaco-vs/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-vs/editor/contrib/comment/browser/comment.js';
import 'monaco-vs/editor/contrib/contextmenu/browser/contextmenu.js';
import 'monaco-vs/editor/contrib/cursorUndo/browser/cursorUndo.js';
import 'monaco-vs/editor/contrib/dnd/browser/dnd.js';
import 'monaco-vs/editor/contrib/dropOrPasteInto/browser/copyPasteContribution.js';
import 'monaco-vs/editor/contrib/dropOrPasteInto/browser/dropIntoEditorContribution.js';
import 'monaco-vs/features/find/register.js';
import 'monaco-vs/editor/contrib/find/browser/findController.js';
import 'monaco-vs/editor/contrib/fontZoom/browser/fontZoom.js';
import 'monaco-vs/editor/contrib/format/browser/formatActions.js';
import 'monaco-vs/editor/contrib/indentation/browser/indentation.js';
import 'monaco-vs/editor/contrib/inPlaceReplace/browser/inPlaceReplace.js';
import 'monaco-vs/editor/contrib/insertFinalNewLine/browser/insertFinalNewLine.js';
import 'monaco-vs/editor/contrib/lineSelection/browser/lineSelection.js';
import 'monaco-vs/editor/contrib/linesOperations/browser/linesOperations.js';
import 'monaco-vs/editor/contrib/multicursor/browser/multicursor.js';
import 'monaco-vs/editor/contrib/smartSelect/browser/smartSelect.js';
import 'monaco-vs/editor/contrib/tokenization/browser/tokenization.js';
import 'monaco-vs/editor/contrib/wordHighlighter/browser/wordHighlighter.js';
import 'monaco-vs/editor/contrib/wordOperations/browser/wordOperations.js';
import 'monaco-vs/editor/contrib/wordPartOperations/browser/wordPartOperations.js';
import 'monaco-vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js';
import 'monaco-vs/editor/common/standaloneStrings.js';

// The generic editor worker (no language services). Monaco uses it to turn a formatter's
// whole-document edit into minimal edits, so the cursor, selections and undo history survive
// formatting. It is a separate file that is only downloaded the first time it is needed.
self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  }
};

/**
 * @param {HTMLElement} container
 * @param {{ value: string, language: string, theme: string }} initial
 */
export function createEditor(container, { value, language, theme }) {
  return monaco.editor.create(container, {
    value,
    language,
    theme,
    ariaLabel: 'Code editor',
    tabSize: EDITOR_CONFIG.tabSize,
    insertSpaces: EDITOR_CONFIG.insertSpaces,
    detectIndentation: false,
    automaticLayout: true,
    minimap: { enabled: false },
    folding: false,
    links: false,
    renderValidationDecorations: 'off'
  });
}

export { monaco };