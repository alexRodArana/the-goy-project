import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'suite-early-appearance',
      transformIndexHtml: {
        order: 'post',
        handler: () => [{ tag: 'script', attrs: { src: './theme.js' }, injectTo: 'head' }],
      },
    },
    {
      name: 'suite-production',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler: () => [{
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://vclrrqrtkoeofwlnezkv.supabase.co wss://vclrrqrtkoeofwlnezkv.supabase.co; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
          injectTo: 'head-prepend',
        }],
      },
      generateBundle(_, bundle) {
        const files = Object.keys(bundle).filter((name) => !name.endsWith('.map'))
        this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) })
      },
      writeBundle() {
        const worker = readFileSync('public/sw.js', 'utf8').replace('__BUILD_ID__', Date.now().toString(36))
        writeFileSync('dist/sw.js', worker)
      },
    },
  ],
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: './src/test/setup.ts',
  },
})
