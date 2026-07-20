import type { TinyI18nResolvedConfig, TinyI18nUserConfig } from '../config.ts'
import type { TinyI18nDataFile, TinyI18nItem, TinyI18nSnapshot } from '../message.ts'
import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { dump, FAILSAFE_SCHEMA, load } from 'js-yaml'
import {
  buildNamespaceFilename,
  buildNamespaceFilenameTemplate,
  DEFAULT_DATA_FILENAME_BASE,
  DEFAULT_NAMESPACE_DESCRIPTION,
  DEFAULT_NAMESPACE_KEY,
  resolveConfig,
  SINGLE_NAMESPACE_KEY,
} from '../config.ts'

/**
 * workspace 上下文与配置加载。
 *
 * 这个模块聚合了 workspace 最基础的“环境信息”：
 * - workspace 目录/文件命名常量
 * - config.json 的读取、校验与缓存（mtime/size 签名）
 * - namespaces -> data targets 的解析/推导
 *
 * 依赖规则：
 * - 允许依赖 `../config.ts`、`../message.ts`
 * - 不允许依赖 `store/read/apply`，避免循环依赖
 */
export const workspaceDir = '.tinyi18n'
/**
 * namespace 数据文件所在子目录。
 *
 * 约定：
 * - `.tinyi18n/config.json` 仍位于 workspace 根目录
 * - namespace 数据文件位于 `.tinyi18n/data/<filename>`
 */
export const workspaceDataDir = 'data'
export const configFilename = 'config.yaml'
export const trashFilename = '.trash.yaml'

