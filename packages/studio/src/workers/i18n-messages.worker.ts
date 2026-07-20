export type Recordable = Record<string, any>

export type In18NodeType = 'message' | 'group'

export interface In18Filters {
  /** 关键字（空/undefined = 不过滤） */
  keywords?: string
  /**
   * 关键字匹配范围（默认全开）
   * - path: a.b.c
   * - key: 当前节点 key
   * - title: group 的 $label
   * - translation: message 的任意 locale 值
   */
  searchIn?: Array<'path' | 'key' | 'title' | 'translation'>
  /**
   * 路径包含/排除（按 path 前缀匹配）
   * - include: 只保留命中这些前缀的节点/子树
   * - exclude: 排除命中这些前缀的节点/子树（优先级高于 include）
   */
  include?: string[]
  exclude?: string[]
  /**
   * 缺失翻译过滤（只对 message 生效）
   * 规则：locale key 不存在 或 value.trim()==='' 视为缺失
   */
  missing?: {
    /** true=任意语言缺失；string[]=这些语言里任意一个缺失就命中 */
    locales?: true | string[]
  }
  /**
   * 输出节点类型（默认 ['group','message']）
   */
  types?: In18NodeType[]
  /**
   * 是否补齐祖先 group（默认 true）
   */
  withAncestors?: boolean
  /**
   * 可选：限制输出数量（以 message 数量为口径）
   */
  maxResults?: number
}

export interface In18WorkerInput {
  /**
   * 来自 /pull 的全量文件列表
   */
  files: Array<{ name: string, data: Recordable }>
  /**
   * 来自 /bootstrap 的 resolved config
   */
  config: {
    namespaces: Array<{ key: string, filename: string, description?: string }>
    locales: Array<{ code: string }>
  }
  /**
   * 当前 namespace key（决定解析哪个文件）
   */
  activeNamespace: string
  filters: In18Filters
}

export interface In18MessageNode<T extends TinyI18nItem = TinyI18nItem> {
  id: string // nanoid(12)，仅用于前端交互
  type: T['type']
  original: T
  /**
   * 父节点 id 列表，用逗号分隔（从根到父）
   */
  chain: string
}

export interface In18WorkerOutput {
  items: In18MessageNode[]
  /**
   * 用于 toggleExpandedAll / isExpandedAll：所有 group id 列表
   */
  expandableIds: string[]
  /**
   * 用于 toggleAllChecked / isAllChecked：所有 message id 列表（过滤后的集合）
   */
  messageIds: string[]
  /**
   * groupId -> descendant message ids（过滤后的集合）
   */
  descendantMessageIdsByGroupId: Record<string, string[]>
}

