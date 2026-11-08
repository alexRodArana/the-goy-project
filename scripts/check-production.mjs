import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { chromium, webkit } from '@playwright/test'

const dist = resolve('dist')
const basePath = '/the-goy-project/'
const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}
let unavailable = false

const server = createServer(async (request, response) => {
  if (unavailable) {
    response.writeHead(503, { 'Content-Type': 'text/plain' }).end('Temporarily unavailable')
    return
  }

  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  if (!pathname.startsWith(basePath)) {
    response.writeHead(404).end()
    return
  }

  const file = resolve(dist, pathname.slice(basePath.length) || 'index.html')
  if (file !== dist && !file.startsWith(`${dist}${sep}`)) {
    response.writeHead(403).end()
    return
  }

  try {
    const contents = await readFile(file)
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': mimeTypes[extname(file)] ?? 'application/octet-stream',
    }).end(contents)
  } catch {
    response.writeHead(404).end()
  }
})

await new Promise((resolveListening) => server.listen(0, '127.0.0.1', resolveListening))
const address = server.address()
assert(address && typeof address !== 'string')
const url = `http://127.0.0.1:${address.port}${basePath}`

try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    unavailable = false
    const browser = await engine.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))

      await page.goto(url, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Crear rutina', exact: true }).waitFor()
      await page.evaluate(() => navigator.serviceWorker.ready)
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

      unavailable = true
      const response = await page.reload({ waitUntil: 'domcontentloaded' })
      assert.equal(response?.status(), 200)
      await page.getByRole('button', { name: 'Crear rutina', exact: true }).waitFor()
      assert.deepEqual(errors, [])
      console.log(`${name}: cached app shell recovered from an HTTP 503 response`)
    } finally {
      await browser.close()
    }
  }
} finally {
  server.close()
}
