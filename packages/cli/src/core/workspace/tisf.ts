import type { TinyI18nItem } from '../message.ts'
import type { WorkspaceDataTarget } from './context.ts'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dump, load } from 'js-yaml'
import { DEFAULT_NAMESPACE_KEY, SINGLE_NAMESPACE_KEY } from '../config.ts'
import { pathExists, trashFilename, workspaceDataDir, workspaceDir } from './context.ts'

/**
 * TISF（TinyI18n Source Format）读写与解析。
 *
 * 核心点：
 * - 大文件读取使用“按行 + 花括号计数”的流式解析，只抓取顶层 node 的 object
 * - message/group 的判定依赖 locales（message node 的 key 必须全部是 locale code）
 * - 空对象 `{}` 代表空 group，不能误判成 message（否则会导致 type 漂移）
 */

function sanitizeTisfKey(value: unknown, fallback: string) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || fallback
}

export async function readWorkspaceTrashFile(projectRoot: string): Promise<TinyI18nItem[]> {
  const filePath = join(projectRoot, workspaceDir, trashFilename)
  if (!await pathExists(filePath)) {
    return []
  }

  try {
    const parsed = load(await readFile(filePath, 'utf8')) as unknown
    return Array.isArray(parsed) ? (parsed as TinyI18nItem[]) : []
  } catch {
    return []
  }
}

export async function writeWorkspaceTrashFile(projectRoot: string, trash: TinyI18nItem[]) {
  const filePath = join(projectRoot, workspaceDir, trashFilename)
  await writeFile(filePath, `${dump(trash)}\n`)
}

function normalizeKeysToUnique(keys: string[]) {
  const used = new Set<string>()
  const normalized: string[] = []

  for (const raw of keys) {
    const base = raw
    let next = base
    let index = 2

    while (used.has(next)) {
      next = `${base}-${index++}`
    }

    used.add(next)
    normalized.push(next)
  }

  return normalized
}

export function normalizeItemsToPathBasedIds(items: TinyI18nItem[]) {
  const byOldId = new Map<string, TinyI18nItem>(items.map(item => [item.id, item]))
  const childrenByOldParent = new Map<string | undefined, TinyI18nItem[]>()

  for (const item of items) {
    const bucket = childrenByOldParent.get(item.parent) ?? []
    bucket.push(item)
    childrenByOldParent.set(item.parent, bucket)
  }

  function sortChildren(values: TinyI18nItem[]) {
    const groups = values.filter(item => item.type === 'group').sort((a, b) => a.key.localeCompare(b.key))
    const messages = values.filter(item => item.type !== 'group').sort((a, b) => a.key.localeCompare(b.key))
    return [...groups, ...messages]
  }

  const nextItems: TinyI18nItem[] = []
  const oldToNew = new Map<string, string>()
  let nextIdCounter = 1

  function walk(oldItem: TinyI18nItem, parentNewId?: string, parentPath?: string) {
    const id = String(nextIdCounter++)
    oldToNew.set(oldItem.id, id)
    const path = parentPath ? `${parentPath}.${oldItem.key}` : oldItem.key

    const cloned: TinyI18nItem = {
      ...oldItem,
      id,
      parent: parentNewId,
      chain: path,
    } as unknown as TinyI18nItem

    nextItems.push(cloned)

    const children = sortChildren(childrenByOldParent.get(oldItem.id) ?? [])
    const childKeys = children.map(child => sanitizeTisfKey(child.key, child.type === 'group' ? 'group' : 'message'))
    const uniqueChildKeys = normalizeKeysToUnique(childKeys)

    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      walk({ ...child, key: uniqueChildKeys[i] } as TinyI18nItem, id, path)
    }
  }

  const roots = sortChildren(items.filter(item => !item.parent || !byOldId.has(item.parent)))
  const rootKeys = roots.map(item => sanitizeTisfKey(item.key, item.type === 'group' ? 'group' : 'message'))
  const uniqueRootKeys = normalizeKeysToUnique(rootKeys)

  for (let i = 0; i < roots.length; i++) {
    walk({ ...roots[i], key: uniqueRootKeys[i] } as TinyI18nItem, undefined, undefined)
  }

  return { items: nextItems, oldToNew }
}

export function createDefaultDataSource(target?: WorkspaceDataTarget) {
  const code = target?.namespace ?? DEFAULT_NAMESPACE_KEY
  return dump({ file: '.skeleton.yaml', desc: `命名空间 ${code} 的树骨架`, data: {} })
}

