import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import type { StartupInfo, TinyI18nMode } from './types.ts'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import { fileURLToPath } from 'node:url'

import spawn from 'cross-spawn'
import {
  createShortcutHelp,
  filterErrorLog,
  formatStartupInfo,
  printLines,
} from './output.ts'

function pipeErrorLogs(child: ChildProcess) {
  child.stdout?.on('data', (chunk: Buffer) => {
    const errorLog = filterErrorLog(String(chunk))

    if (errorLog) {
      console.error(errorLog)
    }
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    const errorLog = filterErrorLog(String(chunk))

    if (errorLog) {
      console.error(errorLog)
    }
  })
}

export function resolveRuntimeMode(
  env: NodeJS.ProcessEnv = process.env,
): TinyI18nMode {
  if (env.TINYI18N_MODE === 'development' || env.TINYI18N_MODE === 'production') {
    return env.TINYI18N_MODE
  }

  if (env.NODE_ENV === 'development') {
    return 'development'
  }

  const studioPackageRoot = resolve(resolveCliPackageRoot(), '../studio')
  const hasLocalStudioSource = existsSync(resolve(studioPackageRoot, 'package.json'))
    && existsSync(resolve(studioPackageRoot, 'vite.config.ts'))

  return hasLocalStudioSource ? 'development' : 'production'
}

function resolveCliPackageRoot() {
  const runtimeDir = dirname(fileURLToPath(import.meta.url))
  return resolve(runtimeDir, '..')
}

export function startWebDevServer(
  projectRoot: string,
  port: number,
  hostname: string,
): ChildProcess {
  const webPackageRoot = resolve(resolveCliPackageRoot(), '../studio')
  const child = spawn(
    'pnpm',
    [
      'run',
      'dev',
      '--',
      '--host',
      hostname,
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: webPackageRoot,
      env: {
        ...process.env,
        TINYI18N_PROJECT_ROOT: projectRoot,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  pipeErrorLogs(child)
  return child
}

export function startWebDistServer(
  projectRoot: string,
  port: number,
  hostname: string,
): ChildProcess {
  const runtimeDir = dirname(fileURLToPath(import.meta.url))
  const serverEntry = resolve(runtimeDir, './server/index.mjs')
  const child = spawn('node', [serverEntry], {
    cwd: runtimeDir,
    env: {
      ...process.env,
      HOST: hostname,
      PORT: String(port),
      TINYI18N_PROJECT_ROOT: projectRoot,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  pipeErrorLogs(child)
  return child
}

export function setupShortcuts(info: StartupInfo, stop: () => void) {
  process.stdin.setEncoding('utf8')

  if (process.stdin.isTTY) {
    process.stdin.resume()
  }

  process.stdin.on('data', (chunk) => {
    const key = String(chunk).trim()

    if (key === 'h') {
      printLines(createShortcutHelp())
      return
    }

    if (key === 'u') {
      info.urls.local.forEach(url => console.log(url))
      info.urls.network.forEach(url => console.log(url))
      return
    }

    if (key === 'o') {
      console.log('Open this URL in your browser:')
      info.urls.local.forEach(url => console.log(url))
      return
    }

    if (key === 'c') {
      console.clear()
      printLines(formatStartupInfo(info))
      return
    }

    if (key === 'q') {
      stop()
    }
  })
}
