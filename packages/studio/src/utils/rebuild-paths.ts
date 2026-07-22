/**
 * 从 parent 链重建所有节点的 path。
 * path = 从根 namespace 到当前节点的 key 拼接（用 . 分隔）
 */

export function rebuildPaths(messages: I18nMessage[]) {
  const nodeMap = new Map<string, I18nMessage>()
  for (const msg of messages) {
    nodeMap.set(msg.id, msg)
  }
  for (const msg of messages) {
    msg.path = getFullPath(msg, nodeMap)
  }
}

function getFullPath(msg: I18nMessage, map: Map<string, I18nMessage>): string {
  if (!msg.parent)
    return msg.key
  const parent = map.get(msg.parent)
  if (!parent)
    return msg.key
  return `${getFullPath(parent, map)}.${msg.key}`
}

/**
 * 按父级排序：同父节点下，group 排在 message 前面
 */
export function sortNodesByType(messages: I18nMessage[]) {
  const parentGroups = new Map<string, I18nMessage[]>()
  const parentMessages = new Map<string, I18nMessage[]>()

  for (const msg of messages) {
    const pid = msg.parent ?? '__root__'
    if (msg.type === 1) {
      if (!parentGroups.has(pid))
        parentGroups.set(pid, [])
      parentGroups.get(pid)!.push(msg)
    }
    else {
      if (!parentMessages.has(pid))
        parentMessages.set(pid, [])
      parentMessages.get(pid)!.push(msg)
    }
  }

  // 按 parent 排序：每个父级下 groups 在前，messages 在后
  // 组内维持原顺序
  const allParents = new Set(messages.map(m => m.parent ?? '__root__'))
  const result: I18nMessage[] = []
  for (const pid of allParents) {
    result.push(...(parentGroups.get(pid) ?? []))
    result.push(...(parentMessages.get(pid) ?? []))
  }

  // 直接替换原数组内容
  messages.length = 0
  messages.push(...result)
}
