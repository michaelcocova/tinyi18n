import type {
  TinyI18nDataFile,
  TinyI18nItem,
  TinyI18nOperation,
  TinyI18nOperationResult,
} from '../message.ts'
import { applyOperation, collectDescendantIds, normalizeIndexes } from './operations.ts'
import { openWorkspaceData } from './store.ts'
import { normalizeItemsToPathBasedIds } from './tisf.ts'

/**
 * workspace 写接口（对外 API）。
 *
 * 核心逻辑：
 * 1) 读取当前 items/trash
 * 2) 应用 operation（create/update/delete/move/restore/permanent_delete）
 * 3) 重新计算 path-based id，并规范化排序 index
 * 4) 写回到对应的 namespace TISF 文件 + trash 文件
 */
export async function applyWorkspaceOperation(
  projectRoot: string,
  operation: TinyI18nOperation | TinyI18nOperation[],
): Promise<TinyI18nOperationResult> {
  const store = await openWorkspaceData(projectRoot)
  const operations = Array.isArray(operation) ? operation : [operation]
  const itemsById = new Map<string, TinyI18nItem>(
    store.data.items.map((item: TinyI18nItem): [string, TinyI18nItem] => [item.id, item]),
  )

  function resolveItemNamespace(
    item: TinyI18nItem,
    parentId?: string,
  ) {
    if (item.namespace) {
      return item.namespace
    }
    if (parentId) {
      return itemsById.get(parentId)?.namespace
    }
    return store.config.namespaces[0]?.key
  }

  const nextData = operations.reduce<TinyI18nDataFile>((data, currentOperation) => {
    if (currentOperation.type === 'create') {
      const namespace = resolveItemNamespace(
        currentOperation.data,
        currentOperation.data.parent,
      )
      const nextOperation: TinyI18nOperation = {
        ...currentOperation,
        data: {
          ...currentOperation.data,
          namespace,
        },
      }
      itemsById.set(nextOperation.data.id, nextOperation.data)
      return applyOperation(data, nextOperation)
    }

    if (currentOperation.type === 'move') {
      const movingIds = collectDescendantIds(data.items, currentOperation.data.ids)
      const parentNamespace = currentOperation.data.parent
        ? itemsById.get(currentOperation.data.parent)?.namespace
        : undefined
      const moved = applyOperation(data, currentOperation)
      if (!parentNamespace) {
        return moved
      }

      // move 会让子树整体迁移 namespace（由 UI 约束，通常同 namespace 内移动）
      return {
        ...moved,
        items: moved.items.map(item =>
          movingIds.has(item.id)
            ? { ...item, namespace: parentNamespace }
            : item,
        ),
      }
    }

    return applyOperation(data, currentOperation)
  }, store.data)

  const normalizedItems = normalizeItemsToPathBasedIds(nextData.items)
  const normalizedTrash = normalizeItemsToPathBasedIds(nextData.trash ?? [])
  const normalizedIndexedItems = normalizeIndexes(normalizedItems.items)
  const normalizedIndexedTrash = normalizeIndexes(normalizedTrash.items)

  await store.write({
    ...nextData,
    items: normalizedIndexedItems.items,
    trash: normalizedIndexedTrash.items,
  })

  return {
    ok: true,
    operation,
  }
}

