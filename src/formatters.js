import { EDITOR_CONFIG } from './config.js';

/**
 * Zero-dependency document formatters (Shift+Alt+F).
 *
 * Every formatter only changes whitespace/layout. Anything with meaning — string and
 * template-literal contents, numbers, key order, <pre>/<textarea> text, fenced code — is
 * emitted verbatim, so formatting can never change what a program or document does.
 *
 * The pure `format*` functions are exported for unit tests (see test/formatters.test.js).
 */

/** A document that cannot be formatted. The message is shown to the user in the status bar. */
export class FormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FormatError';
  }
}

export function indentUnit({ insertSpaces, tabSize }) {
  return insertSpaces ? ' '.repeat(tabSize) : '\t';
}

const DEFAULT_INDENT = indentUnit(EDITOR_CONFIG);

const splitLines = (text) => text.split(/\r?\n/);
const endsWithNewline = (text) => /\n$/.test(text);

// ---------------------------------------------------------------------------
// Brace languages: JavaScript, Java (and CSS inside HTML <style> blocks)
// ---------------------------------------------------------------------------

const OPENERS = '{[(';
const CLOSERS = '}])';
// A `/` after one of these (or at the start of a line) begins a regex literal, not a division.
const REGEX_PRECEDERS = new Set('(,=:[!&|?{};+-*%<>~^'.split(''));
const REGEX_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await'
]);

/**
 * Re-indents code by bracket nesting. The scanner understands strings, comments, JS template
 * literals and regexes, and Java text blocks, so brackets inside them don't count and lines
 * that start inside a multi-line string are left untouched.
 *
 * @param {string} text
 * @param {string} unit one level of indentation
 * @param {'javascript'|'java'|'css'} language
 * @param {string} baseIndent prefix for every re-indented line (used for <script>/<style>)
 */
export function formatBraceLanguage(text, unit = DEFAULT_INDENT, language = 'javascript', baseIndent = '') {
  const isJs = language === 'javascript';
  const isJava = language === 'java';
  const hasLineComments = language !== 'css';

  // Indentation level of the line on which each still-open bracket was opened.
  const stack = [];
  // 'code' | 'block-comment' | 'template' (JS `...`) | 'text-block' (Java """...""")
  let mode = 'code';
  // Brace depth inside each open `${ ... }` template expression.
  const templateExprDepth = [];

  const nextLevel = () => (stack.length ? stack[stack.length - 1] + 1 : 0);

  function skipString(line, start, quote) {
    for (let j = start + 1; j < line.length; j++) {
      if (line[j] === '\\') j++;
      else if (line[j] === quote) return j;
    }
    return line.length - 1;
  }

  function skipRegex(line, start) {
    let inClass = false;
    for (let j = start + 1; j < line.length; j++) {
      const c = line[j];
      if (c === '\\') j++;
      else if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) {
        while (/[a-z]/i.test(line[j + 1] ?? '')) j++;
        return j;
      }
    }
    return line.length - 1;
  }

  function scanLine(line, level) {
    let last = ''; // previous significant token: a punctuation char, a keyword, or 'w' (value)
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (mode === 'block-comment') {
        const end = line.indexOf('*/', i);
        if (end === -1) return;
        mode = 'code';
        i = end + 1;
        continue;
      }
      if (mode === 'template') {
        if (ch === '\\') i++;
        else if (ch === '`') { mode = 'code'; last = 'w'; }
        else if (ch === '$' && line[i + 1] === '{') { mode = 'code'; templateExprDepth.push(0); last = '{'; i++; }
        continue;
      }
      if (mode === 'text-block') {
        if (ch === '\\') i++;
        else if (line.startsWith('"""', i)) { mode = 'code'; last = 'w'; i += 2; }
        continue;
      }

      if (ch === ' ' || ch === '\t') continue;
      if (hasLineComments && ch === '/' && line[i + 1] === '/') return;
      if (ch === '/' && line[i + 1] === '*') { mode = 'block-comment'; i++; continue; }
      if (isJava && line.startsWith('"""', i)) { mode = 'text-block'; i += 2; continue; }
      if (ch === '"' || ch === "'") { i = skipString(line, i, ch); last = 'w'; continue; }
      if (isJs && ch === '`') { mode = 'template'; continue; }
      if (isJs && ch === '/' && (last === '' || REGEX_PRECEDERS.has(last) || REGEX_KEYWORDS.has(last))) {
        i = skipRegex(line, i);
        last = 'w';
        continue;
      }
      if (/[\w$]/.test(ch)) {
        let j = i;
        while (j + 1 < line.length && /[\w$]/.test(line[j + 1])) j++;
        const word = line.slice(i, j + 1);
        last = REGEX_KEYWORDS.has(word) ? word : 'w';
        i = j;
        continue;
      }

      if (OPENERS.includes(ch)) {
        stack.push(level);
        if (ch === '{' && templateExprDepth.length) templateExprDepth[templateExprDepth.length - 1]++;
      } else if (CLOSERS.includes(ch)) {
        const depth = templateExprDepth.length;
        if (ch === '}' && depth && templateExprDepth[depth - 1] === 0) {
          // End of a `${ ... }` expression: back inside the template literal.
          templateExprDepth.pop();
          mode = 'template';
          continue;
        }
        if (ch === '}' && depth) templateExprDepth[depth - 1]--;
        stack.pop();
      }
      last = ch;
    }
  }

  return splitLines(text)
    .map((line) => {
      const startMode = mode;

      // The line starts inside a string literal: it is data, never re-indent it.
      if (startMode === 'template' || startMode === 'text-block') {
        scanLine(line, nextLevel());
        return line;
      }

      const trimmed = line.trim();
      if (!trimmed) return '';

      if (startMode === 'block-comment') {
        const level = nextLevel();
        scanLine(trimmed, level);
        // Keep the conventional ` * ` alignment of JSDoc/Javadoc comment bodies.
        return baseIndent + unit.repeat(level) + (trimmed.startsWith('*') ? ' ' : '') + trimmed;
      }

      let level;
      const leadingClosers = (/^[}\])\s]*/.exec(trimmed)[0].match(/[}\])]/g) || []).length;
      if (leadingClosers) {
        // A line that starts by closing brackets lines up with the line that opened them.
        const index = stack.length - leadingClosers;
        level = index >= 0 ? stack[index] : 0;
      } else {
        level = nextLevel();
        // Method-chain continuation: `promise\n  .then(...)`. (Not `...spread`, nor a CSS `.class`.)
        if (hasLineComments && trimmed.startsWith('.') && !trimmed.startsWith('...')) level++;
      }

      scanLine(trimmed, level);
      return baseIndent + unit.repeat(level) + trimmed;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// JSON (also tolerates JSONC comments and trailing commas, and preserves them)
