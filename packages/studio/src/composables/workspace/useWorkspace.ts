import type { Operation } from 'fast-json-patch'
import { createGlobalState } from '@vueuse/core'
import { computed, ref, toRaw, watch } from 'vue'

export interface WorkspaceBootstrapResponse {
  initialized: boolean
  config: TinyI18nConfig
  error?: string
}

export interface WorkspacePullItem {
  /**
   * 形如：`.tinyi18n/data`
   */
  dir: string
  files: string[]
  data: Record<string, any>
}

export interface WorkspacePushFile {
  name: string
  patch: Operation[]
}

function cloneJson<T>(value: T): T {
  // 注意：Vue 会把对象变成 Proxy，structuredClone 无法克隆 Proxy，会抛 DataCloneError。
  // 这里统一先 toRaw，再尝试 structuredClone，失败则回退到 JSON clone。
  // 我们的数据结构本身是纯 JSON，因此 JSON clone 足够稳定。
  const raw = toRaw(value) as any
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(raw)
      : JSON.parse(JSON.stringify(raw)) as T
  }
  catch {
    return JSON.parse(JSON.stringify(raw)) as T
  }
}

export const useWorkspace = createGlobalState(() => {
  const bootstrap = ref<WorkspaceBootstrapResponse>()
  const isBootstrapping = ref(false)
  const hasBootstrapped = ref(false)
  const bootstrapError = ref('')
  let pendingBootstrap: Promise<void> | null = null

  const files = ref<WorkspacePullItem[]>([])
  const isPulling = ref(false)
  const hasPulled = ref(false)
  const pullError = ref('')
  let pendingPull: Promise<void> | null = null

  const activeNamespace = ref('')

  // baseline 仅用于生成 patch：每次 pull / push 成功后刷新
  const baselineByName = new Map<string, Record<string, any>>()

  const config = computed(() => bootstrap.value?.config)
  const namespaces = computed(() => {
    const ns = config.value?.namespaces
    if (ns?.length)
      return ns
    // 单命名空间模式，前端用固定 key
    if (config.value?.mode === 'single') {
      return [{ key: '__DEFAULT__', description: '' }]
    }
    return []
  })
  const locales = computed(() => config.value?.locales?.map(item => item.code) ?? [])

  const initialized = computed(() => Boolean(bootstrap.value?.initialized))

  const filesByName = computed(() => {
    const map = new Map<string, WorkspacePullFile>()
    for (const file of files.value) {
      map.set(file.dir, file)
    }
    return map
  })

  function ensureActiveNamespace() {
    if (activeNamespace.value && namespaces.value.some(ns => ns.key === activeNamespace.value)) {
      return
    }
    activeNamespace.value = namespaces.value[0]?.key ?? ''
  }

  watch(namespaces, ensureActiveNamespace, { immediate: true })

  const activeFileName = computed(() => {
    if (config.value?.mode === 'single')
      return '.tinyi18n/data'
    const ns = namespaces.value.find(item => item.key === activeNamespace.value)
    if (!ns?.key) {
      return ''
    }
    return `.tinyi18n/data/${ns.key}`
  })

  const activeFile = computed(() => {
    if (!activeFileName.value) {
      return undefined
    }
    return filesByName.value.get(activeFileName.value)
  })

  function refreshBaselineFromFiles() {
    baselineByName.clear()
    for (const file of files.value) {
      baselineByName.set(file.dir, cloneJson(file.data))
    }
  }

  async function loadBootstrap(force = false) {
    if (pendingBootstrap && !force) {
      return pendingBootstrap
    }

    pendingBootstrap = (async () => {
      isBootstrapping.value = true
      bootstrapError.value = ''
      try {
        const response = await fetch(`/bootstrap?_t=${Date.now()}`)
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`)
        }
        const data = (await response.json()) as WorkspaceBootstrapResponse
        bootstrap.value = data
        hasBootstrapped.value = true
        bootstrapError.value = data.error ?? ''
      }
      catch (error) {
        bootstrapError.value = error instanceof Error ? error.message : String(error)
      }
      finally {
        isBootstrapping.value = false
        pendingBootstrap = null
      }
    })()

    return pendingBootstrap
  }

  async function loadPull(force = false) {
    if (pendingPull && !force) {
      return pendingPull
    }

    pendingPull = (async () => {
      isPulling.value = true
      pullError.value = ''
      try {
        const response = await fetch(`/pull?_t=${Date.now()}`)
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`)
        }
        const data = (await response.json()) as WorkspacePullFile[]
        files.value = Array.isArray(data) ? data : []
        hasPulled.value = true
        refreshBaselineFromFiles()
      }
      catch (error) {
        pullError.value = error instanceof Error ? error.message : String(error)
      }
      finally {
        isPulling.value = false
        pendingPull = null
      }
    })()

    return pendingPull
  }

  async function refreshAll(force = false) {
    await loadBootstrap(force)
    if (initialized.value) {
      await loadPull(force)
    }
  }

  function mutateFileData(dir: string, mutator: (data: Record<string, any>) => void) {
    const file = files.value.find(item => item.dir === dir)
    if (!file) {
      return
    }
    mutator(file.data)
    // 触发响应式更新（file.data 是深层对象）
    files.value = [...files.value]
  }

  function getBaseline(dir: string) {
    return baselineByName.get(dir)
  }

  function commitBaseline(dir: string) {
    const current = filesByName.value.get(dir)?.data
    if (!current) {
      return
    }
    baselineByName.set(dir, cloneJson(current))
  }

  async function push(patches: WorkspacePushFile[]) {
    const response = await fetch('/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patches),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `Request failed: ${response.status}`)
    }
    await response.json().catch(() => null)
  }

  const state = computed(() => ({
    // bootstrap
    bootstrap: bootstrap.value,
    initialized: initialized.value,
    config: config.value,
    namespaces: namespaces.value,
    locales: locales.value,
    isBootstrapping: isBootstrapping.value,
    hasBootstrapped: hasBootstrapped.value,
    bootstrapError: bootstrapError.value,

    // pull
    files,
    activeNamespace: activeNamespace.value,
    activeFileName: activeFileName.value,
    activeFile: activeFile.value,
    isPulling: isPulling.value,
    hasPulled: hasPulled.value,
    pullError: pullError.value,
  }))

  return {
    state,
    // bootstrap
    bootstrap,
    config,
    namespaces,
    locales,
    initialized,
    loadBootstrap,

    // pull
    files,
    activeNamespace,
    activeFileName,
    activeFile,
    loadPull,

    // misc
    refreshAll,
    mutateFileData,
    getBaseline,
    commitBaseline,
    push,
  }
})
