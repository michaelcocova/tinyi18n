import type { LocaleValue, LocaleWorkspace } from './useLocalesStore'
import { createGlobalState } from '@vueuse/core'
import { useLocalesStore } from './useLocalesStore'

function mergeWorkspaceLocales(workspace: LocaleWorkspace): LocaleValue {
  const result: LocaleValue = {}
  for (const values of Object.values(workspace)) {
    for (const [locale, messages] of Object.entries(values)) {
      result[locale] ??= {}
      deepMerge(result[locale], messages)
    }
  }
  return result
}

export const useAssembleMessages = createGlobalState(() => {
  const { workspace } = useLocalesStore()
  const messages = ref<I18nMessage[]>([])
  const locales = ref<string[]>([])

  /** 从 workspace 重新计算 messages（deepMerge → flattenLocales） */
  function loadMessages() {
    const merged = mergeWorkspaceLocales(workspace.value)
    locales.value = Object.keys(merged).sort()
    messages.value = flattenLocales(merged)
  }

  return {
    locales,
    messages,
    loadMessages,
  }
})
