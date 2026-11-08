import { execFileSync, spawnSync } from 'node:child_process'
import { access, cp, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist')
await access(join(dist, 'index.html'))

const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()

const remote = run('git', ['remote', 'get-url', 'origin'])
const revision = run('git', ['rev-parse', '--short', 'HEAD'])
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'the-goy-project-pages-'))

try {
  const branchExists = spawnSync('git', ['ls-remote', '--exit-code', '--heads', 'origin', 'gh-pages'], {
    cwd: root,
    stdio: 'ignore',
  }).status === 0

  if (branchExists) {
    run('git', ['clone', '--depth', '1', '--branch', 'gh-pages', '--single-branch', remote, temporaryDirectory])
    const entries = await readdir(temporaryDirectory)
    await Promise.all(entries.filter((entry) => entry !== '.git').map((entry) => rm(join(temporaryDirectory, entry), { force: true, recursive: true })))
  } else {
    run('git', ['init', '--initial-branch', 'gh-pages'], temporaryDirectory)
    run('git', ['remote', 'add', 'origin', remote], temporaryDirectory)
  }

  for (const entry of await readdir(dist)) {
    await cp(join(dist, entry), join(temporaryDirectory, entry), { recursive: true })
  }
  await writeFile(join(temporaryDirectory, '.nojekyll'), '')
  run('git', ['config', 'user.name', 'The Goy Project Deploy'], temporaryDirectory)
  run('git', ['config', 'user.email', 'deploy@the-goy-project.local'], temporaryDirectory)
  run('git', ['add', '--all'], temporaryDirectory)

  const changed = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: temporaryDirectory }).status !== 0
  if (!changed) {
    console.log('gh-pages is already up to date')
  } else {
    run('git', ['commit', '-m', `Deploy ${revision}`], temporaryDirectory)
    run('git', ['push', ...(branchExists ? [] : ['--set-upstream']), 'origin', 'gh-pages'], temporaryDirectory)
    console.log(`Published ${revision} to gh-pages`)
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true })
}
