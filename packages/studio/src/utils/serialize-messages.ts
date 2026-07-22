import type { LocaleWorkspace } from '@/composables/workspace/useLocalesStore'

interface ConfigEntry {
  dir: string
  namespaces: string[]
}

/**
 * 从扁平 I18nMessage[] 重建 PUT 接口需要的嵌套格式。
 *
 * config 驱动遍历，每条路要哪些 namespace 就从树上摘哪些。
 * namespace 的 key 不可编辑，所以按 key 查找可靠。
 */
export function serializeMessages(
  messages: I18nMessage[],
  config: ConfigEntry[],
): LocaleWorkspace {
  // parentId → children
  const childrenMap = new Map<string, I18nMessage[]>()
  for (const msg of messages) {
    const pid = msg.parent ?? '__root__'
    if (!childrenMap.has(pid))
      childrenMap.set(pid, [])
    childrenMap.get(pid)!.push(msg)
  }

  // 收集所有 locale
  const allLocales = new Set<string>()
  for (const msg of messages) {
    if (msg.type === 2 && msg.translations) {
      for (const loc of Object.keys(msg.translations)) {
        allLocales.add(loc)
      }
    }
  }
  const sortedLocales = [...allLocales].sort()

  const result: LocaleWorkspace = {}

  for (const entry of config) {
    for (const nsKey of entry.namespaces) {
      const ns = messages.find(m => m.type === 1 && !m.parent && m.key === nsKey)
      if (!ns)
        continue

      if (!result[entry.dir])
        result[entry.dir] = {}

      for (const locale of sortedLocales) {
        if (!result[entry.dir][locale])
          result[entry.dir][locale] = {}
        result[entry.dir][locale][ns.key] = buildTree(ns.id, childrenMap, locale)
      }
    }
  }

  return result
}

function buildTree(
  parentId: string,
  childrenMap: Map<string, I18nMessage[]>,
  locale: string,
): Record<string, any> {
  const obj: Record<string, any> = {}
  const children = childrenMap.get(parentId) ?? []

  children.sort((a, b) => {
    if (a.type !== b.type)
      return a.type - b.type
    return a.key.localeCompare(b.key)
  })

  for (const child of children) {
    if (child.type === 1) {
      obj[child.key] = buildTree(child.id, childrenMap, locale)
    }
    else {
      obj[child.key] = child.translations?.[locale] ?? ''
    }
  }

  return obj
}
