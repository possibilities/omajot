// A new web app version reaches an open or reopened app (Chromium, real hub):
// 1. the hub serves version A; the app loads and its service worker takes over;
// 2. the hub restarts with B; opening the app again starts from the cached A,
//    finds B and switches to it by itself (no Ctrl+R);
// 3. after the start (15 s) a new version C only shows a notice, which stays
//    until its Reload button, and then the app runs C.
// Run: node test/update-e2e.mjs (needs zig-out/bin/omajot and web/dist).
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const tmp = mkdtempSync(join(tmpdir(), 'omajot-update-'))
const port = 8900 + Math.floor(Math.random() * 90)
const url = `http://127.0.0.1:${port}/`

// A copy of web/dist that says which build it is and has its own version.
function build(name) {
  const dir = join(tmp, name)
  cpSync(join(root, 'web/dist'), dir, { recursive: true })
  const sw = readFileSync(join(dir, 'sw.js'), 'utf8')
  const version = /const VERSION = '([^']+)'/.exec(sw)[1]
  writeFileSync(join(dir, 'sw.js'), sw.replaceAll(version, version + name))
  const html = readFileSync(join(dir, 'index.html'), 'utf8').replaceAll(version, version + name)
  writeFileSync(join(dir, 'index.html'), html.replace('<head>', `<head><meta name="omajot-build" content="${name}">`))
  return dir
}

let hub = null
function startHub(web) {
  hub = spawn(join(root, 'zig-out/bin/omajot'), ['hub', '--port', String(port), '--data', join(tmp, 'data'), '--no-auth', '--web', web],
    { stdio: ['ignore', 'pipe', 'pipe'] })
  return new Promise((resolve, reject) => {
    const onData = (d) => { if (String(d).includes('READY')) resolve() }
    hub.stdout.on('data', onData)
    hub.stderr.on('data', onData)
    hub.on('exit', (code) => reject(new Error('hub exited ' + code)))
  })
}
function stopHub() {
  hub.removeAllListeners('exit')
  const exited = new Promise((r) => hub.once('exit', r))
  hub.kill('SIGTERM')
  return exited
}

const builds = { A: build('A'), B: build('B'), C: build('C') }
const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox'] })
const which = (page) => page.evaluate(() => document.querySelector('meta[name="omajot-build"]')?.content || '')
const until = async (what, fn, ms = 20000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn().catch(() => false)) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('timeout: ' + what)
}
let failed = false
try {
  await startHub(builds.A)
  const page = await browser.newPage()
  await page.goto(url)
  await until('A runs under its service worker', async () =>
    (await which(page)) === 'A' && await page.evaluate(() => !!navigator.serviceWorker.controller && !!window.omajot))
  console.log('ok  A loaded, the service worker controls the page')

  await stopHub()
  await startHub(builds.B)
  await page.reload() // opening the app again: the cached A comes first
  await until('the app switches to B by itself', async () => (await which(page)) === 'B')
  console.log('ok  reopened: it started from the cache and switched to B by itself')

  // Past the start window a new version waits for the user.
  await new Promise((r) => setTimeout(r, 16000))
  await stopHub()
  await startHub(builds.C)
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()))
  await until('a notice for C', () => page.evaluate(() =>
    [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('A new omajot version is ready'))))
  await new Promise((r) => setTimeout(r, 7000)) // longer than an ordinary toast lives
  const still = await page.evaluate(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('A new omajot version is ready')))
  if (!still || (await which(page)) !== 'B') throw new Error('the notice went away, or the app reloaded by itself')
  await page.evaluate(() => [...document.querySelectorAll('.toast button')].find((b) => b.textContent === 'Reload').click())
  await until('Reload runs C', async () => (await which(page)) === 'C')
  console.log('ok  later: a notice that stays; Reload runs C')
  console.log('UPDATE E2E PASS')
} catch (e) {
  failed = true
  console.error('UPDATE E2E FAIL:', e.message)
} finally {
  await browser.close()
  if (hub) await stopHub().catch(() => {})
  rmSync(tmp, { recursive: true, force: true })
}
process.exit(failed ? 1 : 0)
