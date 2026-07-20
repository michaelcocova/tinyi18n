import type { Ref } from 'vue'
import type {
  In18MessageNode,
  In18WorkerInput,
  In18WorkerOutput,
} from '../../workers/i18n-messages.worker'
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'

export type Recordable = Record<string, any>

export interface useIn18MessageReturn {
  /** 显示的消息节点列表 */
  items: Ref<In18MessageNode[]>
  /** 展开的节点 id 列表 */
  expandedKeys: Ref<string[]>
  /** 是否展开 */
  isExpanded: (id: string) => boolean
  /** 是否全部展开 */
  isExpandedAll: () => boolean
  /** 切换展开状态 */
  toggleExpanded: (id: string, expanded?: boolean) => void
  /** 切换所有展开状态 */
  toggleExpandedAll: (expanded?: boolean) => void

  /** 选中的节点 id */
  selectedKey: Ref<string>
  /** 是否选中 */
  isSelected: (id: string) => boolean
  /** 切换选中 */
  toggleSelected: (id: string) => void
  /** 查找节点在当前 items 中的索引 */
  findNodeIndex: (id: string) => number

  /** 选中的节点 id 列表（checked） */
  selectedKeys: Ref<string[]>
  /** 半选中的节点 id 列表 */
  indeterminateKeys: Ref<string[]>
  /** 是否选中 */
  isChecked: (id: string) => boolean
  /** 是否半选 */
  isIndeterminate: (id: string) => boolean
  /** 切换选中状态 */
  toggleChecked: (id: string, checked?: boolean) => void
  /** 是否全部选中 */
  isAllChecked: () => boolean
  /** 切换所有选中状态 */
  toggleAllChecked: (checked?: boolean) => void
}

function toPlainClone<T>(value: T): T {
  // worker 输入只包含纯 JSON 数据，直接做一次 JSON clone，
  // 避免把 Vue 的 Proxy / Ref 内部对象传给 postMessage 导致 DataCloneError。
  return JSON.parse(JSON.stringify(value)) as T
}

function splitChain(chain: string) {
  const trimmed = chain.trim()
  if (!trimmed) {
    return []
  }
  return trimmed.split(',').map(s => s.trim()).filter(Boolean)
}

