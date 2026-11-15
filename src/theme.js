import { readSetting, writeSetting, onSettingChangedElsewhere } from './storage.js';

// Light/dark theme. Until the user toggles, the theme follows the OS preference; after
// that their explicit choice is remembered. index.html applies the same logic in a tiny
// inline script before first paint, so the page never flashes the wrong colors.

const SETTING = 'theme';
const MONACO_THEMES = { dark: 'vs-dark', light: 'vs' };
const BROWSER_UI_COLORS = { dark: '#1e1e1e', light: '#ffffff' };

const systemLight = window.matchMedia?.('(prefers-color-scheme: light)');

const isTheme = (value) => value === 'light' || value === 'dark';
const systemTheme = () => (systemLight?.matches ? 'light' : 'dark');
const savedTheme = () => {
  const value = readSetting(SETTING);
  return isTheme(value) ? value : null;
};

export const getInitialTheme = () => savedTheme() ?? systemTheme();
export const toMonacoTheme = (theme) => MONACO_THEMES[theme];

/**
 * Wires the status bar toggle button and a Command Palette action to switch themes.
 * @param {typeof import('monaco-editor')} monaco
 * @param {import('monaco-editor').editor.IStandaloneCodeEditor} editor
 * @param {HTMLButtonElement} button
 */
export function initThemeToggle(monaco, editor, button) {
  let current = getInitialTheme();
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  const apply = (theme) => {
    current = theme;
    monaco.editor.setTheme(MONACO_THEMES[theme]);
    document.documentElement.dataset.theme = theme;
    themeColorMeta?.setAttribute('content', BROWSER_UI_COLORS[theme]);
    const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
    button.setAttribute('aria-label', label);
    button.title = label;
  };

  const toggle = () => {
    const next = current === 'dark' ? 'light' : 'dark';
    writeSetting(SETTING, next);
    apply(next);
  };

  apply(current);

  button.addEventListener('click', (event) => {
    toggle();
    // Mouse users go straight back to typing; keyboard users keep focus on the button.
    if (event.detail > 0) editor.focus();
  });

  editor.addAction({
    id: 'workbench.action.toggleLightDarkThemes',
    label: 'Preferences: Toggle Between Light/Dark Themes',
    run: toggle
  });

  // Follow OS changes until the user has made an explicit choice.
  systemLight?.addEventListener('change', () => {
    if (!savedTheme()) apply(systemTheme());
  });

  // Keep other open tabs in sync.
  onSettingChangedElsewhere(SETTING, () => apply(getInitialTheme()));
}
