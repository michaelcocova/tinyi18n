export type TinyI18nMode = 'development' | 'production'

export interface TinyI18nUiCommand {
  type: 'ui'
  projectRoot: string
  port?: number
  host?: boolean | string
}

export interface TinyI18nValidateCommand {
  type: 'validate'
  projectRoot: string
}

export interface TinyI18nInitCommand {
  type: 'init'
  projectRoot: string
}

export interface TinyI18nUpdateCommand {
  type: 'update'
  projectRoot: string
}

export type TinyI18nCommand
  = | TinyI18nUiCommand
    | TinyI18nValidateCommand
    | TinyI18nInitCommand
    | TinyI18nUpdateCommand

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