// ---------------------------------------------------------------------------

const JSON_LITERAL = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)$/;

function tokenizeJson(text) {
  const tokens = [];
  let line = 1;
  let lineStart = 0;
  let newlineBefore = false;
  let i = 0;

  const fail = (message, index) => {
    throw new FormatError(`Invalid JSON: ${message} (Ln ${line}, Col ${index - lineStart + 1})`);
  };

  while (i < text.length) {
    const ch = text[i];
    if (ch === '\n') {
      line++;
      lineStart = i + 1;
      newlineBefore = true;
      i++;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++;
      continue;
    }

    const start = i;
    const startLine = line;
    const startColumn = i - lineStart + 1;
    let type;

    if (ch === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\n') fail('unterminated string', start);
        i += text[i] === '\\' ? 2 : 1;
      }
      if (i >= text.length) fail('unterminated string', start);
      i++;
      type = 'string';
    } else if (ch === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end;
      type = 'line-comment';
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) fail('unterminated comment', start);
      for (let j = i; j < end; j++) {
        if (text[j] === '\n') { line++; lineStart = j + 1; }
      }
      i = end + 2;
      type = 'block-comment';
    } else if ('{}[],:'.includes(ch)) {
      i++;
      type = ch;
    } else {
      while (i < text.length && !/[\s{}[\],:"/]/.test(text[i])) i++;
      if (i === start) i++;
      const value = text.slice(start, i);
      if (!JSON_LITERAL.test(value)) fail(`unexpected '${value.slice(0, 20)}'`, start);
      type = 'literal';
    }

    tokens.push({ type, value: text.slice(start, i), line: startLine, column: startColumn, newlineBefore });
    newlineBefore = false;
  }
  return tokens;
}

