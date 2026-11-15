import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  FormatError,
  formatBraceLanguage,
  formatHtml,
  formatJson,
  formatMarkdown,
  formatPython,
  formatSql,
  indentUnit,
  registerFormatters
} from '../src/formatters.js';

const U = '    ';
const lines = (...l) => l.join('\n');

describe('indentUnit', () => {
  test('spaces or tabs', () => {
    assert.equal(indentUnit({ insertSpaces: true, tabSize: 2 }), '  ');
    assert.equal(indentUnit({ insertSpaces: false, tabSize: 4 }), '\t');
  });
});

describe('formatBraceLanguage (JavaScript)', () => {
  test('re-indents nested blocks', () => {
    const input = lines('function f() {', 'if (x) {', 'foo();', '} else {', 'bar();', '}', '}');
    assert.equal(
      formatBraceLanguage(input, U),
      lines('function f() {', '    if (x) {', '        foo();', '    } else {', '        bar();', '    }', '}')
    );
  });

  test('a trailing line comment does not break indentation', () => {
    const input = lines('if (x) { // note', 'foo();', '}');
    assert.equal(formatBraceLanguage(input, U), lines('if (x) { // note', '    foo();', '}'));
  });

  test('never touches the contents of a multi-line template literal', () => {
    const input = lines('function f() {', 'const s = `', '  keep   me {', '`;', 'return s;', '}');
    assert.equal(
      formatBraceLanguage(input, U),
      lines('function f() {', '    const s = `', '  keep   me {', '`;', '    return s;', '}')
    );
  });

  test('ignores brackets inside strings, regexes, comments and ${} expressions', () => {
    const input = lines(
      'if (a) {',
      "const s = '{';",
      'const r = /[{(]/g;',
      '/* { */',
      'const t = `${ {a: 1}.a }}`;',
      'x();',
      '}'
    );
    assert.equal(
      formatBraceLanguage(input, U),
      lines(
        'if (a) {',
        "    const s = '{';",
        '    const r = /[{(]/g;',
        '    /* { */',
        '    const t = `${ {a: 1}.a }}`;',
        '    x();',
        '}'
      )
    );
  });

  test('one indent level for a call with a callback, and closers line up with their opener', () => {
    const input = lines('foo(function () {', 'bar();', '});', 'p', '.then((r) => {', 'return r;', '})', '.catch(e);');
    assert.equal(
      formatBraceLanguage(input, U),
      lines('foo(function () {', '    bar();', '});', 'p', '    .then((r) => {', '        return r;', '    })', '    .catch(e);')
    );
  });

  test('aligns JSDoc comment bodies', () => {
    const input = lines('class A {', '/**', '* Doc', '*/', 'm() {}', '}');
    assert.equal(formatBraceLanguage(input, U), lines('class A {', '    /**', '     * Doc', '     */', '    m() {}', '}'));
  });

  test('division is not mistaken for a regex', () => {
    const input = lines('if (a) {', 'x = (b) / 2; y = c / d;', '}');
    assert.equal(formatBraceLanguage(input, U), lines('if (a) {', '    x = (b) / 2; y = c / d;', '}'));
  });

  test('is idempotent and keeps blank lines', () => {
    const input = lines('a {', '', 'b;', '}', '');
    const once = formatBraceLanguage(input, U);
    assert.equal(once, lines('a {', '', '    b;', '}', ''));
    assert.equal(formatBraceLanguage(once, U), once);
  });
});

describe('formatBraceLanguage (Java)', () => {
  test('keeps text block contents and char literals', () => {
    const input = lines('class A {', 'String s = """', '    {raw}', '    """;', "char c = '{';", 'void m() {', 'x();', '}', '}');
    assert.equal(
      formatBraceLanguage(input, U, 'java'),
      lines('class A {', '    String s = """', '    {raw}', '    """;', "    char c = '{';", '    void m() {', '        x();', '    }', '}')
    );
  });
});

