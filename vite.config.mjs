import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monacoEsm = path.resolve(__dirname, 'node_modules/monaco-editor/esm/vs');

/**
 * Adds a Content-Security-Policy <meta> tag to the built index.html. Inline scripts are
 * allowed only by hash, so it is computed from the final HTML. (Not applied to `vite dev`,
 * whose HMR client needs a looser policy.)
 *
 * Monaco injects <style> elements and style attributes at runtime, hence 'unsafe-inline'
 * for styles only. frame-ancestors cannot be set from a <meta> tag: send it as a header
 * (see README).
 */
function contentSecurityPolicy() {
  return {
    name: 'minimalist-code:csp',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const page = bundle['index.html'];
      if (!page || page.type !== 'asset') this.error('index.html not found in the bundle');

      let html = typeof page.source === 'string' ? page.source : Buffer.from(page.source).toString('utf8');
      const scriptHashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
        ([, code]) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`
      );
      const policy = [
        "default-src 'self'",
        `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "worker-src 'self'",
        "connect-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'"
      ].join('; ');

      const charset = /<meta charset="UTF-8"\s*\/?>/i;
      if (!charset.test(html)) this.error('Could not find <meta charset> in index.html to place the CSP after');
      html = html.replace(charset, (tag) => `${tag}\n  <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
      page.source = html;
    }
  };
}

export default defineConfig({
  // Relative asset URLs, so dist/ works from any path (e.g. https://example.com/editor/).
  base: './',
  resolve: {
    alias: {
      'monaco-core': path.join(monacoEsm, 'editor/editor.api.js'),
      'monaco-vs': monacoEsm,
      'monaco-langs': path.join(monacoEsm, 'languages/definitions')
    }
  },
  build: {
    // Monaco's core is one ~3 MB (~0.8 MB gzipped) chunk; Vite's 500 kB warning is expected.
    chunkSizeWarningLimit: 3500,
    // Third-party license notices for everything bundled (required by Monaco's MIT license).
    license: { fileName: 'third-party-licenses.md' }
  },
  plugins: [contentSecurityPolicy()]
});