/**
 * Pretty-prints JSON by re-emitting the original tokens with new whitespace. Unlike
 * JSON.parse/stringify this keeps key order, duplicate keys, number precision
 * (e.g. 64-bit IDs), string escapes and comments exactly as written.
 */
export function formatJson(text, unit = DEFAULT_INDENT) {
  const tokens = tokenizeJson(text);
  if (!tokens.some((t) => !t.type.endsWith('comment'))) return text;

  let out = '';
  let depth = 0;
  let breakPending = false;
  const containers = [];
  // What may come next: 'value' | 'value-or-close' | 'key-or-close' | 'colon' | 'comma-or-close' | 'end'
  let expect = 'value';

  const unexpected = (t) => {
    const what = t.type === 'literal' || t.type === 'string' ? `'${t.value.slice(0, 20)}'` : `'${t.type}'`;
    throw new FormatError(`Invalid JSON: unexpected ${what} (Ln ${t.line}, Col ${t.column})`);
  };
  const lineBreak = () => {
    out += '\n' + unit.repeat(depth);
    breakPending = false;
  };
  const emit = (value) => {
    if (breakPending) lineBreak();
    out += value;
  };
  const valueDone = () => {
    expect = containers.length ? 'comma-or-close' : 'end';
  };
  const expectsValue = () => expect === 'value' || expect === 'value-or-close';

  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];

    if (t.type === 'line-comment' || t.type === 'block-comment') {
      if (out && !t.newlineBefore) {
        out += ' ' + t.value; // trailing comment stays on its line
      } else {
        if (out) lineBreak();
        out += t.value;
      }
      if (t.type === 'line-comment' || t.newlineBefore) breakPending = true;
      continue;
    }

    switch (t.type) {
      case '{':
      case '[': {
        if (!expectsValue()) unexpected(t);
        const close = t.type === '{' ? '}' : ']';
        emit(t.value);
        if (tokens[k + 1]?.type === close) {
          out += close; // keep empty containers compact: {} and []
          k++;
          valueDone();
        } else {
          containers.push(close);
          depth++;
          breakPending = true;
          expect = t.type === '{' ? 'key-or-close' : 'value-or-close';
        }
        break;
      }
      case '}':
      case ']': {
        const top = containers[containers.length - 1];
        const canClose = t.type === '}' ? expect === 'key-or-close' : expect === 'value-or-close';
        if (top !== t.type || !(canClose || expect === 'comma-or-close')) unexpected(t);
        containers.pop();
        depth--;
        lineBreak();
        out += t.value;
        valueDone();
        break;
      }
      case ':':
        if (expect !== 'colon') unexpected(t);
        out += ': ';
        expect = 'value';
        break;
      case ',':
        if (expect !== 'comma-or-close') unexpected(t);
        out += ',';
        breakPending = true;
        expect = containers[containers.length - 1] === '}' ? 'key-or-close' : 'value-or-close';
        break;
      case 'string':
        if (expect === 'key-or-close') {
          emit(t.value);
          expect = 'colon';
          break;
        }
      // falls through: a string in value position
      case 'literal':
        if (!expectsValue()) unexpected(t);
        emit(t.value);
        valueDone();
        break;
      default:
        unexpected(t);
    }
  }

  if (expect !== 'end') throw new FormatError('Invalid JSON: unexpected end of document');
  return out + (endsWithNewline(text) ? '\n' : '');
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
]);
// Inline elements stay on the current line: adding a line break between them would add
// visible whitespace to the rendered page.
const INLINE_ELEMENTS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'button', 'cite', 'code', 'data', 'del',
  'dfn', 'em', 'i', 'img', 'input', 'ins', 'kbd', 'label', 'mark', 'meter',
  'output', 'progress', 'q', 's', 'samp', 'select', 'small', 'span', 'strong',
  'sub', 'sup', 'textarea', 'time', 'u', 'var', 'wbr'
]);
// Contents are kept byte-for-byte (whitespace is significant).
const PREFORMATTED_ELEMENTS = new Set(['pre', 'textarea']);
// Contents are code, formatted with the brace formatter.
const RAW_TEXT_ELEMENTS = new Set(['script', 'style']);
const JS_SCRIPT_TYPE = /^(?:|module|(?:text|application)\/(?:x-)?(?:javascript|ecmascript))$/i;

