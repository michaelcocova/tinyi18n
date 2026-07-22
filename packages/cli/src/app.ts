import type { StartupInfo } from './types.ts'
import { networkInterfaces } from 'node:os'
import process from 'node:process'
import { resolveCommand } from './commands.ts'
import { handleInit, handleUpdate, handleValidate } from './handlers.ts'
import {
  formatStartupInfo,
  printIgnoredDevelopmentPortNotice,
  printLines,
} from './output.ts'
import { resolvePortWithRetry, resolveRequestedPort } from './ports.ts'

import {
  resolveRuntimeMode,
  setupShortcuts,
  startWebDevServer,
  startWebDistServer,
} from './runtime.ts'

function getNetworkInterfaces() {
  const interfaces = networkInterfaces()
  const results: string[] = []

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        results.push(iface.address)
      }
    }
  }
  return results
}

export async function runCli(
  args: string[] = process.argv.slice(2),
  cwd: string = process.cwd(),
) {
  const resolved = await resolveCommand(args, cwd)

  if (!resolved.command) {
    process.exitCode = resolved.exitCode ?? 0
    return
  }

  const command = resolved.command

  // 非 UI 命令直接执行后退出
  if (command.type === 'validate') {
    handleValidate(command.projectRoot)
    return
  }
  if (command.type === 'init') {
    handleInit(command.projectRoot)
    return
  }
  if (command.type === 'update') {
    await handleUpdate(command.projectRoot)
    return
  }
  // --- UI 启动逻辑 ---

  const mode = resolveRuntimeMode()

  let hostname = '127.0.0.1'
  if (command.host === true || command.host === '') {
    hostname = '0.0.0.0'
  } else if (typeof command.host === 'string') {
    hostname = command.host
  } else if (process.env.TINYI18N_HOST) {
    hostname = process.env.TINYI18N_HOST
  }

  const requestedPort = resolveRequestedPort(command, mode)

  if (mode === 'development' && command.port != null) {
    printIgnoredDevelopmentPortNotice(command.port)
  }

  const port = await resolvePortWithRetry('ui', requestedPort, hostname)

  const urls = {
    local: [`http://localhost:${port}`],
    network: [] as string[],
  }

  if (hostname === '0.0.0.0' || hostname === '::') {
    urls.network = getNetworkInterfaces().map(ip => `http://${ip}:${port}`)
  } else if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
    urls.network = [`http://${hostname}:${port}`]
  }

  const webProcess
    = mode === 'development'
      ? startWebDevServer(command.projectRoot, port, hostname)
      : startWebDistServer(command.projectRoot, port, hostname)

  function stop() {
    webProcess?.kill('SIGTERM')
    process.exit(0)
  }

  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  const info: StartupInfo = {
    mode,
    projectRoot: command.projectRoot,
    urls,
  }

  printLines(formatStartupInfo(info))
  setupShortcuts(info, stop)
}
