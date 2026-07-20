import type { TinyI18nDataFile, TinyI18nItem, TinyI18nMessage, TinyI18nOperation } from '../message.ts'

/**
 * 纯操作层：只处理 items/trash 的内存变换，不涉及任何 IO。
 *
 * 约定：
 * - 所有函数尽量保持纯（或至少可预测），便于 apply 层组合
 * - 与 TISF 的序列化/解析解耦（TISF 属于 `tisf.ts`）
 */
export function stripNamespace(items: TinyI18nItem[]) {
  return items.map((item) => {
    const nextItem = { ...item }
    delete nextItem.namespace
    return nextItem
  })
}

export function normalizeIndexes(items: TinyI18nItem[]): { items: TinyI18nItem[], changed: boolean } {
  const byId = new Map(items.map(item => [item.id, item]))
  const position = new Map(items.map((item, i) => [item.id, i]))
  const childIdsByParent = new Map<string, string[]>()
  let changed = false

  for (const item of items) {
    if (!item.parent)
      continue
    const bucket = childIdsByParent.get(item.parent) ?? []
    bucket.push(item.id)
    childIdsByParent.set(item.parent, bucket)
  }

  function getIndex(id: string) {
    const idx = byId.get(id)?.index
    return typeof idx === 'number' ? idx : 0
  }
  function getPos(id: string) {
    return position.get(id) ?? 0
  }

  const rootIds = items
    .filter(item => !item.parent || !byId.has(item.parent))
    .map(item => item.id)
    .sort((a, b) => {
      const diff = getIndex(a) - getIndex(b)
      return diff !== 0 ? diff : getPos(a) - getPos(b)
    })

  function normalizeChildren(parentId?: string) {
    const ids = parentId ? (childIdsByParent.get(parentId) ?? []) : rootIds
    const sortedIds = [...ids].sort((a, b) => {
      const diff = getIndex(a) - getIndex(b)
      return diff !== 0 ? diff : getPos(a) - getPos(b)
    })

    for (let i = 0; i < sortedIds.length; i++) {
      const item = byId.get(sortedIds[i])
      if (!item)
        continue
      if (item.index !== i) {
        item.index = i
        changed = true
      }
    }

    for (const id of sortedIds) {
      normalizeChildren(id)
    }
  }

  normalizeChildren()

  return { items, changed }
}

export function collectDescendantIds(items: TinyI18nItem[], ids: Iterable<string>) {
  const collectedIds = new Set(ids)
  let changed = true

  while (changed) {
    changed = false

    for (const item of items) {
      if (!item.parent || collectedIds.has(item.id)) {
        continue
      }

      if (collectedIds.has(item.parent)) {
        collectedIds.add(item.id)
        changed = true
      }
    }
  }

  return collectedIds
}

export function sortItemsByIndexAndParent(items: TinyI18nItem[]): TinyI18nItem[] {
  // TISF 的排序规则：Group 在前、Message 在后、同类型 key A→Z
  const itemsById = new Map(items.map(item => [item.id, item]))
  const childrenByParent = new Map<string | undefined, TinyI18nItem[]>()

  for (const item of items) {
    const parent = item.parent
    const bucket = childrenByParent.get(parent) ?? []
    bucket.push(item)
    childrenByParent.set(parent, bucket)
  }

  function sortChildren(values: TinyI18nItem[]) {
    const groups = values.filter(item => item.type === 'group').sort((a, b) => a.key.localeCompare(b.key))
    const messages = values.filter(item => item.type === 'message').sort((a, b) => a.key.localeCompare(b.key))
    return [...groups, ...messages]
  }

  const roots = sortChildren(items.filter(item => !item.parent || !itemsById.has(item.parent)))

  const sorted: TinyI18nItem[] = []
  function flatten(item: TinyI18nItem) {
    sorted.push(item)
    const children = sortChildren(childrenByParent.get(item.id) ?? [])
    for (const child of children) {
      flatten(child)
    }
  }

  for (const root of roots) {
    flatten(root)
  }

  return sorted
}

export function applyOperation(data: TinyI18nDataFile, operation: TinyI18nOperation): TinyI18nDataFile {
  const { items, trash = [] } = data

  if (operation.type === 'create') {
    return { ...data, items: [...items, operation.data] }
  }

  if (operation.type === 'update') {
    return {
      ...data,
      items: items.map((item) => {
        if (item.id !== operation.data.id) {
          return item
        }

        if (item.type === 'message') {
          return {
            ...item,
            ...operation.data.patch,
            translations: {
              ...item.translations,
              ...(operation.data.patch as Partial<TinyI18nMessage>).translations,
            },
          } as TinyI18nItem
        }

        return {
          ...item,
          ...operation.data.patch,
        } as TinyI18nItem
      }),
    }
  }

  if (operation.type === 'delete') {
    const removedIds = collectDescendantIds(items, operation.data.ids)
    const removedItems = items.filter(item => removedIds.has(item.id))

    return {
      ...data,
      items: items.filter(item => !removedIds.has(item.id)),
      trash: [...trash, ...removedItems],
    }
  }

  if (operation.type === 'restore') {
    const restoredIds = collectDescendantIds(trash, operation.data.ids)
    const restoredItems = trash.filter(item => restoredIds.has(item.id))
    const nextItems = [...items, ...restoredItems]

    return {
      ...data,
      items: sortItemsByIndexAndParent(nextItems),
      trash: trash.filter(item => !restoredIds.has(item.id)),
    }
  }

  if (operation.type === 'permanent_delete') {
    const permanentlyDeletedIds = collectDescendantIds(trash, operation.data.ids)
    return {
      ...data,
      trash: trash.filter(item => !permanentlyDeletedIds.has(item.id)),
    }
  }

  // move
  const movingIds = collectDescendantIds(items, operation.data.ids)

  // 不能把节点移动到自己的子树里
  if (operation.data.parent && movingIds.has(operation.data.parent)) {
    return data
  }

  return {
    ...data,
    items: items.map((item) => {
      if (!operation.data.ids.includes(item.id)) {
        return item
      }

      return {
        ...item,
        parent: operation.data.parent,
      }
    }),
  }
}
