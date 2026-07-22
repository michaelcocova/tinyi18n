import { createGlobalState } from '@vueuse/core'
import { ref } from 'vue'

interface ConfigEntry {
  dir: string
  namespaces: string[]
}

export interface LocaleMessages {
  [key: string]: string | LocaleMessages
}

export type LocaleValue = Record<string, LocaleMessages>

export type LocaleWorkspace = Record<string, LocaleValue>
export const useLocalesStore = createGlobalState(() => {
  const loading = useLoading()
  const error = ref<string>()
  const config = ref<ConfigEntry[]>([])
  const workspace = ref<LocaleWorkspace>({})
  async function onLoadConfig() {
    loading.value = true
    try {
      const configResp = await fetch('/api/config')
      if (!configResp.ok)
        throw new Error(`配置加载失败: ${configResp.status}`)
      const _config: ConfigEntry[] = await configResp.json()
      config.value = _config
    }
    catch (e: any) {
      error.value = e?.message || '配置加载失败'
    }
    finally {
      loading.value = false
    }
  }
  async function onLoadLocales() {
    loading.value = true
    try {
      const configResp = await fetch('/api/locales')
      if (!configResp.ok)
        throw new Error(`语言加载失败: ${configResp.status}`)
      const _workspace: LocaleWorkspace = await configResp.json()
      workspace.value = _workspace
    }
    catch (e: any) {
      error.value = e?.message || '配置加载失败'
    }
    finally {
      loading.value = false
    }
  }
  async function onLoad() {
    await onLoadConfig()
    await onLoadLocales()
  }
  return {
    loading,
    onLoad,
    error,
    config,
    workspace,
  }
})
