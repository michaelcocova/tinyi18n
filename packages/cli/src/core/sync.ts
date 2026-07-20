import type { TinyI18nResolvedConfig } from './config.ts'
import type {
  TinyI18nItem,
  TinyI18nMessage,
  TinyI18nSnapshot,
} from './message.ts'

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { readWorkspaceSnapshot } from './workspace/index.ts'

export type TinyI18nSyncResult
  = | {
    ok: true
    files: string[]
    skipped: TinyI18nSyncSkippedItem[]
  }
  | {
    ok: false
    error: string
  }

export interface TinyI18nSyncSkippedItem {
  id: string
  path: string
  reason: string
}

function createItemsById(items: TinyI18nItem[]) {
  return new Map(items.map(item => [item.id, item]))
}

function resolveMessagePath(
  message: TinyI18nMessage,
  itemsById: Map<string, TinyI18nItem>,
) {
  // 注意：key 可能被用户误输入了换行/空格（例如 "ssl\n"），
  // 如果不做处理会直接变成 JSON 的对象 key，最终输出 `"ssl\\n": { ... }`。
  const segments = [message.key.trim()]
  let parentId = message.parent

  while (parentId) {
    const parent = itemsById.get(parentId)

    if (!parent) {
      break
    }

    if (parent.type === 'message') {
      throw new Error(
        `Message "${message.key}" cannot be nested under another message`,
      )
    }

    segments.unshift(parent.key.trim())
    parentId = parent.parent
  }

  return segments
}

function setNestedValue(
  target: Record<string, unknown>,
  segments: string[],
  value: string,
  locale: string,
) {
  const fullPath = segments.join('.')
  let cursor = target

  for (const [index, segment] of segments.entries()) {
    const isLeaf = index === segments.length - 1
    const current = cursor[segment]

    if (isLeaf) {
      if (current != null && typeof current === 'object') {
        throw new Error(
          `Cannot overwrite object path "${fullPath}" in locale "${locale}"`,
        )
      }

      cursor[segment] = value
      return
    }

    if (current == null) {
      const next: Record<string, unknown> = {}
      cursor[segment] = next
      cursor = next
      continue
    }

    if (typeof current !== 'object' || Array.isArray(current)) {
      throw new TypeError(
        `Path conflict at "${segments.slice(0, index + 1).join('.')}" in locale "${locale}"`,
      )
    }

    cursor = current as Record<string, unknown>
  }
}

function createSyncPlan(snapshot: TinyI18nSnapshot) {
  const itemsById = createItemsById(snapshot.items)
  const messages = snapshot.items.filter(
    (item): item is TinyI18nMessage => item.type === 'message',
  )
  const skipped: TinyI18nSyncSkippedItem[] = []
  const syncableMessages: Array<{
    message: TinyI18nMessage
    namespace: string
    path: string[]
    fullPath: string
  }>
    = []

  for (const message of messages) {
    const path = resolveMessagePath(message, itemsById)
    const namespace = String(message.namespace ?? '').trim()

    // resolveMessagePath 已经 trim 过，但这里仍然二次防御
    if (path.some(segment => !String(segment ?? '').trim())) {
      skipped.push({
        id: message.id,
        path: path.join('.'),
        reason: 'empty key segment',
      })
      continue
    }

    syncableMessages.push({
      message,
      namespace,
      path,
      fullPath: path.join('.'),
    })
  }

  syncableMessages.sort((left, right) =>
    `${left.namespace}:${left.fullPath}`.localeCompare(`${right.namespace}:${right.fullPath}`),
  )

  return {
    skipped,
    syncableMessages,
  }
}

function createLocalePayload(
  syncableMessages: Array<{
    message: TinyI18nMessage
    path: string[]
    outputPath: string[]
  }>,
  locale: string,
) {
  const payload: Record<string, unknown> = {}

  for (const entry of syncableMessages) {
    setNestedValue(
      payload,
      entry.outputPath,
      entry.message.translations[locale] ?? '',
      locale,
    )
  }

  return payload
}

function createEntrySyncPlan(
  config: TinyI18nResolvedConfig,
  syncableMessages: Array<{
    message: TinyI18nMessage
    namespace: string
    path: string[]
    fullPath: string
  }>,
) {
  const isMultiMode = config.mode === 'multi'

  return (config.entries ?? []).map((entry) => {
    const rawNamespaces = entry.namespaces
    const entryNamespaces = Array.isArray(rawNamespaces)
      ? rawNamespaces
      : rawNamespaces != null
        ? [rawNamespaces]
        : []
    const configuredNamespaces = entryNamespaces
      .map(item => String(item ?? '').trim())
      .filter(Boolean)
    const configuredPaths = Array.isArray(entry.paths)
      ? entry.paths.map(item => String(item ?? '').trim()).filter(Boolean)
      : []

    const activeNamespaces = isMultiMode ? configuredNamespaces : []
    const activePaths = configuredPaths
    const includePaths = activePaths.filter(p => !p.startsWith('!'))
    const excludePaths = activePaths.filter(p => p.startsWith('!')).map(p => p.slice(1))
    // 单命名空间模式下，去掉命名空间前缀再匹配 paths
    const toSearchPath = (item: any) => isMultiMode
      ? item.fullPath
      : item.path.slice(1).join('.')

    const entryMessages = syncableMessages.filter((item) => {
      const matchedNamespace = activeNamespaces.length === 0
        || activeNamespaces.includes(item.namespace)
      const sp = toSearchPath(item)
      const matchedPath = activePaths.length === 0
        || (
          (includePaths.length === 0 || includePaths.some(path => sp === path || sp.startsWith(`${path}.`)))
          && !excludePaths.some(path => sp === path || sp.startsWith(`${path}.`))
        )

      return matchedNamespace && matchedPath
    }).map(item => ({
      ...item,
      outputPath: isMultiMode ? item.path : item.path.slice(1),
    }))

    return {
      entry,
      syncableMessages: entryMessages,
    }
  })
}

async function writeLocaleFile(
  projectRoot: string,
  filename: string,
  payload: Record<string, unknown>,
) {
  const filePath = resolve(projectRoot, filename)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`)
  return filePath
}

export async function syncWorkspaceToProjectFiles(
  projectRoot: string,
): Promise<TinyI18nSyncResult> {
  try {
    const snapshot = await readWorkspaceSnapshot(projectRoot)

    if (!snapshot.initialized) {
      return {
        ok: false,
        error: '工作区未初始化，请先运行 `tinyi18n ui` 命令进行配置',
      }
    }

    if (snapshot.error) {
      return { ok: false, error: snapshot.error }
    }

    if (!snapshot.config.locales.length) {
      return { ok: false, error: '未配置任何多语言 (locales)' }
    }

    const { skipped, syncableMessages } = createSyncPlan(snapshot)
    const entrySyncPlan = createEntrySyncPlan(
      snapshot.config,
      syncableMessages,
    )

    if (!entrySyncPlan.length) {
      return { ok: false, error: '未配置任何源码入口 (entries)' }
    }

    const files = await Promise.all(
      entrySyncPlan.flatMap(({ entry, syncableMessages: entryMessages }) =>
        snapshot.config.locales.map(async (locale) => {
          // Prevent empty dir from causing absolute path like "/zh-CN.json"
          const baseDir = entry.dir ? entry.dir : '.'
          const filename = `${baseDir}/${locale.file || locale.filename || `${locale.code}.json`}`
          return writeLocaleFile(
            projectRoot,
            filename,
            createLocalePayload(entryMessages, locale.code),
          )
        }),
      ),
    )

    return {
      ok: true,
      files,
      skipped,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
