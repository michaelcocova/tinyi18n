import type { TinyI18nResolvedConfig } from '../config.ts'
import type {
  TinyI18nItem,
  TinyI18nMessage,
  TinyI18nSnapshot,
  TinyI18nTranslationsQuery,
  TinyI18nTranslationsResponse,
} from '../message.ts'

/**
 * workspace 查询/筛选相关的纯函数集合。
 *
 * 特点：
 * - 不做 IO，不依赖 store/context
 * - 输入是 items + query，输出是过滤后的 items
 * - 过滤时会自动把匹配项的祖先链补齐，保证前端能完整展示树
 */
export function buildNamespaceBuckets(
  namespaces: TinyI18nResolvedConfig['namespaces'],
  items: TinyI18nItem[],
) {
  const buckets: TinyI18nSnapshot['namespaceItems'] = {}

  for (const namespace of namespaces) {
    const bucketItems = items.filter(item => item.namespace === namespace.key)
    const groups = bucketItems.filter(
      (item): item is Extract<TinyI18nItem, { type: 'group' }> => item.type === 'group',
    )
    const messages = bucketItems.filter(
      (item): item is TinyI18nMessage => item.type === 'message',
    )

    buckets[namespace.key] = {
      key: namespace.key,
      description: namespace.description,
      filename: namespace.filename,
      items: bucketItems,
      groups,
      messages,
    }
  }

  return buckets
}

export function buildNamespaceMessages(
  namespaceItems: TinyI18nSnapshot['namespaceItems'],
) {
  return Object.fromEntries(
    Object.entries(namespaceItems).map(([key, value]) => [key, value.messages]),
  ) as TinyI18nSnapshot['namespaceMessages']
}

export function normalizeTranslationsQuery(
  query?: Partial<TinyI18nTranslationsQuery> | null,
): TinyI18nTranslationsQuery {
  return {
    namespace: typeof query?.namespace === 'string' && query.namespace.trim()
      ? query.namespace.trim()
      : undefined,
    keywords: typeof query?.keywords === 'string' && query.keywords.trim()
      ? query.keywords.trim()
      : undefined,
    missing: {
      translation: query?.missing?.translation === true
        || (typeof query?.missing?.translation === 'string' && query.missing.translation.trim())
        ? query.missing.translation
        : undefined,
      key: query?.missing?.key === true,
    },
    include: Array.isArray(query?.include)
      ? query.include.map(item => String(item).trim()).filter(Boolean)
      : [],
    exclude: Array.isArray(query?.exclude)
      ? query.exclude.map(item => String(item).trim()).filter(Boolean)
      : [],
  }
}

export function createTranslationsResponse(
  snapshot: TinyI18nSnapshot,
  query: TinyI18nTranslationsQuery,
  items: TinyI18nItem[],
): TinyI18nTranslationsResponse {
  return {
    root: snapshot.root,
    initialized: snapshot.initialized,
    config: snapshot.config,
    languages: snapshot.languages,
    namespaces: snapshot.namespaces ?? [],
    query,
    items,
    error: snapshot.error,
  }
}

function buildItemPathContext(items: TinyI18nItem[]) {
  const byId = new Map(items.map(item => [item.id, item]))
  const pathCache = new Map<string, string>()
  const ancestorIdsCache = new Map<string, string[]>()

  function resolvePath(item: TinyI18nItem): string {
    const cached = pathCache.get(item.id)
    if (cached) {
      return cached
    }

    const parent = item.parent ? byId.get(item.parent) : undefined
    const parentPath = parent ? resolvePath(parent) : ''
    const nextPath = [parentPath, item.key].filter(Boolean).join('.')
    pathCache.set(item.id, nextPath)
    return nextPath
  }

  function resolveAncestorIds(item: TinyI18nItem): string[] {
    const cached = ancestorIdsCache.get(item.id)
    if (cached) {
      return cached
    }

    const parent = item.parent ? byId.get(item.parent) : undefined
    const nextIds = parent
      ? [...resolveAncestorIds(parent), parent.id]
      : []
    ancestorIdsCache.set(item.id, nextIds)
    return nextIds
  }

  return {
    getPath(id: string) {
      const item = byId.get(id)
      return item ? resolvePath(item) : ''
    },
    getAncestorIds(id: string) {
      const item = byId.get(id)
      return item ? resolveAncestorIds(item) : []
    },
  }
}

function matchesPathRule(path: string, rules: string[]) {
  if (!rules.length) {
    return true
  }

  return rules.some((rule) => {
    const normalizedRule = rule.trim()
    if (!normalizedRule) {
      return false
    }

    return path === normalizedRule || path.startsWith(`${normalizedRule}.`)
  })
}

function hasMissingTranslation(
  item: TinyI18nItem,
  query: TinyI18nTranslationsQuery,
  languages: string[],
) {
  const target = query.missing.translation
  if (item.type !== 'message' || target == null) {
    return true
  }

  const locales = target === true ? languages : [target]
  return locales.some((locale) => {
    const value = item.translations[locale]
    return value == null || String(value).trim() === ''
  })
}

function hasMissingKey(item: TinyI18nItem, query: TinyI18nTranslationsQuery) {
  if (!query.missing.key) {
    return true
  }

  return String(item.key ?? '').trim() === ''
}

function matchesKeywords(item: TinyI18nItem, keywords: string | undefined, path: string) {
  if (!keywords) {
    return true
  }

  const query = keywords.trim().toLowerCase()
  if (!query) {
    return true
  }

  const texts = [item.key, path]
  if (item.type === 'group') {
    texts.push(item.title)
  } else {
    texts.push(...Object.values(item.translations ?? {}))
  }

  return texts.some(text => String(text ?? '').toLowerCase().includes(query))
}

export function filterTranslationsItems(
  items: TinyI18nItem[],
  query: TinyI18nTranslationsQuery,
  languages: string[],
) {
  if (!items.length) {
    return []
  }

  const context = buildItemPathContext(items)
  const hasActiveFilters = Boolean(query.keywords)
    || query.missing.key === true
    || query.missing.translation != null
    || query.include.length > 0
    || query.exclude.length > 0

  if (!hasActiveFilters) {
    return items
  }

  const includedIds = new Set<string>()

  for (const item of items) {
    const path = context.getPath(item.id)
    if (query.include.length > 0 && !matchesPathRule(path, query.include)) {
      continue
    }
    if (query.exclude.length > 0 && matchesPathRule(path, query.exclude)) {
      continue
    }
    if (!matchesKeywords(item, query.keywords, path)) {
      continue
    }
    if (!hasMissingKey(item, query)) {
      continue
    }
    if (!hasMissingTranslation(item, query, languages)) {
      continue
    }

    includedIds.add(item.id)
    for (const ancestorId of context.getAncestorIds(item.id)) {
      includedIds.add(ancestorId)
    }
  }

  return items.filter(item => includedIds.has(item.id))
}