export function useI18nMessages(data: Ref<In18WorkerInput>): useIn18MessageReturn {
  const rawWorker = new Worker(new URL('../../workers/i18n-messages.worker.ts', import.meta.url), { type: 'module' })
  const workerData = ref<In18WorkerOutput>()
  rawWorker.onmessage = (event: MessageEvent<In18WorkerOutput>) => {
    workerData.value = event.data
  }
  const post = (input: In18WorkerInput) => rawWorker.postMessage(input)
  onUnmounted(() => rawWorker.terminate())

  // viewState（主线程）
  const expandedSet = shallowRef(new Set<string>())
  const selectedKey = ref('')
  const checkedMessageSet = shallowRef(new Set<string>())

  const expandableIds = computed(() => workerData.value?.expandableIds ?? [])
  const messageIds = computed(() => workerData.value?.messageIds ?? [])
  const descendantMessageIdsByGroupId = computed(() =>
    workerData.value?.descendantMessageIdsByGroupId ?? {},
  )

  const fullItems = computed(() => workerData.value?.items ?? [])

  const chainIdsByNodeId = computed(() => {
    const map = new Map<string, string[]>()
    for (const item of fullItems.value) {
      map.set(item.id, splitChain(item.chain))
    }
    return map
  })

  const items = computed(() => {
    const expanded = expandedSet.value
    const chainMap = chainIdsByNodeId.value

    return fullItems.value.filter((item) => {
      const chainIds = chainMap.get(item.id) ?? []
      // ancestors 全展开才可见
      return chainIds.every(id => expanded.has(id))
    })
  })

  // expanded
  const expandedKeys = computed<string[]>(() => [...expandedSet.value])

  function isExpanded(id: string) {
    return expandedSet.value.has(id)
  }

  function isExpandedAll() {
    const all = expandableIds.value
    if (!all.length) {
      return false
    }
    const expanded = expandedSet.value
    return all.every(id => expanded.has(id))
  }

  function toggleExpanded(id: string, expanded?: boolean) {
    const next = new Set(expandedSet.value)
    const shouldExpand = expanded ?? !next.has(id)
    if (shouldExpand) {
      next.add(id)
    }
    else {
      next.delete(id)
    }
    expandedSet.value = next
  }

  function toggleExpandedAll(expanded?: boolean) {
    const all = expandableIds.value
    if (!all.length) {
      return
    }
    const shouldExpand = expanded ?? !isExpandedAll()
    expandedSet.value = shouldExpand ? new Set(all) : new Set()
  }

  // selected
  function isSelected(id: string) {
    return selectedKey.value === id
  }

  function toggleSelected(id: string) {
    // 不做“再次点击取消”，保持一致性
    selectedKey.value = id
  }

  function findNodeIndex(id: string) {
    return items.value.findIndex(item => item.id === id)
  }

  // checked / indeterminate
  function resolveDescendantMessages(id: string) {
    return descendantMessageIdsByGroupId.value[id] ?? []
  }

  function isChecked(id: string) {
    // message
    if (checkedMessageSet.value.has(id)) {
      return true
    }

    // group：所有后代 message 都选中才算选中
    const descendants = resolveDescendantMessages(id)
    if (!descendants.length) {
      return false
    }
    return descendants.every(mid => checkedMessageSet.value.has(mid))
  }

  function isIndeterminate(id: string) {
    const descendants = resolveDescendantMessages(id)
    if (!descendants.length) {
      return false
    }
    let checkedCount = 0
    for (const mid of descendants) {
      if (checkedMessageSet.value.has(mid)) {
        checkedCount += 1
      }
    }
    return checkedCount > 0 && checkedCount < descendants.length
  }

  const selectedKeys = computed<string[]>(() => {
    // 对外暴露：把 message 的 checked + fully checked group 一起输出，方便 UI 用
    const result: string[] = []
    for (const id of checkedMessageSet.value) {
      result.push(id)
    }
    for (const gid of expandableIds.value) {
      if (isChecked(gid)) {
        result.push(gid)
      }
    }
    return result
  })

  const indeterminateKeys = computed<string[]>(() =>
    expandableIds.value.filter(id => isIndeterminate(id)),
  )

  function toggleChecked(id: string, checked?: boolean) {
    const descendants = resolveDescendantMessages(id)

    // group：批量设置后代 messages
    if (descendants.length) {
      const next = new Set(checkedMessageSet.value)
      const shouldCheck = checked ?? !isChecked(id)
      for (const mid of descendants) {
        if (shouldCheck) {
          next.add(mid)
        }
        else {
          next.delete(mid)
        }
      }
      checkedMessageSet.value = next
      return
    }

    // message：单点
    const next = new Set(checkedMessageSet.value)
    const shouldCheck = checked ?? !next.has(id)
    if (shouldCheck) {
      next.add(id)
    }
    else {
      next.delete(id)
    }
    checkedMessageSet.value = next
  }

  function isAllChecked() {
    const ids = messageIds.value
    if (!ids.length) {
      return false
    }
    const checked = checkedMessageSet.value
    return ids.every(id => checked.has(id))
  }

  function toggleAllChecked(checked?: boolean) {
    const ids = messageIds.value
    if (!ids.length) {
      return
    }
    const shouldCheck = checked ?? !isAllChecked()
    checkedMessageSet.value = shouldCheck ? new Set(ids) : new Set()
  }

  // 驱动 worker
  watch(
    data,
    (next) => {
      post(toPlainClone(next))
    },
    { immediate: true, deep: true },
  )

  // 当过滤结果变化时，清理无效状态（避免引用不存在的 id）
  watch(fullItems, (nextItems) => {
    const validIds = new Set(nextItems.map(item => item.id))

    // selected
    if (selectedKey.value && !validIds.has(selectedKey.value)) {
      selectedKey.value = ''
    }

    // expanded
    const nextExpanded = new Set<string>()
    for (const id of expandedSet.value) {
      if (validIds.has(id)) {
        nextExpanded.add(id)
      }
    }
    expandedSet.value = nextExpanded

    // checked messages
    const nextChecked = new Set<string>()
    for (const id of checkedMessageSet.value) {
      if (validIds.has(id)) {
        nextChecked.add(id)
      }
    }
    checkedMessageSet.value = nextChecked
  })

  return {
    items,
    expandedKeys,
    isExpanded,
    isExpandedAll,
    toggleExpanded,
    toggleExpandedAll,

    selectedKey,
    isSelected,
    toggleSelected,
    findNodeIndex,

    selectedKeys,
    indeterminateKeys,
    isChecked,
    isIndeterminate,
    toggleChecked,
    isAllChecked,
    toggleAllChecked,
  }
}