export async function loadWorkspaceNamespaceItems(
  projectRoot: string,
  targets: WorkspaceDataTarget[],
  locales: string[],
) {
  const dataDir = join(projectRoot, workspaceDir, workspaceDataDir)

  // For each namespace, read per-namespace files
  return Promise.all(targets.map(async (target) => {
    const nsKey = target.namespace ?? DEFAULT_NAMESPACE_KEY
    const nsDir = join(dataDir, nsKey)
    const allItems: TinyI18nItem[] = []

    // Try multi-namespace (data/{ns}/.skeleton.yaml), fallback to single (data/.skeleton.yaml)
    let nodes: Record<string, any> = {}
    let localeDir = nsDir

    if (await pathExists(join(nsDir, '.skeleton.yaml'))) {
      nodes = (load(await readFile(join(nsDir, '.skeleton.yaml'), 'utf8')) as any)?.data ?? {}
    } else {
      const rootSkel = join(dataDir, '.skeleton.yaml')
      if (await pathExists(rootSkel)) {
        const r = load(await readFile(rootSkel, 'utf8')) as any
        if (r?.data && !r.namesapce) {
          nodes = r.data
          localeDir = dataDir
        } else {
          return { target, items: allItems }
        }
      } else {
        return { target, items: allItems }
      }
    }

    // Read per-namespace locale files
    const localeTls: Record<string, Record<string, string>> = {}
    for (const locale of locales) {
      const p = join(localeDir, `${locale}.yaml`)
      const raw = await pathExists(p) ? load(await readFile(p, 'utf8')) : {}
      localeTls[locale] = (raw && typeof raw === 'object' && !Array.isArray(raw) && 'data' in (raw as any))
        ? (raw as any).data as Record<string, string>
        : (raw ?? {}) as Record<string, string>
    }

    // Build items
    for (const [id, n] of Object.entries(nodes)) {
      const node = n as Record<string, any>
      const isNs = node.type === 'namespace'
      if (node.type === 'message') {
        const tls: Record<string, string> = {}
        for (const locale of locales) tls[locale] = localeTls[locale]?.[id] ?? ''
        allItems.push({ id, parent: isNs ? undefined : node.$parent ?? undefined, type: 'message', key: node.key ?? '', translations: tls, index: undefined })
      } else {
        allItems.push({ id, parent: isNs ? undefined : node.$parent ?? undefined, type: 'group', key: node.key ?? '', title: node.$label ?? '', index: undefined })
      }
    }
    return { target, items: allItems }
  }))
}

export async function writeWorkspaceNamespaceFile(projectRoot: string, items: TinyI18nItem[], locales: string[]) {
  const dataDir = join(projectRoot, workspaceDir, workspaceDataDir)
  const nsRoot = items.find(i => i.type === 'group' && !i.parent)
  const nsKey = nsRoot?.key ?? DEFAULT_NAMESPACE_KEY
  const isMulti = nsRoot != null && nsKey !== SINGLE_NAMESPACE_KEY
  const targetDir = isMulti ? join(dataDir, nsKey) : dataDir
  await mkdir(targetDir, { recursive: true })

  const dataNodes: Record<string, any> = {}
  for (const item of items) {
    const nodeType = item.type === 'group' && !item.parent ? 'namespace' : item.type
    dataNodes[item.id] = { type: nodeType, key: item.key ?? '', $parent: item.parent ?? null }
    if (item.type === 'group')
      dataNodes[item.id].$label = item.title ?? ''
  }
  await writeFile(join(targetDir, '.skeleton.yaml'), dump({ file: '.skeleton.yaml', desc: isMulti ? `命名空间 ${nsKey} 的树骨架` : '命名空间索引 骨架 总体', data: dataNodes }))

  if (isMulti) {
    const idxPath = join(dataDir, '.skeleton.yaml')
    const idx = await pathExists(idxPath) ? load(await readFile(idxPath, 'utf8')) as Record<string, any> : { file: '.skeleton.yaml', desc: '命名空间索引 骨架 总体' }
    if (!idx.namesapce)
      idx.namesapce = {}
    if (nsRoot)
      idx.namesapce[nsRoot.id] = { $key: nsRoot.key ?? '', $desc: (nsRoot as any).title ?? '', $label: (nsRoot as any).title ?? nsRoot.key ?? '' }
    await writeFile(idxPath, dump(idx))
  }

  const localeTls: Record<string, Record<string, string>> = {}
  for (const locale of locales) {
    const p = join(targetDir, `${locale}.yaml`)
    const raw = await pathExists(p) ? load(await readFile(p, 'utf8')) : {}
    localeTls[locale] = (raw && typeof raw === 'object' && !Array.isArray(raw) && 'data' in (raw as any))
      ? (raw as any).data as Record<string, string>
      : (raw ?? {}) as Record<string, string>
  }
  for (const item of items) {
    if (item.type !== 'message')
      continue
    for (const locale of locales) localeTls[locale][item.id] = item.translations?.[locale] ?? ''
  }
  for (const locale of locales) {
    const sorted: Record<string, string> = {}
    for (const id of Object.keys(localeTls[locale]).sort()) sorted[id] = localeTls[locale][id]
    await writeFile(join(targetDir, `${locale}.yaml`), dump({ file: `${locale}.yaml`, desc: `${locale} 翻译数据`, data: sorted }))
  }
}
