export type TinyI18nMode = 'development' | 'production'

export interface TinyI18nUiCommand {
  type: 'ui'
  projectRoot: string
  port?: number
  host?: boolean | string
}

export interface TinyI18nGenerateCommand {
  type: 'generate'
  projectRoot: string
}

export type TinyI18nCommand
  = | TinyI18nUiCommand
    | TinyI18nGenerateCommand

export interface ResolvedCommandResult {
  command?: TinyI18nCommand
  exitCode?: number
}

export interface StartupInfo {
  mode: TinyI18nMode
  projectRoot: string
  urls: {
    local: string[]
    network: string[]
  }
}
