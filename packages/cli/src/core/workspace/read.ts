import type {
  TinyI18nDataResponse,
  TinyI18nItem,
  TinyI18nSnapshot,
  TinyI18nTranslationsQuery,
  TinyI18nTranslationsResponse,
} from '../message.ts'
import {
  createEmptyWorkspaceSnapshot,
  emptyConfig,
  pathExists,
  resolveWorkspaceContext,
  workspaceDataDir,
  workspaceDir,
} from './context.ts'
import { openWorkspaceData } from './store.ts'
import { join } from 'node:path'
import {
  buildNamespaceBuckets,
  buildNamespaceMessages,
  createTranslationsResponse,
  filterTranslationsItems,
  normalizeTranslationsQuery,
} from './translations.ts'

/**
 * workspace 读接口（对外 API）。
 *
 * 约束：
 * - `readWorkspaceInfo` 必须保持轻量：不解析 TISF 内容，仅返回 config + 状态
 * - `readWorkspaceSnapshot/translations` 才会读取并解析 namespace 数据文件
 */
export async function readWorkspaceSnapshot(
  projectRoot: string,
): Promise<TinyI18nSnapshot> {
  const {
    config,
    configError,
    configExists,
    targets,
  } = await resolveWorkspaceContext(projectRoot)
  const dataYamlPath = join(projectRoot, workspaceDir, workspaceDataDir, '.skeleton.yaml')
  let exists = false
  const missingTargets: string[] = []

  if (await pathExists(dataYamlPath)) {
    exists = true
  } else {
    for (const target of targets) {
      if (!await pathExists(target.filePath)) {
        missingTargets.push(target.filename)
      }
    }
    exists = missingTargets.length === 0
  }

  if (!exists) {
    return createEmptyWorkspaceSnapshot(
      projectRoot,
      false,
      configExists,
      `Missing ${missingTargets.map(name => `${workspaceDir}/${name}`).join(', ')}`,
      config,
      configError,
    )
  }

  try {
    const store = await openWorkspaceData(projectRoot)
    const resolvedConfig = store.config
    const items = store.data.items
    const namespaceItems = buildNamespaceBuckets(resolvedConfig.namespaces, items)

    return {
      root: join(projectRoot, workspaceDir),
      initialized: exists && configExists,
      config: resolvedConfig,
      languages: resolvedConfig.locales.map((item: { code: string }) => item.code),
      namespaces: resolvedConfig.namespaces,
      namespaceItems,
      namespaceMessages: buildNamespaceMessages(namespaceItems),
      items,
      error: configError,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    return createEmptyWorkspaceSnapshot(
      projectRoot,
      true,
      configExists,
      `Failed to parse workspace data: ${message}`,
      config,
      configError,
    )
  }
}

export async function readWorkspaceInfo(
  projectRoot: string,
): Promise<TinyI18nDataResponse> {
  const {
    config,
    configError,
    configExists,
    targets,
  } = await resolveWorkspaceContext(projectRoot)

  const dataYamlPath = join(projectRoot, workspaceDir, workspaceDataDir, '.skeleton.yaml')
  let exists = false
  const missingTargets: string[] = []

  if (await pathExists(dataYamlPath)) {
    exists = true
  } else {
    for (const target of targets) {
      if (!await pathExists(target.filePath)) {
        missingTargets.push(target.filename)
      }
    }
    exists = missingTargets.length === 0
  }
  const resolvedConfig = config ?? emptyConfig

  return {
    root: join(projectRoot, workspaceDir),
    initialized: exists && configExists,
    config: resolvedConfig,
    languages: resolvedConfig.locales.map((item: { code: string }) => item.code),
    namespaces: resolvedConfig.namespaces,
    error: exists
      ? configError
      : `Missing ${missingTargets.map(name => `${workspaceDir}/${name}`).join(', ')}`,
  }
}

export async function readWorkspaceTranslations(
  projectRoot: string,
  rawQuery?: Partial<TinyI18nTranslationsQuery> | null,
): Promise<TinyI18nTranslationsResponse> {
  const snapshot = await readWorkspaceSnapshot(projectRoot)
  const query = normalizeTranslationsQuery(rawQuery)
  const sourceItems = query.namespace
    ? (snapshot.namespaceItems[query.namespace]?.items ?? [])
    : snapshot.items

  return createTranslationsResponse(
    snapshot,
    query,
    filterTranslationsItems(sourceItems, query, snapshot.languages),
  )
}

export async function readWorkspaceTrash(
  projectRoot: string,
): Promise<{ items: TinyI18nItem[] }> {
  const store = await openWorkspaceData(projectRoot)
  return {
    items: store.data.trash || [],
  }
}
