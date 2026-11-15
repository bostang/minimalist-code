// localStorage wrapper that never throws. Storage can be disabled (blocked site data,
// some private modes) or full (QuotaExceededError); callers get null/false instead.
//
// Keep KEY_PREFIX in sync with the inline theme script in index.html.
const KEY_PREFIX = 'minimalist-code.';

export const storageKey = (name) => KEY_PREFIX + name;

export function readSetting(name) {
  try {
    return window.localStorage.getItem(storageKey(name));
  } catch {
    return null;
  }
}

/** @returns {boolean} whether the value was stored */
export function writeSetting(name, value) {
  try {
    window.localStorage.setItem(storageKey(name), value);
    return true;
  } catch {
    return false;
  }
}

/** Calls `listener(newValue)` when another tab changes the setting. */
export function onSettingChangedElsewhere(name, listener) {
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== window.localStorage) return;
    // `key` is null when another tab cleared all of storage.
    if (event.key === storageKey(name) || event.key === null) listener(event.newValue);
  });
}
