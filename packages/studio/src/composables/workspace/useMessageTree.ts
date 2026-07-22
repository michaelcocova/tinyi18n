import type { ShallowRef } from 'vue'
import { createGlobalState } from '@vueuse/core'
import { computed, shallowRef, toValue, watch } from 'vue'
import { useAssembleMessages } from '@/composables/workspace/useAssemblyMessages'

export interface UseMessageTreeOptions {
  defaultExpandedKeys?: string[]
  defaultExpandedAll?: boolean
  defaultExpandedDepth?: number
  defaultSelectedKey?: string
}

export interface MessageTreeNode {
  id: string
  depth: number
  original: I18nMessage
}

interface InternalNode {
  id: string
  depth: number
  original: I18nMessage
  parent?: InternalNode
  children: InternalNode[]
}

export interface UseMessageTreeReturn {
  items: ShallowRef<MessageTreeNode[]>
  expandedKeys: ShallowRef<string[]>
  isExpanded: (id: string) => boolean
  isExpandedAll: () => boolean
  toggleExpanded: (id: string) => void
  toggleSelected: (id: string, selected?: boolean) => void
  isSelected: (id: string) => boolean
  selectedKey: ShallowRef<string | undefined>
  findNode: (id: string) => MessageTreeNode | undefined
  findNodeIndex: (id: string) => number
  activeNamespace: ShallowRef<string>
  searchKeyword: ShallowRef<string>
  rootNamespaces: import('vue').ComputedRef<{ key: string, path: string }[]>
}

