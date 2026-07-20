import type { Operation } from 'fast-json-patch'
import type { TinyI18nItem } from '../../../cli/src/core/message.ts'
import { randomBytes } from 'node:crypto'
import jsonPatch from 'fast-json-patch'
import { defineEventHandler, readBody } from 'nitro/h3'
import {
  loadWorkspaceNamespaceItems,
  resolveWorkspaceContext,
  workspaceDataDir,
  workspaceDir,
  writeWorkspaceNamespaceFile,
} from '../../../cli/src/core/workspace/index.ts'
import { getProjectRoot } from '../utils/project-root.ts'

const { applyPatch } = jsonPatch

export interface WorkspacePushFile {
  dir: string
  patch: Operation[]
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isTranslationItem(value: unknown) {
  return isRecord(value) && isRecord((value as any).translations)
}

function isTranslationGroup(value: unknown) {
  return isRecord(value) && Array.isArray((value as any).items)
}

/**
 * 对 raw TISF 做最小归一化：
 * - 新格式：`{ $code, $label, items }`
 * - message 节点：`translations` 强制补齐 locales 键，并强制转 string
 * - group 节点：确保 `$label` 为 string（允许空字符串），确保 `items` 为数组
 * - root 的 `$code/$label/items` 做兜底补齐
 */
function normalizeTisfObject(
  root: Record<string, any>,
  locales: string[],
  fallbackCode: string,
  fallbackLabel: string,
) {
  root.$code = typeof root.$code === 'string' && root.$code.trim()
    ? root.$code
    : fallbackCode
  // 空字符串允许存在（不再 trim 后兜底）
  root.$label = typeof root.$label === 'string'
    ? root.$label
    : fallbackLabel
  root.items = Array.isArray(root.items) ? root.items : []

  const walk = (node: unknown) => {
    if (!isRecord(node)) {
      return
    }

    if (isTranslationItem(node)) {
      node.translations = isRecord(node.translations) ? node.translations : {}
      for (const locale of locales) {
        node.translations[locale] = String(node.translations[locale] ?? '')
      }
      return
    }

    if (isTranslationGroup(node)) {
      node.$label = typeof node.$label === 'string' ? node.$label : ''
      node.items = Array.isArray(node.items) ? node.items : []
      for (const child of node.items) {
        walk(child)
      }
    }
  }

  // root 也按 group 逻辑递归 items
  for (const child of root.items) {
    walk(child)
  }
}

/**
 * POST /push
 * - 接收 fast-json-patch 的 JSON Patch（RFC6902）
 * - 将 patch 应用到磁盘上的 raw TISF JSON，并原格式写回
 *
 * 注意：
 * - 不做 409 冲突逻辑（单人编辑模式）
 * - 只允许修改 config 声明的 namespace 文件（通过 name 白名单校验）
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event)

  if (!Array.isArray(body)) {
    throw new TypeError('Invalid push payload: expected an array')
  }

  const projectRoot = getProjectRoot()
  const { config, targets } = await resolveWorkspaceContext(projectRoot)
  const locales = (config?.locales ?? []).map(item => item.code)

  const allowed = new Map<string, { filePath: string, namespace: string, label: string }>()
  const isSingle = config?.mode === 'single'
  for (const target of targets) {
    const name = isSingle
      ? `${workspaceDir}/${workspaceDataDir}`
      : `${workspaceDir}/${workspaceDataDir}/${target.filename}`
    allowed.set(name, {
      filePath: target.filePath,
      namespace: target.namespace ?? '',
      label: String(target.description ?? '').trim() || (target.namespace ?? ''),
    })
  }

  for (const item of body as WorkspacePushFile[]) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid push payload item')
    }
    if (typeof item.dir !== 'string' || !Array.isArray(item.patch)) {
      throw new TypeError('Invalid push payload item: missing dir/patch')
    }

    const target = allowed.get(item.dir)
    if (!target) {
      throw new Error(`Unauthorized file name: ${item.dir}`)
    }

    // 从 __data__.yaml + data/*.yaml 构建 TISF 树
    const nsFiles = await loadWorkspaceNamespaceItems(projectRoot, targets, locales)
    const nsFile = nsFiles.find(f => f.target.namespace === target.namespace)
    if (!nsFile)
      throw new Error(`Namespace not found: ${target.namespace}`)

    // 构建 TISF 树（和 pull 一样的方法）
    const childMap = new Map<string | undefined, TinyI18nItem[]>()
    for (const it of nsFile.items) {
      const bucket = childMap.get(it.parent) ?? []
      bucket.push(it); childMap.set(it.parent, bucket)
    }
    function buildTree(pid: string | undefined): any[] {
      return (childMap.get(pid) ?? []).map((ch) => {
        const base: any = { $id: ch.id, key: ch.key }
        if (ch.type === 'message') {
          base.translations = { ...ch.translations }
        }
        else {
          base.$label = (ch as any).title ?? ''
          base.items = buildTree(ch.id)
        }
        return base
      })
    }
    const root = nsFile.items.find(i => !i.parent)
    const doc: Record<string, any> = {
      $code: target.namespace,
      $label: target.label,
      items: root ? buildTree(root.id) : [],
    }

    // applyPatch 默认会原地修改 doc；这里直接用 mutate 结果写回即可
    applyPatch(doc, item.patch, true)
    normalizeTisfObject(doc, locales, target.namespace, target.label)

    // 转回 TinyI18nItem[] 并写入 __data__.yaml + data/*.yaml
    const flatItems = flattenTisfTree(doc)
    await writeWorkspaceNamespaceFile(projectRoot, flatItems, locales)
  }

  return { success: true }
})
function flattenTisfTree(root: Record<string, any>): TinyI18nItem[] {
  const items: TinyI18nItem[] = []
  const nanoIdChars = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'
  function nanoid(size = 11) {
    const bytes = randomBytes(size)
    let id = ''
    for (let i = 0; i < size; i++) id += nanoIdChars[bytes[i] & 63]
    return id
  }

  function walk(node: any, parentId?: string) {
    const id = node.$id || nanoid()
    if (node.translations) {
      const tls: Record<string, string> = {}
      for (const [k, v] of Object.entries(node.translations ?? {})) tls[k] = String(v ?? '')
      items.push({ id, type: 'message', key: node.key ?? '', parent: parentId, translations: tls, index: undefined })
    }
    else {
      items.push({ id, type: 'group', key: node.key ?? '', parent: parentId, title: node.$label ?? '', index: undefined })
      for (const child of node.items ?? []) walk(child, id)
    }
  }

  const rootId = nanoid()
  items.push({ id: rootId, type: 'group', key: root.$code ?? '', parent: undefined, title: root.$label ?? '', index: undefined })
  for (const child of root.items ?? []) walk(child, rootId)
  return items
}
