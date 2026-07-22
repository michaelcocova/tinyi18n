import { useDebounceFn } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { rebuildPaths, sortNodesByType } from '@/utils/rebuild-paths'
import { serializeMessages } from '@/utils/serialize-messages'
import { useAssembleMessages } from './useAssemblyMessages'
import { useLocalesStore } from './useLocalesStore'

export function useTranslationEditor() {
  const isDirty = ref(false)
  const { config } = useLocalesStore()
  const { messages } = useAssembleMessages()

  /** 从现有 messages 收集所有 locale */
  function collectLocales(): string[] {
    const set = new Set<string>()
    for (const msg of messages.value) {
      if (msg.type === 2 && msg.translations) {
        for (const loc of Object.keys(msg.translations)) {
          set.add(loc)
        }
      }
    }
    return [...set].sort()
  }

  /** 按 id 更新翻译值 */
  function updateTranslation(id: string, locale: string, value: string) {
    isDirty.value = true
    const msg = messages.value.find(m => m.id === id)
    if (!msg || msg.type !== 2)
      return
    msg.translations[locale] = value
    messages.value = [...messages.value]
  }

  /** 按 id 更新 key，自动重建子树 path */
  function updateKey(id: string, newKey: string) {
    if (!newKey)
      return
    isDirty.value = true
    const msg = messages.value.find(m => m.id === id)
    if (!msg)
      return
    msg.key = newKey
    rebuildPaths(messages.value)
    messages.value = [...messages.value]
  }

  /** 在指定 group 下插入一条新 message */
  function addMessage(parentId: string) {
    isDirty.value = true
    const parent = messages.value.find(m => m.id === parentId)
    if (!parent)
      return

    const locales = collectLocales()
    const translations: Record<string, string> = {}
    for (const loc of locales) translations[loc] = ''

    const msg: I18nMessage = {
      id: nanoid(28),
      key: '',
      type: 2,
      parent: parentId,
      translations,
    } as I18nMessage

    messages.value = [...messages.value, msg]
    rebuildPaths(messages.value)
    sortNodesByType(messages.value)
    messages.value = [...messages.value]
  }

  /** 在指定 group 下插入一个新 group + 子 message */
  function addGroup(parentId: string) {
    isDirty.value = true
    const parent = messages.value.find(m => m.id === parentId)
    if (!parent)
      return

    const locales = collectLocales()
    const translations: Record<string, string> = {}
    for (const loc of locales) translations[loc] = ''

    const groupId = nanoid(28)
    const msgId = nanoid(28)

    const group: I18nMessage = {
      id: groupId,
      key: '',
      type: 1,
      parent: parentId,
    } as I18nMessage
    const childMsg: I18nMessage = {
      id: msgId,
      key: `m__${Date.now().toString(36)}`,
      type: 2,
      parent: groupId,
      translations,
    } as I18nMessage

    messages.value = [...messages.value, group, childMsg]
    rebuildPaths(messages.value)
    sortNodesByType(messages.value)
    messages.value = [...messages.value]
  }

  /** 删除节点及其所有后代 */
  function deleteNode(id: string) {
    isDirty.value = true
    const toRemove = new Set<string>()
    const collect = (parentId: string) => {
      toRemove.add(parentId)
      for (const msg of messages.value) {
        if (msg.parent === parentId)
          collect(msg.id)
      }
    }
    collect(id)
    messages.value = messages.value.filter(m => !toRemove.has(m.id))
  }

  const save = useDebounceFn(async () => {
    const payload = serializeMessages(messages.value, config.value)
    const resp = await fetch('/api/locales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!resp.ok)
      throw new Error(`保存失败: ${resp.status}`)
    isDirty.value = false
  }, 1500)

  async function saveImmediate() {
    const payload = serializeMessages(messages.value, config.value)
    const resp = await fetch('/api/locales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!resp.ok)
      throw new Error(`保存失败: ${resp.status}`)
    isDirty.value = false
  }

  return {
    isDirty,
    updateTranslation,
    updateKey,
    addMessage,
    addGroup,
    deleteNode,
    save,
    saveImmediate,
  }
}
