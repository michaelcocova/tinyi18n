export interface TinyI18nLocaleConfig {
  code: string
  label?: string
  file?: string
  filename?: string
}

export const DEFAULT_NAMESPACE_KEY = 'default'
export const DEFAULT_NAMESPACE_DESCRIPTION = '默认命名空间'
export const DEFAULT_DATA_FILENAME_BASE = '.data'
export const SINGLE_NAMESPACE_KEY = '__DEFAULT__'

export interface TinyI18nNamespaceConfig {
  key: string
  description?: string
}

export interface TinyI18nEntryConfig {
  dir: string
  namespaces?: string | string[]
  paths?: string[]
  include?: string[]
  exclude?: string[]
}

/**
 * 用户配置
 */
export interface TinyI18nUserConfig {
  /**
   * 数据文件名前缀。
   * 单命名空间生成 `.{filename}.json`，多命名空间生成 `.{filename}.{namespace}.json`，默认 `.data`。
   */
  filename?: string
  /**
   * 命名空间配置。若未提供，则默认生成 `default` 命名空间。
   */
  namespaces?: TinyI18nNamespaceConfig[]
  /**
   * 本地化文件配置
   * @default []
   */
  locales?: TinyI18nLocaleConfig[] | string[]
  /** 默认本地化文件 */
  defaultLocale?: string
  /** 本地化文件入口配置 */
  entries?: TinyI18nEntryConfig[]
  /**
   * 命名空间模式：
   * - `single`: 单文件模式（仅生成 `${filename}.json`，忽略 namespaces 中除第一个以外的配置，key 固定为 `__DEFAULT__`）
   * - `multi`: 多文件模式（生成 `${filename}.{namespace}.json`）
   * @default "multi"
   */
  mode?: 'single' | 'multi'
}

export interface TinyI18nResolvedLocaleConfig {
  code: string
  label?: string
  file?: string
  filename?: string
}

export interface TinyI18nResolvedNamespaceConfig {
  key: string
  description: string
  filename?: string
}

export interface TinyI18nResolvedConfig extends Omit<
  TinyI18nUserConfig,
  'locales'
> {
  locales: TinyI18nResolvedLocaleConfig[]
  filename?: string
  namespaces: TinyI18nResolvedNamespaceConfig[]
  mode: 'single' | 'multi'
}

function resolveLocale(
  locale: TinyI18nLocaleConfig | string,
): TinyI18nResolvedLocaleConfig {
  if (typeof locale === 'string') {
    return {
      code: locale,
      label: locale,
      file: `${locale}.json`,
      filename: `${locale}.json`,
    }
  }

  return {
    code: locale.code,
    label: locale.label ?? locale.code,
    file: locale.file ?? locale.filename ?? `${locale.code}.json`,
    filename: locale.filename ?? `${locale.code}.json`,
  }
}

export function buildNamespaceFilename(
  filenameBase: string,
  namespaceKey: string,
  multipleNamespaces = true,
) {
  if (!multipleNamespaces) {
    return `${filenameBase}.yaml`
  }

  return `${filenameBase}.${namespaceKey}.yaml`
}

export function buildNamespaceFilenameTemplate(
  filenameBase: string,
  multipleNamespaces = true,
) {
  if (!multipleNamespaces) {
    return `${filenameBase}.yaml`
  }

  return `${filenameBase}.{namespace}.yaml`
}

export function normalizeFilenameBase(filename?: string) {
  const value = String(filename ?? '').trim()
  if (!value) {
    return DEFAULT_DATA_FILENAME_BASE
  }

  if (value.includes('{namespace}')) {
    throw new Error('`filename` should be a filename base, not a namespace template')
  }

  if (value.endsWith('.yaml')) {
    return value.slice(0, -'.yaml'.length) || DEFAULT_DATA_FILENAME_BASE
  }

  return value
}

function resolveNamespace(
  namespace: TinyI18nNamespaceConfig,
): TinyI18nResolvedNamespaceConfig {
  const key = String(namespace.key ?? '').trim()
  if (!key) {
    throw new Error('Namespace key cannot be empty')
  }

  return {
    key,
    description: String(namespace.description ?? '').trim(),
  }
}

export function resolveConfig(
  config: TinyI18nUserConfig,
): TinyI18nResolvedConfig {
  const localeConfigs = (config.locales ?? []).map(resolveLocale)

  const mode: 'single' | 'multi' = config.mode ?? 'multi'

  const namespaceInputs = config.namespaces?.length
    ? config.namespaces
    : [{ key: DEFAULT_NAMESPACE_KEY, description: DEFAULT_NAMESPACE_DESCRIPTION }]

  if (mode === 'single') {
    const first = namespaceInputs[0] ?? { key: DEFAULT_NAMESPACE_KEY, description: DEFAULT_NAMESPACE_DESCRIPTION }
    const namespaces = [
      resolveNamespace(
        { key: SINGLE_NAMESPACE_KEY, description: first.description ?? '' },
      ),
    ]

    return {
      ...config,
      locales: localeConfigs,
      namespaces,
      mode,
    }
  }

  const namespaces = namespaceInputs.map(namespace =>
    resolveNamespace(namespace),
  )

  return {
    ...config,
    locales: localeConfigs,
    namespaces,
    mode,
  }
}

export function defineConfig(config: TinyI18nUserConfig) {
  return resolveConfig(config)
}
