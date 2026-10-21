import { createHash } from 'node:crypto'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'

// CSP meta tag only in the production build: the dev server needs
// `connect-src` open for Vite's HMR websocket, which this policy forbids.
// `apply: 'build'` keeps it out of `vite`/`vite preview` entirely.
// See docs/ARCHITECTURE.md and threat model FELA-4 §5-6 for the rationale.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Hashed against the final HTML (post-transform), so the hash always
        // matches what ships, even if another plugin reformats the tag.
        const bootstrapScript = html.match(
          /<script[^>]*data-theme-bootstrap[^>]*>([\s\S]*?)<\/script>/,
        )
        if (!bootstrapScript) {
          throw new Error(
            'content-security-policy: expected the data-theme-bootstrap inline script in index.html',
          )
        }
        const scriptHash = createHash('sha256').update(bootstrapScript[1]).digest('base64')
        const csp = [
          "default-src 'none'",
          `script-src 'self' 'sha256-${scriptHash}'`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self'",
          "connect-src 'none'",
          "base-uri 'none'",
          "form-action 'none'",
          "object-src 'none'",
          "frame-src 'none'",
          "worker-src 'none'",
          "manifest-src 'self'",
          'upgrade-insecure-requests',
        ].join('; ')
        return html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
        )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/todo-app/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  build: {
    // Explicit, not just the current default: the public build must never
    // ship source maps (threat model FELA-4 §5).
    sourcemap: false,
    // Vite's inline modulepreload polyfill would be a second inline script
    // and `script-src 'self'` (no hash for it) would block it. We have no
    // code splitting today, so the polyfill is dead weight anyway.
    modulePreload: {
      polyfill: false,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