// Elements whose end tag is optional, and the opening tags that implicitly close them.
const P_CLOSERS = [
  'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul'
];
const IMPLICITLY_CLOSED_BY = {
  p: new Set(P_CLOSERS),
  li: new Set(['li']),
  dt: new Set(['dt', 'dd']),
  dd: new Set(['dt', 'dd']),
  tr: new Set(['tr']),
  td: new Set(['td', 'th', 'tr']),
  th: new Set(['td', 'th', 'tr']),
  option: new Set(['option', 'optgroup']),
  optgroup: new Set(['optgroup'])
};

const HTML_TOKEN = /<!--[\s\S]*?(?:-->|$)|<![^>]*>?|<\/?[A-Za-z][^\s/>]*(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+|</y;
// HTML whitespace only. `\s` would also match U+00A0 (&nbsp;), which is significant.
const HTML_SPACE = /[ \t\n\f\r]+/g;
const trimHtmlSpace = (s) => s.replace(/^[ \t\n\f\r]+|[ \t\n\f\r]+$/g, '');

function tokenizeHtml(html) {
  const tokens = [];
  let pos = 0;
  while (pos < html.length) {
    HTML_TOKEN.lastIndex = pos;
    const value = HTML_TOKEN.exec(html)[0];
    pos += value.length;

    if (value.startsWith('<!--')) {
      tokens.push({ type: 'comment', value });
    } else if (value.startsWith('<!')) {
      tokens.push({ type: 'doctype', value });
    } else if (/^<\/?[A-Za-z]/.test(value)) {
      const closing = value[1] === '/';
      const name = /^<\/?([^\s/>]+)/.exec(value)[1].toLowerCase();
      const selfClosing = !closing && /\/\s*>$/.test(value);
      tokens.push({ type: closing ? 'close' : 'open', name, value, selfClosing });

      if (!closing && !selfClosing && (RAW_TEXT_ELEMENTS.has(name) || PREFORMATTED_ELEMENTS.has(name))) {
        const endTag = new RegExp(`</${name}[\\s>/]`, 'ig');
        endTag.lastIndex = pos;
        const end = endTag.exec(html);
        const contentEnd = end ? end.index : html.length;
        tokens.push({ type: 'raw', value: html.slice(pos, contentEnd) });
        pos = contentEnd;
      }
    } else {
      tokens.push({ type: 'text', value });
    }
  }
  return tokens;
}

export function formatHtml(html, unit = DEFAULT_INDENT) {
  const tokens = tokenizeHtml(html);
  const lines = [];
  let line = ''; // the line being built, without indentation
  let lineLevel = 0;
  let level = 0;
  let pendingSpace = false;
  const open = []; // open block elements: { name, linesAtOpen }

  const append = (str) => {
    if (!line) lineLevel = level;
    else if (pendingSpace) line += ' ';
    pendingSpace = false;
    line += str;
  };
  const appendVerbatim = (str) => {
    if (!line) lineLevel = level;
    line += str;
  };
  const breakLine = () => {
    if (line) lines.push(unit.repeat(lineLevel) + line);
    line = '';
    pendingSpace = false;
  };
  const blankLine = () => {
    breakLine();
    if (lines.length && lines[lines.length - 1] !== '') lines.push('');
  };
  const closeTo = (index) => {
    level -= open.length - index;
    open.length = index;
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type === 'text') {
      // Keep the author's line breaks (and at most one blank line); collapse other runs of spaces.
      const parts = tok.value.split(/\r?\n/);
      parts.forEach((part, index) => {
        if (index > 0) {
          breakLine();
          if (index < parts.length - 1 && !trimHtmlSpace(part)) blankLine();
        }
        const collapsed = part.replace(HTML_SPACE, ' ');
        const content = trimHtmlSpace(collapsed);
        if (!content) {
          if (collapsed && line) pendingSpace = true;
          return;
        }
        if (collapsed[0] === ' ' && line) pendingSpace = true;
        append(content);
        if (collapsed[collapsed.length - 1] === ' ') pendingSpace = true;
      });
      continue;
    }

    if (tok.type === 'comment') {
      append(tok.value);
      continue;
    }

    if (tok.type === 'doctype') {
      breakLine();
      append(tok.value);
      breakLine();
      continue;
    }

    if (tok.type === 'raw') {
      appendVerbatim(tok.value); // only reached for an inline <textarea>
      continue;
    }

    const { name } = tok;

    if (tok.type === 'close') {
      if (INLINE_ELEMENTS.has(name)) {
        append(tok.value);
        continue;
      }
      let index = open.length - 1;
      while (index >= 0 && open[index].name !== name) index--;
      if (index === -1) {
        // Stray end tag: put it on its own line without touching the nesting.
        breakLine();
        append(tok.value);
        breakLine();
        continue;
      }
      const stayedOnOneLine = line && lines.length === open[index].linesAtOpen;
      closeTo(index);
      if (!stayedOnOneLine) breakLine();
      append(tok.value);
      breakLine();
      continue;
    }

    // Opening tag
    if (INLINE_ELEMENTS.has(name)) {
      append(tok.value);
      continue;
    }

    while (open.length && IMPLICITLY_CLOSED_BY[open[open.length - 1].name]?.has(name)) {
      closeTo(open.length - 1);
    }
    breakLine();
    append(tok.value);

    if (VOID_ELEMENTS.has(name) || tok.selfClosing) {
      breakLine();
      continue;
    }

    if (RAW_TEXT_ELEMENTS.has(name) || PREFORMATTED_ELEMENTS.has(name)) {
      const raw = tokens[i + 1]?.type === 'raw' ? tokens[++i].value : '';
      const closeTag = tokens[i + 1]?.type === 'close' && tokens[i + 1].name === name ? tokens[++i].value : '';

      if (PREFORMATTED_ELEMENTS.has(name) || !raw.trim()) {
        appendVerbatim(raw + closeTag);
      } else {
        const typeAttr = /\stype\s*=\s*["']?([^"'\s>]*)/i.exec(tok.value);
        const language = name === 'style' ? 'css' : JS_SCRIPT_TYPE.test(typeAttr?.[1] ?? '') ? 'javascript' : null;
        breakLine();
        if (language) {
          const code = raw.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/\s+$/, '');
          lines.push(formatBraceLanguage(code, unit, language, unit.repeat(level + 1)));
        } else {
          lines.push(raw.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/\s+$/, '')); // e.g. JSON-LD, templates
        }
        append(closeTag);
      }
      breakLine();
      continue;
    }

    open.push({ name, linesAtOpen: lines.length });
    level++;
  }

  breakLine();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + (endsWithNewline(html) ? '\n' : '');
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