describe('formatJson', () => {
  test('pretty-prints', () => {
    assert.equal(formatJson('{"a":[1,2,{"b":null}],"c":{}}', U), lines('{', '    "a": [', '        1,', '        2,', '        {', '            "b": null', '        }', '    ],', '    "c": {}', '}'));
  });

  test('preserves key order, number precision and string escapes', () => {
    assert.equal(
      formatJson('{"b":1,"2":2,"id":12345678901234567890,"x":1.50,"s":"\\u00e9\\n"}', U),
      lines('{', '    "b": 1,', '    "2": 2,', '    "id": 12345678901234567890,', '    "x": 1.50,', '    "s": "\\u00e9\\n"', '}')
    );
  });

  test('keeps comments and trailing commas (JSONC)', () => {
    assert.equal(
      formatJson('{\n// lead\n"a": 1, // trailing\n"b": [2,],\n}', U),
      lines('{', '    // lead', '    "a": 1, // trailing', '    "b": [', '        2,', '    ],', '}')
    );
  });

  test('preserves a final newline', () => {
    assert.equal(formatJson('[1]\n', U), '[\n    1\n]\n');
  });

  test('reports the position of invalid JSON', () => {
    assert.throws(() => formatJson('{"a": 1,\n  "b" 2}', U), (err) => err instanceof FormatError && /Ln 2, Col 7/.test(err.message));
    assert.throws(() => formatJson('{"a": tru}', U), FormatError);
    assert.throws(() => formatJson('{"a": 1', U), /unexpected end/);
    assert.throws(() => formatJson('[1] [2]', U), FormatError);
    assert.throws(() => formatJson('{"a": "x\n"}', U), /unterminated string/);
  });

  test('leaves an empty document alone', () => {
    assert.equal(formatJson('', U), '');
    assert.equal(formatJson('  // only a comment', U), '  // only a comment');
  });
});

describe('formatHtml', () => {
  test('void elements do not increase indentation', () => {
    assert.equal(
      formatHtml('<html><head><meta charset="utf-8"><link rel="icon" href="x"><title>T</title></head><body><hr/><p>Hi <b>x</b></p></body></html>', U),
      lines(
        '<html>',
        '    <head>',
        '        <meta charset="utf-8">',
        '        <link rel="icon" href="x">',
        '        <title>T</title>',
        '    </head>',
        '    <body>',
        '        <hr/>',
        '        <p>Hi <b>x</b></p>',
        '    </body>',
        '</html>'
      )
    );
  });

  test('does not add whitespace between inline elements', () => {
    assert.equal(formatHtml('<div><b>a</b><i>b</i> <a href="#">c</a></div>', U), '<div><b>a</b><i>b</i> <a href="#">c</a></div>');
  });

  test('keeps <pre> and <textarea> contents byte-for-byte', () => {
    const pre = '<pre>\n  a   b\n\n\n    c</pre>';
    assert.equal(formatHtml(`<div>${pre}</div>`, U), lines('<div>', `    ${pre}`, '</div>'));
    assert.equal(formatHtml('<p><textarea>  x\n  y </textarea></p>', U), '<p><textarea>  x\n  y </textarea></p>');
  });

  test('formats inline scripts and styles without touching template literals', () => {
    assert.equal(
      formatHtml('<body><script>\nif (a) {\nconst s = `\n  raw\n`;\n}\n</script><style>a{color:red}\n.b {\ncolor: blue;\n}</style></body>', U),
      lines(
        '<body>',
        '    <script>',
        '        if (a) {',
        '            const s = `',
        '  raw',
        '`;',
        '        }',
        '    </script>',
        '    <style>',
        '        a{color:red}',
        '        .b {',
        '            color: blue;',
        '        }',
        '    </style>',
        '</body>'
      )
    );
  });

  test('keeps non-JS script content and empty scripts', () => {
    assert.equal(formatHtml('<script src="a.js"></script>', U), '<script src="a.js"></script>');
    assert.equal(
      formatHtml('<script type="application/ld+json">{"a": 1}</script>', U),
      lines('<script type="application/ld+json">', '{"a": 1}', '</script>')
    );
  });

  test('handles optional end tags and stray end tags', () => {
    assert.equal(formatHtml('<ul><li>a<li>b</ul></span>', U), lines('<ul>', '    <li>a', '    <li>b', '</ul>', '</span>'));
  });

  test('keeps doctype, comments and author line breaks; collapses extra blank lines', () => {
    assert.equal(
      formatHtml('<!DOCTYPE html>\n<div>\n<!-- c -->\n\n\n\n<p>x</p>\n</div>\n', U),
      lines('<!DOCTYPE html>', '<div>', '    <!-- c -->', '', '    <p>x</p>', '</div>', '')
    );
  });

  test('does not collapse non-breaking spaces', () => {
    assert.equal(formatHtml('<p>a  b</p>', U), '<p>a  b</p>');
  });

  test('is idempotent', () => {
    const once = formatHtml('<html><body><div><p>Hi <b>x</b></p><ul><li>a</li></ul></div></body></html>', U);
    assert.equal(formatHtml(once, U), once);
  });
});

