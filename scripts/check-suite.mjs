import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { chromium, webkit } from '@playwright/test'

const builds = {
  '/the-goy-project/': resolve(process.argv[2] ?? 'dist'),
  '/keep-slopping/': resolve(process.argv[3] ?? '../KeepSlopping/dist'),
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' }
let serverOnline = true
const server = createServer(async (req, res) => {
  if (!serverOnline) { req.socket.destroy(); return }
  const pathname = new URL(req.url, 'http://localhost').pathname
  const prefix = Object.keys(builds).find((key) => pathname.startsWith(key))
  if (!prefix) { res.writeHead(404).end(); return }
  const file = resolve(builds[prefix], pathname.slice(prefix.length) || 'index.html')
  if (!file.startsWith(builds[prefix] + sep)) { res.writeHead(403).end(); return }
  try {
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
    res.end(data)
  } catch { res.writeHead(404).end() }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${server.address().port}`
await mkdir('audit-artifacts', { recursive: true })
try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    serverOnline = true
    const browser = await engine.launch()
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
      const errors = []
      const pages = []
      for (const path of Object.keys(builds)) {
        const page = await context.newPage()
        page.on('pageerror', (error) => errors.push(error.message))
        await page.addInitScript(() => {
          window.cspViolations = []
          document.addEventListener('securitypolicyviolation', (event) => window.cspViolations.push(event.violatedDirective))
        })
        await page.goto(origin + path)
        await page.getByLabel('Email', { exact: true }).waitFor()
        await page.evaluate(() => navigator.serviceWorker.ready)
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
        assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
        assert.equal(await page.locator('.brand-mark img').evaluate((image) => image.complete && image.naturalWidth === 192), true)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        assert.deepEqual(await page.evaluate(() => window.cspViolations), [])
        pages.push(page)
      }
      const [training, food] = pages
      await training.getByRole('button', { name: 'Elegir tema' }).click()
      await training.getByRole('menuitemradio', { name: 'Claro', exact: true }).click()
      await food.waitForFunction(() => document.documentElement.dataset.theme === 'light')
      await training.getByRole('button', { name: 'Elegir color de acento' }).click()
      await training.getByRole('menuitemradio', { name: 'Color Rosa' }).click()
      await food.waitForFunction(() => document.documentElement.dataset.accent === 'rose')
      await training.getByRole('button', { name: 'Elegir tema' }).click()
      await training.getByRole('menuitemradio', { name: 'Dispositivo', exact: true }).click()
      await food.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
      const caches = await training.evaluate(() => window.caches.keys())
      assert(caches.some((key) => key.startsWith('the-goy-project-')))
      assert(caches.some((key) => key.startsWith('keep-slopping-')))
      // WebKit's emulated offline mode aborts navigation before dispatching to the worker.
      // Drop server connections instead, exercising the real failed-fetch cache fallback.
      if (name === 'chromium') await context.setOffline(true)
      serverOnline = false
      for (const [index, page] of pages.entries()) {
        // A page-initiated reload also exercises the PWA in WebKit's non-automation navigation path.
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
          page.evaluate(() => window.location.reload()),
        ])
        await page.getByLabel('Email', { exact: true }).waitFor()
        await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
        assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#f5f6f8')
        assert.deepEqual(await page.evaluate(() => window.cspViolations), [])
        await page.screenshot({ path: `audit-artifacts/${name}-${index}-production-offline.png`, fullPage: true, animations: 'disabled' })
      }
      assert.deepEqual(errors, [])
      console.log(`${name}: production CSP, public configuration, logos, shared appearance and ${name === 'chromium' ? 'offline' : 'server-outage'} isolation passed`)
    } finally { await browser.close() }
  }
} finally { server.close() }