export function formatSql(sql, unit = DEFAULT_INDENT) {
  const tokenRegex =
    /(--[^\r\n]*|\/\*[\s\S]*?\*\/|\$(?<tag>[A-Za-z_]\w*)?\$[\s\S]*?\$\k<tag>\$|'(?:''|\\.|[^'\\])*'|"(?:""|\\.|[^"\\])*"|`[^`]*`|\b(?:LEFT\s+OUTER\s+JOIN|RIGHT\s+OUTER\s+JOIN|FULL\s+OUTER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|CROSS\s+JOIN|ORDER\s+BY|GROUP\s+BY|INSERT\s+INTO|DELETE\s+FROM|CREATE\s+TABLE|CREATE\s+DATABASE|IF\s+NOT\s+EXISTS|PRIMARY\s+KEY|FOREIGN\s+KEY|NOT\s+NULL|SELECT|FROM|WHERE|AND|OR|HAVING|LIMIT|OFFSET|JOIN|ON|VALUES|UPDATE|SET|USE|ALTER|DROP|AS|DISTINCT|UNION|ALL|CASE|WHEN|THEN|ELSE|END|INTO|DEFAULT|UNIQUE|CHECK|REFERENCES|INT|INTEGER|VARCHAR|CHAR|TEXT|DATE|TIMESTAMP|DECIMAL|NUMERIC|BOOLEAN|FLOAT|DOUBLE|AUTO_INCREMENT|CURRENT_TIMESTAMP)\b|[(),;.]|\s+|[^\s(),;.]+)/gi;

  const newlineBefore = new Set([
    'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT',
    'OFFSET', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'CROSS JOIN',
    'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'JOIN', 'ON',
    'SET', 'VALUES'
  ]);

  const keywordSet = new Set([
    ...newlineBefore,
    'SELECT', 'INSERT INTO', 'DELETE FROM', 'CREATE TABLE', 'CREATE DATABASE',
    'IF NOT EXISTS', 'PRIMARY KEY', 'FOREIGN KEY', 'NOT NULL', 'UPDATE', 'USE',
    'ALTER', 'DROP', 'AS', 'DISTINCT', 'UNION', 'ALL', 'CASE', 'WHEN', 'THEN',
    'ELSE', 'END', 'INTO', 'DEFAULT', 'UNIQUE', 'CHECK', 'REFERENCES', 'INT',
    'INTEGER', 'VARCHAR', 'CHAR', 'TEXT', 'DATE', 'TIMESTAMP', 'DECIMAL',
    'NUMERIC', 'BOOLEAN', 'FLOAT', 'DOUBLE', 'AUTO_INCREMENT', 'CURRENT_TIMESTAMP'
  ]);

  let out = '';
  let parenDepth = 0;
  let inCreateBlock = false;
  let inValuesClause = false;
  let expectTableTarget = false;
  let justSawTableTarget = false;
  let atLineStart = true;
  let needSpace = false;
  let pendingNewline = false;
  let pendingIndent = '';
  let sawNewlineSinceToken = false;

  const flushPending = () => {
    if (pendingNewline) {
      out += '\n' + pendingIndent;
      atLineStart = pendingIndent.length === 0;
      needSpace = false;
      pendingNewline = false;
      pendingIndent = '';
    }
  };

  const tokens = sql.match(tokenRegex) || [];

  for (const raw of tokens) {
    // Whitespace
    if (/^\s+$/.test(raw)) {
      const newlines = (raw.match(/\n/g) || []).length;
      if (newlines >= 1) sawNewlineSinceToken = true;
      if (newlines >= 2) {
        flushPending();
        if (!out.endsWith('\n\n')) {
          out += atLineStart ? '\n' : '\n\n';
        }
        atLineStart = true;
        needSpace = false;
      } else if (!atLineStart && !pendingNewline) {
        needSpace = true;
      }
      continue;
    }

    // Single-line comment: keep inline if on the same line as preceding code
    if (raw.startsWith('--')) {
      if (!sawNewlineSinceToken && !atLineStart) {
        out += ' ' + raw + '\n';
        atLineStart = true;
        needSpace = false;
        if (pendingNewline) {
          out += pendingIndent;
          atLineStart = pendingIndent.length === 0;
          pendingNewline = false;
          pendingIndent = '';
        }
      } else {
        flushPending();
        if (!atLineStart) out += '\n';
        out += raw + '\n';
        atLineStart = true;
        needSpace = false;
      }
      sawNewlineSinceToken = true;
      continue;
    }

    // Block comment
    if (raw.startsWith('/*')) {
      flushPending();
      if (needSpace && !atLineStart) out += ' ';
      out += raw;
      atLineStart = false;
      needSpace = true;
      sawNewlineSinceToken = false;
      continue;
    }

    const normalized = raw.replace(/\s+/g, ' ').toUpperCase();
    const isKeyword = keywordSet.has(normalized);

    // Semicolon ends statement (defer newline so inline `--` comment can attach)
    if (raw === ';') {
      flushPending();
      out += ';';
      atLineStart = false;
      needSpace = false;
      pendingNewline = true;
      pendingIndent = '';
      inCreateBlock = false;
      inValuesClause = false;
      expectTableTarget = false;
      justSawTableTarget = false;
      sawNewlineSinceToken = false;
      continue;
    }

    flushPending();

    // Opening parenthesis
    if (raw === '(') {
      if ((needSpace && !atLineStart && (justSawTableTarget || inValuesClause)) || (inValuesClause && atLineStart)) {
        if (!atLineStart) out += ' ';
      }
      out += '(';
      parenDepth++;
      atLineStart = false;
      needSpace = false;
      justSawTableTarget = false;
      sawNewlineSinceToken = false;

      if (parenDepth === 1 && inCreateBlock) {
        out += '\n' + unit;
        atLineStart = false;
      }
      continue;
    }

    // Closing parenthesis
    if (raw === ')') {
      if (parenDepth === 1 && inCreateBlock) {
        out += '\n)';
        inCreateBlock = false;
      } else {
        out += ')';
      }
      parenDepth = Math.max(0, parenDepth - 1);
      atLineStart = false;
      needSpace = true;
      sawNewlineSinceToken = false;
      continue;
    }

    // Comma
    if (raw === ',') {
      out += ',';
      atLineStart = false;
      needSpace = false;
      sawNewlineSinceToken = false;

      if ((parenDepth === 1 && inCreateBlock) || (parenDepth === 0 && !inCreateBlock)) {
        pendingNewline = true;
        pendingIndent = unit;
      } else {
        out += ' ';
      }
      continue;
    }

    // Dot (table.column)
    if (raw === '.') {
      out += '.';
      atLineStart = false;
      needSpace = false;
      sawNewlineSinceToken = false;
      continue;
    }

    // Clause keywords starting on a new line
    if (isKeyword && parenDepth === 0 && newlineBefore.has(normalized)) {
      if (!atLineStart) out += '\n';
      out += normalized;
      atLineStart = false;
      needSpace = true;
      sawNewlineSinceToken = false;

      if (normalized === 'VALUES') {
        pendingNewline = true;
        pendingIndent = unit;
        inValuesClause = true;
      }
      continue;
    }

    // Regular keyword, identifier, string, or operator
    if (needSpace && !atLineStart) out += ' ';
    out += isKeyword ? normalized : raw;
    atLineStart = false;
    needSpace = true;
    sawNewlineSinceToken = false;

    if (normalized === 'CREATE TABLE') {
      inCreateBlock = true;
      expectTableTarget = true;
    } else if (normalized === 'INSERT INTO') {
      expectTableTarget = true;
    } else if (expectTableTarget && !isKeyword) {
      expectTableTarget = false;
      justSawTableTarget = true;
    } else {
      justSawTableTarget = false;
    }
  }

  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---------------------------------------------------------------------------
