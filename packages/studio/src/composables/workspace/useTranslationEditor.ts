import { useDebounceFn } from '@vueuse/core'
import { get, set, unset } from 'lodash-es'
import { nanoid } from 'nanoid'
import { useAssembleMessages } from './useAssemblyMessages'
import { useLocalesStore } from './useLocalesStore'
import { useMessageTree } from './useMessageTree'

export function useTranslationEditor() {
  const { workspace, config } = useLocalesStore()
  const { messages } = useAssembleMessages()
  const { selectedKey } = useMessageTree()

  const namespaceToDirs = computed(() => {
    const map: Record<string, string[]> = {}
    for (const entry of config.value) {
      for (const ns of entry.namespaces) {
        if (!map[ns])
          map[ns] = []
        if (!map[ns].includes(entry.dir))
          map[ns].push(entry.dir)
      }
    }
    return map
  })

  function writeValue(key: string, locale: string, value: string): boolean {
    const ns = key.split('.')[0]
    const dirs = namespaceToDirs.value[ns]
    if (!dirs?.length)
      return false
    for (const dir of dirs) {
      const localeData = workspace.value[dir]?.[locale]
      if (!localeData)
        continue
      set(localeData, key, value)
    }
    return true
  }

  function updateTranslation(key: string, locale: string, value: string) {
    writeValue(key, locale, value)
    const msg = messages.value.find((m: any) => m.path === key)
    if (msg && msg.type === 2) {
      msg.translations[locale] = value
      messages.value = [...messages.value]
    }
  }

  function updateKey(oldKey: string, newKey: string) {
    if (oldKey === newKey)
      return
    const ns = oldKey.split('.')[0]
    const dirs = namespaceToDirs.value[ns]
    if (!dirs?.length)
      return
    for (const dir of dirs) {
      for (const [locale, localeData] of Object.entries(workspace.value[dir] ?? {})) {
        if (!localeData)
          continue
        const val = get(localeData, oldKey)
        if (val === undefined)
          continue
        set(localeData, newKey, val)
        unset(localeData, oldKey)
      }
    }
    const msg = messages.value.find((m: any) => m.path === oldKey)
    if (msg) {
      const segs = newKey.split('.')
      msg.key = segs[segs.length - 1]
      ;(msg as any).path = newKey
      messages.value = [...messages.value]
    }
  }

  function addMessage(parentPath?: string) {
    if (!parentPath)
      return
    const newKey = `${parentPath}.`
    const keyName = ''
    const ns = parentPath.split('.')[0]
    const dirs = namespaceToDirs.value[ns]
    if (!dirs?.length)
      return
    const locales = new Set<string>()
    for (const dir of dirs) {
      for (const locale of Object.keys(workspace.value[dir] ?? {})) {
        locales.add(locale)
        set(workspace.value[dir], newKey, '')
      }
    }
    const parentGroup = messages.value.find((m: any) => m.path === parentPath)
    const msg: any = { id: nanoid(28), key: keyName, type: 2, path: newKey, translations: {} }
    for (const locale of locales) msg.translations[locale] = ''
    if (parentGroup)
      msg.parent = parentGroup.id
    messages.value = [...messages.value, msg]
  }

  function addGroup(parentPath?: string) {
    if (!parentPath)
      return
    const childKey = `${parentPath}.`
    const msgKey = `${parentPath}..`
    const keyName = ''
    const ns = parentPath.split('.')[0]
    const dirs = namespaceToDirs.value[ns]
    if (!dirs?.length)
      return
    const locales = new Set<string>()
    for (const dir of dirs) {
      for (const locale of Object.keys(workspace.value[dir] ?? {})) {
        locales.add(locale)
        set(workspace.value[dir], msgKey, '')
      }
    }
    const parentGroup = messages.value.find((m: any) => m.path === parentPath)
    const childGroupId = nanoid(28)
    const msgId = nanoid(28)
    const childGroup: any = { id: childGroupId, key: keyName, type: 1, path: childKey }
    if (parentGroup)
      childGroup.parent = parentGroup.id
    const newMsg: any = { id: msgId, key: `m__${Date.now().toString(36)}`, type: 2, path: msgKey, translations: {}, parent: childGroupId }
    for (const locale of locales) newMsg.translations[locale] = ''
    messages.value = [...messages.value, childGroup, newMsg]
  }

  function deleteNode(nodePath?: string) {
    if (!nodePath)
      return
    const ns = nodePath.split('.')[0]
    const dirs = namespaceToDirs.value[ns]
    if (!dirs?.length)
      return
    for (const dir of dirs) {
      for (const locale of Object.keys(workspace.value[dir] ?? {})) {
        unset(workspace.value[dir], nodePath)
      }
    }
    messages.value = messages.value.filter((m: any) => {
      return m.path !== nodePath && !m.path?.startsWith(`${nodePath}.`)
    })
  }

  function getPath(itemId: string): string | undefined {
    const msg = messages.value.find(m => m.id === itemId)
    return (msg as any)?.path
  }

  function getSelectedKey(): string | undefined {
    const msg = messages.value.find(m => m.id === selectedKey.value)
    return (msg as any)?.path
  }

  function cleanEmptyKeys(obj: Record<string, any>) {
    for (const k of Object.keys(obj)) {
      if (k === '') {
        delete obj[k]
        continue
      }
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        cleanEmptyKeys(obj[k])
        if (Object.keys(obj[k]).length === 0)
          delete obj[k]
      }
    }
  }

  const save = useDebounceFn(async () => {
    const payload = JSON.parse(JSON.stringify(workspace.value))
    cleanEmptyKeys(payload)
    const resp = await fetch('/api/locales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!resp.ok)
      throw new Error(`保存失败: ${resp.status}`)
  }, 1500)

  async function saveImmediate() {
    const resp = await fetch('/api/locales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspace.value),
    })
    if (!resp.ok)
      throw new Error(`保存失败: ${resp.status}`)
  }

  return {
    getPath,
    getSelectedKey,
    updateTranslation,
    updateKey,
    addMessage,
    addGroup,
    deleteNode,
    save,
    saveImmediate,
  }
}
