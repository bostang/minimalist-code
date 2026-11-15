import * as monaco from 'monaco-core';

// Built-in syntax highlighters (lazy-loaded on demand)
import 'monaco-langs/markdown/register.js';
import 'monaco-langs/sql/register.js';
import 'monaco-langs/java/register.js';
import 'monaco-langs/python/register.js';
import 'monaco-langs/javascript/register.js';
import 'monaco-langs/html/register.js';

export const PREFERRED_LANGUAGES = [
  'plaintext',
  'markdown',
  'log',
  'sql',
  'json',
  'java',
  'python',
  'javascript',
  'html'
];

export function registerCustomLanguages() {
  // Zero-worker JSON highlighter
  monaco.languages.register({ id: 'json', aliases: ['JSON', 'json'] });
  monaco.languages.setMonarchTokensProvider('json', {
    tokenizer: {
      root: [
        [/"([^"\\]|\\.)*"(?=\s*:)/, 'type.identifier'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/\b(true|false|null)\b/, 'keyword'],
        [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
        [/[{}[\],:]/, 'delimiter']
      ]
    }
  });

  // Zero-worker Log highlighter
  monaco.languages.register({ id: 'log', aliases: ['Log', 'log'] });
  monaco.languages.setMonarchTokensProvider('log', {
    tokenizer: {
      root: [
        [/\b(ERROR|FATAL|CRITICAL|EXCEPTION)\b/i, 'invalid'],
        [/\b(WARN|WARNING)\b/i, 'keyword'],
        [/\b(INFO|DEBUG|TRACE)\b/i, 'type.identifier'],
        [/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/, 'number'],
        [/\b\d{1,3}(\.\d{1,3}){3}\b/, 'number'],
        [/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/, 'string']
      ]
    }
  });
}