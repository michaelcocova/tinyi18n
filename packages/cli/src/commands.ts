import type { ResolvedCommandResult, TinyI18nCommand } from './types.ts'

import { Command, CommanderError, InvalidArgumentError } from 'commander'

function parsePortOption(value: string) {
  const port = Number(value)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new InvalidArgumentError(
      'port must be an integer between 1 and 65535',
    )
  }
  return port
}

function createProgram(
  cwd: string,
  onCommand: (command: TinyI18nCommand) => void,
) {
  const program = new Command()

  program
    .name('tinyi18n')
    .usage('<command>')
    .description('TinyI18n 命令行工具')
    .helpOption('-h, --help', '显示命令帮助')
    .showHelpAfterError()
    .action(() => {
      onCommand({
        type: 'ui',
        projectRoot: cwd,
      })
    })

  program
    .command('ui')
    .description('启动 TinyI18n Studio')
    .option('-p, --port <port>', '设置服务端口', parsePortOption)
    .option('--host [host]', '指定主机名，暴露到局域网。不传值则默认为 0.0.0.0')
    .action((options: { port?: number, host?: boolean | string }) => {
      onCommand({
        type: 'ui',
        projectRoot: cwd,
        port: options.port,
        host: options.host,
      })
    })

  program
    .command('generate')
    .alias('g')
    .description('生成多语言词条到源码')
    .action(() => {
      onCommand({
        type: 'generate',
        projectRoot: cwd,
      })
    })

  return program
}

export async function resolveCommand(
  args: string[],
  cwd: string,
): Promise<ResolvedCommandResult> {
  let resolvedCommand: TinyI18nCommand | undefined
  const program = createProgram(cwd, (command) => {
    resolvedCommand = command
  })

  program.exitOverride()

  try {
    await program.parseAsync(args, { from: 'user' })
  } catch (error) {
    if (error instanceof CommanderError) {
      return {
        exitCode: error.exitCode,
      }
    }

    throw error
  }

  return {
    command: resolvedCommand ?? {
      type: 'ui',
      projectRoot: cwd,
    },
  }
}