// Python & Markdown: whitespace clean-up only
// ---------------------------------------------------------------------------

const trimEnd = (line) => line.replace(/[ \t]+$/, '');

/** Joins lines, capping runs of blank lines and dropping leading/trailing blank lines. */
function joinLines(entries, maxBlankLines) {
  const out = [];
  let blanks = 0;
  for (const { text, keep } of entries) {
    if (text === '' && !keep) {
      if (++blanks > maxBlankLines) continue;
    } else {
      blanks = 0;
    }
    out.push(text);
  }
  while (out.length && out[0] === '') out.shift();
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.length ? out.join('\n') + '\n' : '';
}

/** Trims trailing whitespace and allows up to two blank lines (PEP 8 spacing between top-level definitions). */
export function formatPython(text) {
  return joinLines(splitLines(text).map((line) => ({ text: trimEnd(line) })), 2);
}

/**
 * Trims trailing whitespace and collapses blank lines, but keeps Markdown hard line breaks
 * (two trailing spaces) and leaves blank lines inside fenced code blocks alone.
 */
export function formatMarkdown(text) {
  const entries = [];
  let fence = null;
  for (const line of splitLines(text)) {
    if (fence) {
      entries.push({ text: trimEnd(line), keep: true });
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) fence = open[1];
    const hardBreak = /\S {2,}$/.test(line);
    entries.push({ text: trimEnd(line) + (hardBreak ? '  ' : '') });
  }
  return joinLines(entries, 1);
}