describe('formatSql', () => {
  test('puts clauses on their own lines and uppercases keywords', () => {
    assert.equal(
      formatSql('select a, b from t where x = 1 and y = \'and\' order by a;', U),
      lines('SELECT a,', '    b', 'FROM t', 'WHERE x = 1', "AND y = 'and'", 'ORDER BY a;', '')
    );
  });

  test('keeps PostgreSQL dollar-quoted bodies verbatim', () => {
    const body = '$$\nBEGIN\n  select 1; -- x\nEND;\n$$';
    assert.ok(formatSql(`create function f() returns int as ${body} language plpgsql;`, U).includes(body));
  });
});

describe('formatPython', () => {
  test('keeps two blank lines between top-level definitions (PEP 8)', () => {
    assert.equal(formatPython('import os\n\n\n\n\ndef f():   \n    pass\n\n\n'), 'import os\n\n\ndef f():\n    pass\n');
  });

  test('keeps the indentation of the first line', () => {
    assert.equal(formatPython('\n    x = 1\n'), '    x = 1\n');
  });
});

describe('formatMarkdown', () => {
  test('keeps hard line breaks and collapses blank lines', () => {
    assert.equal(formatMarkdown('line one   \nline two \n\n\n\n# H'), 'line one  \nline two\n\n# H\n');
  });

  test('leaves blank lines inside fenced code blocks alone', () => {
    const md = '```py\na = 1\n\n\n\nb = 2\n```\n\n\n\ntext\n';
    assert.equal(formatMarkdown(md), '```py\na = 1\n\n\n\nb = 2\n```\n\ntext\n');
  });
});

describe('registerFormatters', () => {
  const fakeMonaco = () => {
    const providers = {};
    return {
      providers,
      editor: { EndOfLinePreference: { LF: 1 } },
      languages: {
        registerDocumentFormattingEditProvider(language, provider) {
          providers[language] = provider;
        }
      }
    };
  };
  const model = (text) => ({ getValue: () => text, getFullModelRange: () => 'FULL' });

  test('uses the editor indentation options and returns no edits when nothing changes', () => {
    const monaco = fakeMonaco();
    registerFormatters(monaco);
    const edits = monaco.providers.json.provideDocumentFormattingEdits(model('[1]'), { insertSpaces: true, tabSize: 2 });
    assert.deepEqual(edits, [{ range: 'FULL', text: '[\n  1\n]' }]);
    assert.deepEqual(monaco.providers.json.provideDocumentFormattingEdits(model('[\n  1\n]'), { insertSpaces: true, tabSize: 2 }), []);
  });

  test('reports invalid documents through onError instead of throwing', () => {
    const monaco = fakeMonaco();
    const errors = [];
    registerFormatters(monaco, { onError: (message) => errors.push(message) });
    const edits = monaco.providers.json.provideDocumentFormattingEdits(model('{'), { insertSpaces: true, tabSize: 4 });
    assert.deepEqual(edits, []);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Invalid JSON/);
  });
});
