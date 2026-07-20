import type { In18MessageNode, In18WorkerInput } from '@/workers/i18n-messages.worker'
import { createGlobalState } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { useSaveQueue } from '@/composables/commands/useSaveQueue'
import { useLocaleConfig } from '@/composables/core/useLocaleConfig'
import { useI18nMessages } from '@/composables/workspace/useI18nMessages'
import { useWorkspace as useWorkspaceStore } from '@/composables/workspace/useWorkspace'
import { confirm } from '@/utils/confirm'

export type WorkspaceTreeRow
  = | {
    type: 'node'
    key: string
    node: In18MessageNode
    depth: number
    isLast: boolean
  }
  | {
    type: 'empty'
    key: string
    parentId: string
    depth: number
    isLast: boolean
  }

function getDepthFromChain(chain: string) {
  if (!chain.trim()) {
    return 0
  }
  return chain.split(',').filter(Boolean).length
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

interface RawTranslationItem {
  key: string
  translations: Record<string, string>
}

interface RawTranslationGroup {
  key: string
  $label: string
  items: Array<RawTranslationNode>
}

type RawTranslationNode = RawTranslationItem | RawTranslationGroup

interface RawTranslationFile {
  $code?: string
  $label?: string
  items?: Array<RawTranslationNode>
}

function ensureRootItems(root: RawTranslationFile): Array<RawTranslationNode> {
  if (!Array.isArray(root.items)) {
    root.items = []
  }
  return root.items
}

function isRawGroup(node: RawTranslationNode): node is RawTranslationGroup {
  return Boolean((node as any)?.items) && Array.isArray((node as any).items)
}

function isRawItem(node: RawTranslationNode): node is RawTranslationItem {
  return Boolean((node as any)?.translations) && isRecord((node as any).translations)
}

function parseLocator(locator: string) {
  const segments = String(locator ?? '').split('.').filter(Boolean)
  return segments
    .map(seg => Number(seg))
    .filter(n => Number.isFinite(n) && n >= 0)
}

/**
 * locator 定位策略：
 * - worker 输出的节点 id 即 locator（如 `0.3.2`），表示在 `root.items` 的下标链
 * - 允许 key 为空；定位完全不依赖 key
 */
function getNodeByLocator(root: RawTranslationFile, locator: string) {
  const indexes = parseLocator(locator)
  if (!indexes.length) {
    return null
  }

  let parentItems = ensureRootItems(root)
  let cursor: RawTranslationNode | null = null

  for (let depth = 0; depth < indexes.length; depth++) {
    const index = indexes[depth]
    cursor = parentItems[index] as RawTranslationNode
    if (!cursor) {
      return null
    }

    if (depth < indexes.length - 1) {
      if (!isRawGroup(cursor)) {
        return null
      }
      parentItems = cursor.items
    }
  }

  return cursor
}

function resolveNodeRefByLocator(root: RawTranslationFile, locator: string) {
  const indexes = parseLocator(locator)
  if (!indexes.length) {
    return null
  }

  let parentItems = ensureRootItems(root)
  let node: RawTranslationNode | null = null
  let index = -1

  for (let depth = 0; depth < indexes.length; depth++) {
    index = indexes[depth]
    node = parentItems[index] as RawTranslationNode
    if (!node) {
      return null
    }
    if (depth < indexes.length - 1) {
      if (!isRawGroup(node)) {
        return null
      }
      parentItems = node.items
    }
  }

  return { node, parentItems, index }
}

function getParentLocator(locator: string) {
  const segments = String(locator ?? '').split('.').filter(Boolean)
  if (segments.length <= 1) {
    return ''
  }
  return segments.slice(0, -1).join('.')
}

/**
 * 稳定排序：group 在前，message 在后。同类型之间保持原有插入顺序。
 */
function sortNodesByType(items: Array<RawTranslationNode>) {
  items.sort((a, b) => {
    const aWeight = isRawGroup(a) ? 0 : 1
    const bWeight = isRawGroup(b) ? 0 : 1
    return aWeight - bWeight
  })
}

export const useWorkspaceView = createGlobalState(() => {
  const workspace = useWorkspaceStore()
  setTimeout(() => (workspace as any).loadPull())
  const saveQueue = useSaveQueue()
  const { localeConfig } = useLocaleConfig()

  const keywords = ref('')
  const pendingSelectedId = ref('')
  const pendingScrollNodeId = ref('')
  const draftKey = ref('')
  const pendingDraftKeyId = ref('')
  const pendingDraftKeyValue = ref('')

  const workerInput = computed<In18WorkerInput>(() => {
    const config = workspace.config.value
    const nsList = workspace.namespaces.value
    return {
      files: workspace.files.value.map(file => ({
        name: file.dir,
        data: file.data,
      })),
      config: {
        namespaces: nsList.map(ns => ({
          key: ns.key,
          filename: !config || config.mode === 'single' ? '.tinyi18n/data' : `.tinyi18n/data/${ns.key}`,
          description: ns.description,
        })),
        locales: (config?.locales ?? []).map((locale: any) => ({ code: locale.code })),
      },
      activeNamespace: workspace.activeNamespace.value,
      filters: {
        keywords: keywords.value,
        withAncestors: true,
        types: ['group', 'message'],
        searchIn: ['path', 'key', 'title', 'translation'],
      },
    }
  })

  const {
    items,
    isExpanded,
    toggleExpanded,
    toggleExpandedAll,
    selectedKey,
    isSelected,
    toggleSelected,
    findNodeIndex,
    expandedKeys,
  } = useI18nMessages(workerInput)

  const selectedNode = computed(() => items.value.find(n => n.id === selectedKey.value))

  function getGroupTitle(original: TinyI18nItem) {
    if (original.type !== 'group') {
      return String(original.key ?? '').trim()
    }

    return String(original.title ?? '').trim() || String(original.key ?? '').trim()
  }

  const selectedKeyChain = computed(() => {
    const node = selectedNode.value
    if (!node) {
      return [] as string[]
    }
    const nodeById = new Map(items.value.map(n => [n.id, n]))
    const chain: string[] = []
    let cursor: In18MessageNode | undefined = node
    while (cursor) {
      chain.push(String(cursor.original.key ?? ''))
      const parentId: string | undefined = cursor.original.parent
      cursor = parentId ? nodeById.get(parentId) : undefined
    }
    return chain.reverse()
  })

  const translationLocales = computed(() => {
    const defaultLocale = localeConfig.value.defaultLocale
    const locales = localeConfig.value.locales ?? []
    const defaults = locales.filter(item => item.code === defaultLocale)
    const others = locales.filter(item => item.code !== defaultLocale)
    return [...defaults, ...others]
  })

  watch(selectedNode, (node) => {
    if (!node) {
      draftKey.value = ''
      return
    }

    // 支持“新建节点时 key 默认空”的 UX：
    if (pendingDraftKeyId.value && node.id === pendingDraftKeyId.value) {
      draftKey.value = pendingDraftKeyValue.value
      pendingDraftKeyId.value = ''
      pendingDraftKeyValue.value = ''
      return
    }

    draftKey.value = String(node.original.key ?? '')
  }, { immediate: true })

  watch(items, async (list) => {
    if (!pendingSelectedId.value) {
      return
    }

    await nextTick()
    const matched = list.find(item => item.id === pendingSelectedId.value)
    if (!matched) {
      return
    }

    toggleSelected(matched.id)
    pendingScrollNodeId.value = matched.id
    pendingSelectedId.value = ''
  })

  const childCountById = computed(() => {
    const countMap = new Map<string, number>()

    for (const node of items.value) {
      const parentId = node.original.parent
      if (!parentId) {
        continue
      }

      countMap.set(parentId, (countMap.get(parentId) ?? 0) + 1)
    }

    return countMap
  })

  function hasChildren(node: In18MessageNode) {
    return (childCountById.value.get(node.id) ?? 0) > 0
  }

  const decoratedItems = computed<WorkspaceTreeRow[]>(() => {
    const list = items.value
    const rows: Array<{ node: typeof list[number], depth: number, isLast: boolean }> = []
    const seen = new Set<string>()

    for (let i = list.length - 1; i >= 0; i--) {
      const node = list[i]
      const depth = getDepthFromChain(node.chain)
      const key = `${node.chain}::${depth}`
      const isLast = !seen.has(key)
      seen.add(key)
      rows[i] = { node, depth, isLast }
    }

    const result: WorkspaceTreeRow[] = []
    for (const row of rows) {
      result.push({
        type: 'node',
        key: row.node.id,
        ...row,
      })

      if (
        row.node.type === 'group'
        && isExpanded(row.node.id)
        && !hasChildren(row.node)
      ) {
        result.push({
          type: 'empty',
          key: `${row.node.id}::empty`,
          parentId: row.node.id,
          depth: row.depth + 1,
          isLast: true,
        })
      }
    }

    return result
  })

  function getSelectedRawNode() {
    const file = workspace.activeFile.value
    const locator = selectedNode.value?.id ?? ''
    if (!file?.data || !locator || !isRecord(file.data)) {
      return null
    }

    return getNodeByLocator(file.data as unknown as RawTranslationFile, locator)
  }

  function getSelectedRawGroup() {
    const node = getSelectedRawNode()
    return node && isRawGroup(node) ? node : null
  }

  function getSelectedRawMessage() {
    const node = getSelectedRawNode()
    return node && isRawItem(node) ? node : null
  }

  function createEmptyMessageNode() {
    return Object.fromEntries(
      (localeConfig.value.locales ?? []).map(locale => [locale.code, '']),
    )
  }

  function createEmptyGroupNode() {
    return [] as RawTranslationNode[]
  }

  function insertNode(parentLocator: string, type: 'group' | 'message') {
    const fileName = workspace.activeFileName.value
    if (!fileName) {
      return
    }

    let nextId = ''

    workspace.mutateFileData(fileName, (data) => {
      if (!data || !isRecord(data)) {
        return
      }

      const root = data as unknown as RawTranslationFile
      const container = parentLocator
        ? getNodeByLocator(root, parentLocator)
        : root

      const parentItems = parentLocator
        ? (isRawGroup(container as any) ? (container as RawTranslationGroup).items : null)
        : ensureRootItems(root)

      if (!parentItems) {
        return
      }

      const newNode: RawTranslationNode = type === 'group'
        ? {
            key: '',
            $label: '',
            items: createEmptyGroupNode(),
          }
        : {
            key: '',
            translations: createEmptyMessageNode(),
          }

      parentItems.push(newNode)
      sortNodesByType(parentItems)
      const newIndex = parentItems.indexOf(newNode)
      nextId = parentLocator ? `${parentLocator}.${newIndex}` : String(newIndex)
    })

    if (!nextId) {
      return
    }

    pendingSelectedId.value = nextId
    pendingDraftKeyId.value = nextId
    pendingDraftKeyValue.value = ''
    saveQueue.touch(fileName)
  }

  function createMessage(parentNode?: In18MessageNode) {
    if (!parentNode) {
      insertNode('', 'message')
      return
    }

    if (parentNode.type !== 'group') {
      return
    }

    toggleExpanded(parentNode.id, true)
    insertNode(parentNode.id, 'message')
  }

  function createGroup(parentNode?: In18MessageNode) {
    if (!parentNode) {
      insertNode('', 'group')
      return
    }

    if (parentNode.type !== 'group') {
      return
    }

    toggleExpanded(parentNode.id, true)
    insertNode(parentNode.id, 'group')
  }

  /**
   * 在指定 message 后面追加一条 message（同一父级下插入到紧邻位置）。
   * 注意：该行为尊重数组顺序，不会触发自动排序。
   */
  function appendMessageAfter(node: In18MessageNode) {
    if (node.type !== 'message') {
      return
    }

    const fileName = workspace.activeFileName.value
    const locator = node.id
    if (!fileName || !locator) {
      return
    }

    const parentLocator = getParentLocator(locator)
    let nextId = ''

    workspace.mutateFileData(fileName, (data) => {
      if (!data || !isRecord(data)) {
        return
      }

      const root = data as unknown as RawTranslationFile
      const ref = resolveNodeRefByLocator(root, locator)
      if (!ref) {
        return
      }

      const parentItems = ref.parentItems
      const newNode: RawTranslationNode = {
        key: '',
        translations: createEmptyMessageNode(),
      }

      const insertIndex = Math.min(ref.index + 1, parentItems.length)
      parentItems.splice(insertIndex, 0, newNode)
      sortNodesByType(parentItems)
      const newIndex = parentItems.indexOf(newNode)
      nextId = parentLocator ? `${parentLocator}.${newIndex}` : String(newIndex)
    })

    if (!nextId) {
      return
    }

    pendingSelectedId.value = nextId
    pendingDraftKeyId.value = nextId
    pendingDraftKeyValue.value = ''
    saveQueue.touch(fileName)
  }

  async function handleDeleteNode(node: In18MessageNode) {
    const fileName = workspace.activeFileName.value
    const locator = node.id
    if (!fileName || !locator) {
      return
    }

    const ok = await confirm({
      title: '确定删除当前记录吗？',
      description: '删除后会直接从当前文件中移除。',
      confirmText: '删除',
      confirmVariant: 'destructive',
    })

    if (!ok) {
      return
    }

    workspace.mutateFileData(fileName, (data) => {
      if (!data || !isRecord(data)) {
        return
      }
      const root = data as unknown as RawTranslationFile
      const ref = resolveNodeRefByLocator(root, locator)
      if (!ref) {
        return
      }
      ref.parentItems.splice(ref.index, 1)
    })

    pendingSelectedId.value = ''
    saveQueue.touch(fileName)
  }

  /**
   * 在当前分组末尾追加 count 条空白词条。
   * 只对 group 类型节点有效。
   */
  function createChildMessages(node: In18MessageNode, count: number = 1) {
    if (node.type !== 'group')
      return

    const fileName = workspace.activeFileName.value
    const locator = node.id
    if (!fileName || !locator)
      return

    toggleExpanded(node.id, true)

    let nextId = ''

    workspace.mutateFileData(fileName, (data) => {
      if (!data || !isRecord(data))
        return
      const root = data as unknown as RawTranslationFile

      const groupNode = getNodeByLocator(root, locator)
      if (!groupNode || !isRawGroup(groupNode))
        return

      const parentItems = groupNode.items

      const firstNewNode: RawTranslationNode = {
        key: '',
        translations: createEmptyMessageNode(),
      }
      parentItems.push(firstNewNode)
      for (let i = 1; i < count; i++) {
        parentItems.push({
          key: '',
          translations: createEmptyMessageNode(),
        })
      }

      sortNodesByType(parentItems)
      const newIndex = parentItems.indexOf(firstNewNode)
      nextId = `${locator}.${newIndex}`
    })

    if (!nextId)
      return

    pendingSelectedId.value = nextId
    pendingDraftKeyId.value = nextId
    pendingDraftKeyValue.value = ''
    saveQueue.touch(fileName)
  }

  /**
   * 在当前节点之前或之后插入一个同级分组。
   * 只对 group 类型节点有效。
   */
  function insertSiblingGroup(node: In18MessageNode, position: 'before' | 'after') {
    const fileName = workspace.activeFileName.value
    const locator = node.id
    if (!fileName || !locator)
      return

    const parentLocator = getParentLocator(locator)
    let nextId = ''

    workspace.mutateFileData(fileName, (data) => {
      if (!data || !isRecord(data))
        return
      const root = data as unknown as RawTranslationFile
      const ref = resolveNodeRefByLocator(root, locator)
      if (!ref)
        return

      const { parentItems, index } = ref
      const insertIndex = position === 'after' ? index + 1 : index

      const newNode: RawTranslationNode = {
        key: '',
        $label: '',
        items: [],
      }
      parentItems.splice(insertIndex, 0, newNode)
      sortNodesByType(parentItems)
      const newIndex = parentItems.indexOf(newNode)
      nextId = parentLocator ? `${parentLocator}.${newIndex}` : String(newIndex)
    })

    if (!nextId)
      return

    pendingSelectedId.value = nextId
    pendingDraftKeyId.value = nextId
    pendingDraftKeyValue.value = ''
    saveQueue.touch(fileName)
  }

  /**
   * 在当前节点之前或之后插入 count 条同级空白词条。
   * 只对 message 类型节点有效。
   */
  function insertSiblingMessages(node: In18MessageNode, position: 'before' | 'after', count: number = 1) {
    if (node.type !== 'message')
      return

    const fileName = workspace.activeFileName.value
    const locator = node.id
    if (!fileName || !locator)
      return

    const parentLocator = getParentLocator(locator)
    let nextId = ''

    workspace.mutateFileData(fileName, (data) => {
      if (!data || !isRecord(data))
        return
      const root = data as unknown as RawTranslationFile
      const ref = resolveNodeRefByLocator(root, locator)
      if (!ref)
        return

      const { parentItems, index } = ref
      const insertIndex = position === 'after' ? index + 1 : index

      const firstNewNode: RawTranslationNode = {
        key: '',
        translations: createEmptyMessageNode(),
      }
      parentItems.splice(insertIndex, 0, firstNewNode)
      for (let i = 1; i < count; i++) {
        const newNode: RawTranslationNode = {
          key: '',
          translations: createEmptyMessageNode(),
        }
        parentItems.splice(insertIndex + i, 0, newNode)
      }

      sortNodesByType(parentItems)
      const newIndex = parentItems.indexOf(firstNewNode)
      nextId = parentLocator ? `${parentLocator}.${newIndex}` : String(newIndex)
    })

    if (!nextId)
      return

    pendingSelectedId.value = nextId
    pendingDraftKeyId.value = nextId
    pendingDraftKeyValue.value = ''
    saveQueue.touch(fileName)
  }

  function updateMessageTranslation(locale: string, value: string) {
    const fileName = workspace.activeFileName.value
    const locator = selectedNode.value?.id ?? ''
    if (!fileName || !locator) {
      return
    }

    workspace.mutateFileData(fileName, (data) => {
      if (!data || !isRecord(data)) {
        return
      }
      const root = data as unknown as RawTranslationFile
      const node = getNodeByLocator(root, locator)
      if (!node || !isRawItem(node)) {
        return
      }
      node.translations[locale] = value
    })
    saveQueue.touch(fileName)
  }

  function updateGroupTitle(title: string) {
    const fileName = workspace.activeFileName.value
    const locator = selectedNode.value?.id ?? ''
    if (!fileName || !locator) {
      return
    }

    workspace.mutateFileData(fileName, (data) => {
      if (!data || !isRecord(data)) {
        return
      }
      const root = data as unknown as RawTranslationFile
      const node = getNodeByLocator(root, locator)
      if (!node || !isRawGroup(node)) {
        return
      }
      node.$label = String(title ?? '').trim()
    })
    saveQueue.touch(fileName)
  }

  function commitSelectedKey() {
    const fileName = workspace.activeFileName.value
    const locator = selectedNode.value?.id ?? ''
    // 允许写入空字符串
    const nextKey = String(draftKey.value ?? '')
    const currentKey = String(selectedNode.value?.original?.key ?? '')
    if (!fileName || !locator) {
      return
    }

    if (currentKey === nextKey) {
      return
    }

    workspace.mutateFileData(fileName, (data) => {
      if (!data || !isRecord(data)) {
        return
      }
      const root = data as unknown as RawTranslationFile
      const ref = resolveNodeRefByLocator(root, locator)
      if (!ref?.node) {
        return
      }
      ref.node.key = nextKey
    })
    saveQueue.touch(fileName)
  }

  function consumePendingScrollNodeId() {
    pendingScrollNodeId.value = ''
  }

  function setKeywords(value: string) {
    keywords.value = value
  }

  function setDraftKey(value: string) {
    draftKey.value = value
  }

  return {
    keywords,
    items,
    decoratedItems,
    translationLocales,
    selectedNode,
    selectedKeyChain,
    draftKey,
    pendingScrollNodeId,
    isExpanded,
    expandedKeys,
    toggleExpanded,
    toggleExpandedAll,
    isSelected,
    toggleSelected,
    findNodeIndex,
    getGroupTitle,
    getSelectedRawNode,
    getSelectedRawGroup,
    getSelectedRawMessage,
    createMessage,
    createGroup,
    handleDeleteNode,
    createChildMessages,
    insertSiblingGroup,
    insertSiblingMessages,
    updateMessageTranslation,
    updateGroupTitle,
    commitSelectedKey,
    appendMessageAfter,
    consumePendingScrollNodeId,
    setKeywords,
    setDraftKey,
  }
})

export type WorkspaceViewModel = ReturnType<typeof useWorkspaceView>