// ---------------------------------------------------------------------------
// Monaco registration
// ---------------------------------------------------------------------------

const FORMATTERS = {
  javascript: (text, unit) => formatBraceLanguage(text, unit, 'javascript'),
  java: (text, unit) => formatBraceLanguage(text, unit, 'java'),
  json: formatJson,
  html: formatHtml,
  sql: formatSql,
  python: formatPython,
  markdown: formatMarkdown
};

/**
 * @param {typeof import('monaco-editor')} monaco
 * @param {{ onError?: (message: string) => void }} [options] called when a document can't be formatted
 */
export function registerFormatters(monaco, { onError } = {}) {
  for (const [language, format] of Object.entries(FORMATTERS)) {
    monaco.languages.registerDocumentFormattingEditProvider(language, {
      displayName: 'Minimalist Code',
      provideDocumentFormattingEdits(model, options) {
        const original = model.getValue(monaco.editor.EndOfLinePreference.LF);
        let formatted;
        try {
          // `options` reflects the editor's current indentation, which can be changed at runtime.
          formatted = format(original, indentUnit(options));
        } catch (err) {
          if (!(err instanceof FormatError)) console.error(err);
          onError?.(err instanceof FormatError ? err.message : `Could not format this ${language} document.`);
          return [];
        }
        return formatted === original ? [] : [{ range: model.getFullModelRange(), text: formatted }];
      }
    });
  }
}