export const emptyConfig: TinyI18nResolvedConfig = {

  locales: [],
  namespaces: [{
    key: SINGLE_NAMESPACE_KEY,
    description: DEFAULT_NAMESPACE_DESCRIPTION,

  }],
  mode: 'single',
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export async function pathExists(path: string) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

export interface InitWorkspaceResult {
  created: boolean
  workspaceDir: string
  configFile: string
  dataFiles?: string[]
}

export const defaultConfigSource = dump({

  namespaces: [
    { key: DEFAULT_NAMESPACE_KEY, description: DEFAULT_NAMESPACE_DESCRIPTION },
  ],
  locales: [
    { code: 'zh-CN', filename: 'zh-CN.yaml' },
  ],
  defaultLocale: 'zh-CN',
  mode: 'multi',
})

export interface WorkspaceDataTarget {
  namespace?: string
  description?: string
  filename: string
  filePath: string
}

function parseWorkspaceDataFilename(filename: string) {
  if (!filename.startsWith('.') || !filename.endsWith('.yaml')) {
    return null
  }

  const withoutExt = filename.slice(0, -'.yaml'.length)
  const lastDotIndex = withoutExt.lastIndexOf('.')

  if (lastDotIndex <= 0) {
    return {
      filenameBase: withoutExt,
      namespace: SINGLE_NAMESPACE_KEY,
    }
  }

  return {
    filenameBase: withoutExt.slice(0, lastDotIndex),
    namespace: withoutExt.slice(lastDotIndex + 1),
  }
}

async function inferNamespaceTargets(projectRoot: string) {
  const workspaceRoot = join(projectRoot, workspaceDir)
  const dataRoot = join(workspaceRoot, workspaceDataDir)
  if (!await pathExists(dataRoot)) {
    return [] as WorkspaceDataTarget[]
  }

  const filenames = await readdir(dataRoot)
  return filenames.reduce<WorkspaceDataTarget[]>((targets, filename: string) => {
    const parsed = parseWorkspaceDataFilename(filename)
    if (!parsed) {
      return targets
    }

    targets.push({
      namespace: parsed.namespace,
      filename,
      filePath: join(dataRoot, filename),
    })
    return targets
  }, [])
}

function inferResolvedConfigFromTargets(
  targets: WorkspaceDataTarget[],
  baseConfig?: TinyI18nResolvedConfig | null,
): TinyI18nResolvedConfig {
  const filenameBase = parseWorkspaceDataFilename(targets[0]?.filename ?? '')?.filenameBase
    ?? DEFAULT_DATA_FILENAME_BASE
  const parsedTargets = targets
    .map(target => parseWorkspaceDataFilename(target.filename))
    .filter(Boolean) as Array<{ filenameBase: string, namespace: string }>
  const mode: 'single' | 'multi' = parsedTargets.some(t => t.namespace !== SINGLE_NAMESPACE_KEY)
    ? 'multi'
    : 'single'
  const multipleNamespaces = mode === 'multi'

  if (mode === 'single') {
    const firstTarget = targets[0]
    return {
      ...(baseConfig ?? emptyConfig),
      filename: buildNamespaceFilenameTemplate(filenameBase, false),
      namespaces: [{
        key: SINGLE_NAMESPACE_KEY,
        description: firstTarget?.description ?? DEFAULT_NAMESPACE_DESCRIPTION,
        filename: buildNamespaceFilename(filenameBase, SINGLE_NAMESPACE_KEY, false),
      }],
      mode,
    }
  }

  return {
    ...(baseConfig ?? emptyConfig),
    filename: buildNamespaceFilenameTemplate(filenameBase, multipleNamespaces),
    namespaces: targets.map(target => ({
      key: target.namespace ?? '',
      description: target.description ?? '',
      filename: target.filename,
    })),
    mode,
  }
}

function inferLocalesFromItems(items: TinyI18nItem[]) {
  const codes = new Set<string>()

  for (const item of items) {
    if (item.type !== 'message') {
      continue
    }

    for (const code of Object.keys(item.translations ?? {})) {
      codes.add(code)
    }
  }

  return [...codes].map(code => ({
    code,
    filename: `${code}.yaml`,
  }))
}

function withNamespace(items: TinyI18nItem[], namespace?: string) {
  if (!namespace) {
    return items
  }

  return items.map(item => ({
    ...item,
    namespace: item.namespace ?? namespace,
  }))
}

export function enrichResolvedConfig(
  config: TinyI18nResolvedConfig,
  files: Array<{ target: WorkspaceDataTarget, data: TinyI18nDataFile }>,
) {
  const nextNamespaces = config.namespaces.map(namespace => ({
    ...namespace,
    description:
      files.find(file => file.target.namespace === namespace.key)?.data.description
      || namespace.description,
  }))

  if (config.locales.length > 0) {
    return {
      ...config,
      namespaces: nextNamespaces,
    }
  }

  const items = files.flatMap(file =>
    withNamespace(file.data.items ?? [], file.target.namespace),
  )

  return {
    ...config,
    locales: inferLocalesFromItems(items),
    namespaces: nextNamespaces,
  }
}

async function resolveWorkspaceConfigFile(projectRoot: string) {
  const configFile = join(projectRoot, workspaceDir, configFilename)

  if (await pathExists(configFile)) {
    return {
      configFile,
      configExists: true,
    }
  }

  return {
    configFile,
    configExists: false,
  }
}

async function loadWorkspaceConfigModule(
  configFile: string,
): Promise<TinyI18nUserConfig> {
  const raw = await readFile(configFile, 'utf8')
  const config = load(raw, { schema: FAILSAFE_SCHEMA }) as unknown
  if (!config || typeof config !== 'object') {
    throw new Error(`Unsupported config format in ${configFile}`)
  }

  return config as TinyI18nUserConfig
}

type WorkspaceConfigCacheEntry
  = | { signature: string, ok: true, config: TinyI18nResolvedConfig }
    | { signature: string, ok: false, error: string }

const workspaceConfigCache = new Map<string, WorkspaceConfigCacheEntry>()

function isResolvedConfig(config: unknown): config is TinyI18nResolvedConfig {
  return Boolean(
    config
    && typeof config === 'object'
    && 'filename' in config
    && Array.isArray((config as TinyI18nResolvedConfig).locales)
    && Array.isArray((config as TinyI18nResolvedConfig).namespaces)
    && (config as TinyI18nResolvedConfig).locales.every(locale =>
      locale && typeof locale === 'object' && (typeof (locale as any).filename === 'string' || typeof (locale as any).file === 'string'),
    )
    && (config as TinyI18nResolvedConfig).namespaces.every(namespace =>
      namespace && typeof namespace === 'object' && typeof (namespace as any).filename === 'string',
    ),
  )
}

export async function readConfigData(configFile: string, configExists: boolean) {
  if (!configExists) {
    return { config: null }
  }

  try {
    const fileStat = await stat(configFile)
    const signature = `${fileStat.mtimeMs}:${fileStat.ctimeMs}:${fileStat.size}`
    const cached = workspaceConfigCache.get(configFile)
    if (cached && cached.signature === signature) {
      if (cached.ok) {
        return { config: cached.config }
      }

      const configError = 'error' in cached ? cached.error : 'Unknown workspace config error'
      return { config: null, configError }
    }

    const userConfig = await loadWorkspaceConfigModule(configFile)
    const config = isResolvedConfig(userConfig)
      ? userConfig
      : resolveConfig(userConfig)

    workspaceConfigCache.set(configFile, {
      ok: true,
      signature,
      config,
    })

    return { config }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    try {
      const fileStat = await stat(configFile)
      const signature = `${fileStat.mtimeMs}:${fileStat.ctimeMs}:${fileStat.size}`
      workspaceConfigCache.set(configFile, {
        ok: false,
        signature,
        error: message,
      })
    } catch {
      // ignore
    }

    return { config: null, configError: message }
  }
}

export function clearWorkspaceConfigCache(configFile: string) {
  workspaceConfigCache.delete(configFile)
}

export function resolveWorkspaceDataTargets(
  projectRoot: string,
  configData?: TinyI18nResolvedConfig | null,
) {
  const workspaceRoot = join(projectRoot, workspaceDir)
  const dataRoot = join(workspaceRoot, workspaceDataDir)
  const namespaces = configData?.namespaces?.length
    ? configData.namespaces
    : emptyConfig.namespaces

  return namespaces.map(namespace => ({
    namespace: namespace.key,
    description: namespace.description,
    filename: namespace.filename ?? namespace.key,
    filePath: join(dataRoot, namespace.filename ?? namespace.key),
  }))
}

export async function resolveWorkspaceContext(projectRoot: string) {
  const { configFile, configExists } = await resolveWorkspaceConfigFile(projectRoot)
  const { config: rawConfig, configError } = await readConfigData(configFile, configExists)
  const inferredTargets = await inferNamespaceTargets(projectRoot)

  const inferredConfig = inferredTargets.length > 0
    && (!rawConfig || rawConfig.namespaces.length === 0)
    ? inferResolvedConfigFromTargets(inferredTargets, rawConfig)
    : null

  const config = inferredConfig ?? rawConfig
  const effectiveConfigExists = configExists || inferredConfig != null
  const targets = inferredConfig != null
    ? inferredTargets
    : resolveWorkspaceDataTargets(projectRoot, config)

  return {
    config,
    configError,
    configExists: effectiveConfigExists,
    targets,
  }
}

export function createEmptyWorkspaceSnapshot(
  projectRoot: string,
  exists: boolean,
  configExists: boolean,
  error: string,
  configData: TinyI18nResolvedConfig | null,
  configError?: string,
): TinyI18nSnapshot {
  return {
    root: projectRoot,
    initialized: exists && configExists,
    config: configData ?? emptyConfig,
    languages: (configData ?? emptyConfig).locales.map(item => item.code),
    namespaces: (configData ?? emptyConfig).namespaces,
    namespaceItems: {},
    namespaceMessages: {},
    items: [],
    error: error || configError,
  }
}

export async function ensureNamespaceDirs(projectRoot: string, config: any) {
  const dataDir = join(projectRoot, workspaceDir, workspaceDataDir)
  for (const ns of config.namespaces ?? []) {
    await mkdir(join(dataDir, ns.key), { recursive: true }).catch(() => {})
  }
}

export async function ensureWorkspaceDir(projectRoot: string) {
  const workspaceRoot = join(projectRoot, workspaceDir)
  await mkdir(workspaceRoot, { recursive: true })
  await mkdir(join(workspaceRoot, workspaceDataDir), { recursive: true })
}
