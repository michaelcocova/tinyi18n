import { isPlainObject } from 'lodash-es'
import { nanoid } from 'nanoid'

interface Node {
  key: string
  value: unknown
  path: string
  locale: string
}

export function flattenLocales(
  locales: Record<string, Record<string, any>>,
): I18nMessage[] {
  const nodeMap = new Map<string, I18nMessage & { path?: string }>()
  const stack: Node[] = []

  for (const [locale, tree] of Object.entries(locales)) {
    for (const [key, value] of Object.entries(tree)) {
      stack.push({ key, value, path: key, locale })
    }
  }

  while (stack.length) {
    const node = stack.pop()!

    if (isPlainObject(node.value)) {
      let group = nodeMap.get(node.path) as any
      if (!group || group.type !== 1) {
        group = { id: nanoid(28), key: node.key, type: 1, path: node.path }
        nodeMap.set(node.path, group)
      }
      for (const [key, value] of Object.entries(node.value as Record<string, any>)) {
        stack.push({ key, value, path: `${node.path}.${key}`, locale: node.locale })
      }
    }
    else {
      let message = nodeMap.get(node.path) as any
      if (!message || message.type !== 2) {
        message = {
          id: nanoid(28),
          key: node.key,
          type: 2,
          path: node.path,
          translations: {},
        }
        nodeMap.set(node.path, message)
      }
      message.translations[node.locale] = String(node.value)
    }
  }

  const result = [...nodeMap.values()] as I18nMessage[]

  const pathIdMap = new Map<string, string>()
  for (const [path, n] of nodeMap) {
    pathIdMap.set(path, n.id as string)
  }
  for (const [path, n] of nodeMap) {
    const parentPath = path.slice(0, path.lastIndexOf('.'))
    if (parentPath) {
      n.parent = pathIdMap.get(parentPath) as any
    }
  }

  return result.sort((a, b) => (a.type as number) - (b.type as number) || 0)
}
