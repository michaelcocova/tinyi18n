import { createGlobalState } from '@vueuse/core'
import { compare } from 'fast-json-patch'
import { ref } from 'vue'
import { toast } from '../../utils/toast.ts'
import { createIoScheduler } from '../io/scheduler.ts'
import { useWorkspace } from '../workspace/useWorkspace.ts'

export const useSaveQueue = createGlobalState(() => {
  const workspace = useWorkspace()
  const lastSavedAt = ref<number>()
  const saveError = ref('')
  const scheduler = createIoScheduler<string>({
    delay: 1500,
    compact: (names) => {
      // 保留顺序的去重：同一个文件在队列里只需要保存一次
      const seen = new Set<string>()
      return names.filter((name) => {
        if (seen.has(name)) {
          return false
        }
        seen.add(name)
        return true
      })
    },
    save: async (names) => {
      try {
        saveError.value = ''
        const patches = names
          .map((name) => {
            const baseline = workspace.getBaseline(name)
            const current = workspace.files.value.find(file => file.dir === name)?.data
            if (!baseline || !current) {
              return null
            }
            const patch = compare(baseline, current)
            if (!patch.length) {
              return null
            }
            return { dir: name, patch }
          })
          .filter(Boolean) as Array<{ dir: string, patch: any[] }>

        if (patches.length) {
          await workspace.push(patches)
          for (const item of patches) {
            workspace.commitBaseline(item.dir)
          }
        }

        lastSavedAt.value = Date.now()
      }
      catch (error) {
        saveError.value
          = error instanceof Error ? error.message : String(error)
        toast.error('保存失败', { description: saveError.value })
        throw error
      }
    },
  })

  /**
   * 新前端：以“文件”为粒度标记脏数据。
   * - name 形如：`.tinyi18n/data/.data.sso.json`
   */
  function touch(name: string) {
    saveError.value = ''
    if (!name) {
      return
    }
    scheduler.schedule(name)
  }

  /**
   * 兼容旧代码：旧实现会 push TinyI18nOperation。
   * 新前端不再依赖这个入口，因此这里直接忽略即可。
   */
  function push(_operation: TinyI18nOperation) {
    saveError.value = ''
  }

  async function flush() {
    await scheduler.flush()
  }

  return {
    saving: scheduler.isSaving,
    pendingCount: scheduler.pendingCount,
    lastSavedAt,
    saveError,
    push,
    touch,
    flush,
  }
})