function isRecord(value: unknown): value is Recordable {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

interface RawTranslationItem {
  key: string
  translations: Recordable
}

interface RawTranslationGroup {
  key: string
  $label?: unknown
  items: unknown[]
}

function isTranslationItem(value: unknown): value is RawTranslationItem {
  return isRecord(value)
    && typeof value.key === 'string'
    && isRecord((value as any).translations)
}

function isTranslationGroup(value: unknown): value is RawTranslationGroup {
  return isRecord(value)
    && typeof value.key === 'string'
    && Array.isArray((value as any).items)
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeTranslations(translationsNode: Recordable, locales: string[]) {
  const translations: Record<string, string> = {}
  const missing: string[] = []
  for (const locale of locales) {
    const raw = translationsNode[locale]
    const val = String(raw ?? '')
    translations[locale] = val
    if (!val.trim()) {
      missing.push(locale)
    }
  }
  return { translations, missingLocales: missing }
}

function matchesKeywords(text: string, keywords?: string) {
  const kw = keywords?.trim()
  if (!kw) {
    return true
  }
  return text.toLowerCase().includes(kw.toLowerCase())
}

function matchPathPrefix(path: string, prefixes: string[] | undefined) {
  if (!prefixes?.length) {
    return true
  }
  return prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}.`))
}

/**
 * id 稳定性策略（支持 key 为空）：
 * - 不再用 key/path 作为稳定键（key 允许为空会导致 path 不稳定/冲突）
 * - 改为使用 “index locator”（从 root.items 开始的下标链，如：`0.3.2`）
 * - 同一个文件内容、同一个数组结构下，locator 是稳定的
 *
 * 注意：如果用户在同级插入/删除导致下标变化，locator 也会随之变化（这是预期行为）。
 */
function buildLocator(parentLocator: string, index: number) {
  return parentLocator ? `${parentLocator}.${index}` : String(index)
}

function buildItems(input: In18WorkerInput): In18WorkerOutput {
  const locales = input.config.locales.map(item => item.code)
  const nsConfig = input.config.namespaces.find(n => n.key === input.activeNamespace)
  const filename = nsConfig?.filename
  const file = input.files.find(f => f.name === filename || (filename && f.name.endsWith(`/${filename}`)))
  const raw = file?.data
  if (!raw || !isRecord(raw)) {
    return {
      items: [],
      expandableIds: [],
      messageIds: [],
      descendantMessageIdsByGroupId: {},
    }
  }

  const include = input.filters.include?.map(s => normalizeString(s)).filter(Boolean)
  const exclude = input.filters.exclude?.map(s => normalizeString(s)).filter(Boolean)
  const keywords = input.filters.keywords?.trim() || ''
  const searchIn = input.filters.searchIn?.length
    ? input.filters.searchIn
    : ['path', 'key', 'title', 'translation'] as const
  const types = input.filters.types?.length
    ? new Set<In18NodeType>(input.filters.types)
    : new Set<In18NodeType>(['group', 'message'])
  const withAncestors = input.filters.withAncestors !== false
  const maxResults = Number.isFinite(input.filters.maxResults as number)
    ? Math.max(0, Number(input.filters.maxResults))
    : undefined
  const missingLocales = input.filters.missing?.locales
  // 约定：string[] 语义为“任意一个缺失就命中”
  const missingLocaleList = Array.isArray(missingLocales)
    ? missingLocales.map(s => normalizeString(s)).filter(Boolean)
    : null

  const items: In18MessageNode[] = []
  const expandableIds: string[] = []
  const messageIds: string[] = []
  const descendantMessageIdsByGroupId: Record<string, string[]> = {}
  const selfMatchedGroupIds = new Set<string>()

  // groupIdStack 存储的是 group 的 locator（用于 chain、parent、expandableIds 等）
  const groupIdStack: string[] = []
  const pathStack: string[] = []

  function pushItem(node: In18MessageNode) {
    items.push(node)
  }

  function recordDescendants(messageId: string, ancestorGroupIds: string[]) {
    for (const groupId of ancestorGroupIds) {
      const bucket = descendantMessageIdsByGroupId[groupId] ?? []
      bucket.push(messageId)
      descendantMessageIdsByGroupId[groupId] = bucket
    }
  }

  function shouldIncludeByPath(path: string) {
    if (exclude?.length && matchPathPrefix(path, exclude)) {
      return false
    }
    if (include?.length && !matchPathPrefix(path, include)) {
      return false
    }
    return true
  }

  function shouldIncludeByKeywords(
    nodeType: In18NodeType,
    key: string,
    path: string,
    node: Recordable,
  ) {
    if (!keywords) {
      return true
    }

    const haystacks: string[] = []
    if (searchIn.includes('path')) {
      haystacks.push(path)
    }
    if (searchIn.includes('key')) {
      haystacks.push(key)
    }
    if (searchIn.includes('title') && nodeType === 'group') {
      haystacks.push(normalizeString(node.$label))
    }
    if (searchIn.includes('translation') && nodeType === 'message') {
      const translations = isRecord(node.translations) ? node.translations : {}
      for (const locale of locales) {
        haystacks.push(String(translations[locale] ?? ''))
      }
    }

    return haystacks.some(text => matchesKeywords(text, keywords))
  }

  function shouldIncludeByMissing(node: Recordable) {
    if (!missingLocales) {
      return true
    }
    if (!isTranslationItem(node)) {
      return true
    }
    const { translations } = normalizeTranslations(node.translations, locales)
    const missingList = locales.filter(locale => !String(translations[locale] ?? '').trim())
    if (missingLocales === true) {
      return missingList.length > 0
    }
    if (missingLocaleList?.length) {
      return missingLocaleList.some(code => missingList.includes(code))
    }
    return true
  }

  function walkList(list: unknown[], parentLocator = '') {
    for (let i = 0; i < list.length; i++) {
      if (maxResults != null && messageIds.length >= maxResults) {
        return
      }

      const node = list[i]
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        continue
      }

      const locator = buildLocator(parentLocator, i)

      // message
      if (isTranslationItem(node)) {
        const key = normalizeString(node.key)
        const pathSeg = key || `@${i}`
        const nextPath = [...pathStack, pathSeg].join('.')

        if (!types.has('message')) {
          continue
        }
        if (!shouldIncludeByPath(nextPath)) {
          continue
        }
        if (!shouldIncludeByKeywords('message', key, nextPath, node as any)) {
          continue
        }
        if (!shouldIncludeByMissing(node as any)) {
          continue
        }

        const id = locator
        const chain = groupIdStack.join(',')
        const { translations } = normalizeTranslations(node.translations, locales)

        pushItem({
          id,
          type: 'message',
          chain,
          original: {
            id,
            parent: groupIdStack.at(-1),
            type: 'message',
            key,
            translations,
          },
        })
        messageIds.push(id)
        recordDescendants(id, [...groupIdStack])
        continue
      }

      // group
      if (isTranslationGroup(node)) {
        const key = normalizeString(node.key)
        const pathSeg = key || `@${i}`
        const nextPath = [...pathStack, pathSeg].join('.')
        const id = locator
        const chain = groupIdStack.join(',')

        const groupSelfMatch = (
          types.has('group')
          && shouldIncludeByPath(nextPath)
          && shouldIncludeByKeywords('group', key, nextPath, node as any)
        )

        if (types.has('group')) {
          pushItem({
            id,
            type: 'group',
            chain,
            original: {
              id,
              parent: groupIdStack.at(-1),
              type: 'group',
              key,
              title: normalizeString((node as any).$label),
            },
          })
          if (groupSelfMatch) {
            selfMatchedGroupIds.add(id)
          }
          expandableIds.push(id)
        }

        pathStack.push(pathSeg)
        groupIdStack.push(id)
        walkList(node.items, locator)
        groupIdStack.pop()
        pathStack.pop()
      }
    }
  }

  // 从根开始（新格式：root.items）
  const rootItems = Array.isArray((raw as any).items) ? (raw as any).items as unknown[] : []
  walkList(rootItems)

  // 清理：
  // - withAncestors=true：保留“有 descendant message”的 group；
  // - withAncestors=false：只保留 selfMatch 的 group；
  const keepGroup = new Set<string>()
  if (withAncestors) {
    for (const id of Object.keys(descendantMessageIdsByGroupId)) {
      keepGroup.add(id)
    }
  }
  const nextItems = items.filter((item) => {
    if (item.type === 'message') {
      return true
    }
    const selfMatch = selfMatchedGroupIds.has(item.id)
    return withAncestors ? keepGroup.has(item.id) || selfMatch : selfMatch
  })

  const nextExpandable = expandableIds.filter((id) => {
    if (!types.has('group')) {
      return false
    }
    return withAncestors
      ? keepGroup.has(id) || selfMatchedGroupIds.has(id)
      : selfMatchedGroupIds.has(id)
  })

  return {
    items: nextItems,
    expandableIds: nextExpandable,
    messageIds,
    descendantMessageIdsByGroupId,
  }
}

globalThis.onmessage = (event: MessageEvent<In18WorkerInput>) => {
  const payload = event.data
  const output = buildItems(payload)
  globalThis.postMessage(output)
}