export const useMessageTree = createGlobalState(() => {
  const options: UseMessageTreeOptions = {
    defaultExpandedDepth: 0,
  }
  const { messages } = useAssembleMessages()

  const activeNamespace = shallowRef('__all__')
  const searchKeyword = shallowRef('')

  const rootNamespaces = computed(() => {
    return messages.value
      .filter((m: any) => m.type === 1 && !(m as any).parent)
      .map((m: any) => ({ key: m.key, path: m.path }))
  })

  const filteredMessages = computed(() => {
    if (activeNamespace.value === '__all__')
      return messages.value
    const ns = activeNamespace.value
    return messages.value.filter((m: any) => {
      const p = (m as any).path || ''
      return p === ns || p.startsWith(`${ns}.`)
    })
  })

  const searchedMessages = computed(() => {
    const kw = searchKeyword.value.trim().toLowerCase()
    if (!kw)
      return filteredMessages.value
    const list = filteredMessages.value
    const matchIds = new Set<string>()
    for (const msg of list) {
      const p = ((msg as any).path || '').toLowerCase()
      const k = ((msg as any).key || '').toLowerCase()
      const t = Object.values((msg as any).translations || {}).join(' ').toLowerCase()
      if (p.includes(kw) || k.includes(kw) || t.includes(kw)) {
        let cur: any = msg
        while (cur) {
          matchIds.add(cur.id)
          cur = list.find((m: any) => m.id === (cur as any).parent)
        }
      }
    }
    return list.filter((m: any) => matchIds.has(m.id))
  })

  const nodeMap = computed(() => {
    const map = new Map<string, InternalNode>()
    const list = toValue(searchedMessages)
    for (const item of list) {
      map.set(item.id, { id: item.id, depth: 0, original: item, children: [] })
    }
    for (const item of list) {
      const id = item.id
      const pid = (item as any).parent as string | undefined
      if (!pid)
        continue
      const node = map.get(id)
      const parent = map.get(pid)
      if (!node || !parent)
        continue
      node.parent = parent
      parent.children.push(node)
    }
    const walk = (n: InternalNode, depth: number) => {
      n.depth = depth
      for (const c of n.children) walk(c, depth + 1)
    }
    for (const n of map.values()) {
      if (!n.parent)
        walk(n, 0)
    }
    return map
  })

  const roots = computed(() => [...nodeMap.value.values()].filter(n => !n.parent))

  const expandedKeys = shallowRef<string[]>([])
  const selectedKey = shallowRef<string | undefined>(options.defaultSelectedKey)
  const items = shallowRef<MessageTreeNode[]>([])

  let _initialized = false

  watch(roots, () => {
    if (_initialized)
      return
    if (roots.value.length === 0)
      return
    _initialized = true
    if (options.defaultExpandedAll) {
      expandedKeys.value = [...nodeMap.value.keys()]
    }
    else if (options.defaultExpandedDepth !== undefined) {
      expandedKeys.value = [...nodeMap.value.values()]
        .filter(n => n.depth < options.defaultExpandedDepth!)
        .map(n => n.id)
    }
    else if (options.defaultExpandedKeys) {
      expandedKeys.value = [...options.defaultExpandedKeys]
    }
  }, { immediate: true })

  // 展开/折叠 计算 items
  watch([expandedKeys, nodeMap], () => {
    const result: MessageTreeNode[] = []
    const walk = (n: InternalNode) => {
      result.push({ id: n.id, depth: n.depth, original: n.original })
      if (!expandedKeys.value.includes(n.id))
        return
      for (const c of n.children) walk(c)
    }
    for (const r of roots.value) walk(r)
    items.value = result
  }, { immediate: true })

  // 切换 namespace 时自动展开
  watch(activeNamespace, () => {
    if (activeNamespace.value === '__all__') {
      expandedKeys.value = [...nodeMap.value.values()]
        .filter(n => n.depth < 1)
        .map(n => n.id)
    }
    else {
      const ns = activeNamespace.value
      expandedKeys.value = [...nodeMap.value.values()]
        .filter((n: any) => {
          if (n.original.type !== 1)
            return false
          const p = (n.original as any).path || ''
          return p === ns || p.startsWith(`${ns}.`)
        })
        .map(n => n.id)
    }
  })

  // 搜索时自动展开匹配节点的父链
  watch(searchKeyword, (kw) => {
    if (!kw.trim())
      return
    const q = kw.toLowerCase()
    const list = filteredMessages.value
    const toExpand = new Set<string>()
    for (const msg of list) {
      const p = ((msg as any).path || '').toLowerCase()
      const k = ((msg as any).key || '').toLowerCase()
      const t = Object.values((msg as any).translations || {}).join(' ').toLowerCase()
      if (p.includes(q) || k.includes(q) || t.includes(q)) {
        let cur: any = msg
        while (cur) {
          const pid = (cur as any).parent as string | undefined
          if (!pid)
            break
          toExpand.add(pid)
          cur = list.find((m: any) => m.id === pid)
        }
      }
    }
    if (toExpand.size > 0) {
      expandedKeys.value = [...new Set([...expandedKeys.value, ...toExpand])]
    }
  })

  function isExpanded(id: string) {
    return expandedKeys.value.includes(id)
  }
  function isExpandedAll() {
    return expandedKeys.value.length === nodeMap.value.size
  }
  function toggleExpanded(id: string) {
    const s = new Set(expandedKeys.value)
    s.has(id) ? s.delete(id) : s.add(id)
    expandedKeys.value = [...s]
  }
  function isSelected(id: string) {
    return selectedKey.value === id
  }
  function toggleSelected(id: string, selected?: boolean) {
    const cur = isSelected(id)
    if (selected === undefined) {
      selectedKey.value = cur ? undefined : id
      return
    }
    selectedKey.value = selected ? id : undefined
  }
  function findNode(id: string): MessageTreeNode | undefined {
    const n = nodeMap.value.get(id)
    if (!n)
      return
    return { id: n.id, depth: n.depth, original: n.original }
  }
  function findNodeIndex(id: string) {
    return items.value.findIndex(i => i.id === id)
  }

  return {
    items,
    expandedKeys,
    isExpanded,
    isExpandedAll,
    toggleExpanded,
    toggleSelected,
    isSelected,
    selectedKey,
    findNode,
    findNodeIndex,
    activeNamespace,
    searchKeyword,
    rootNamespaces,
  }
})
