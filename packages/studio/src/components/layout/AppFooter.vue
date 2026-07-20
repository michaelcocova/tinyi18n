<script setup lang="ts">
import type { StatusVariants } from '@/components/ui/status'
import { computed } from 'vue'
import { Status } from '@/components/ui/status'
import { useProjectFileSync } from '@/composables/commands/useProjectFileSync'
import { useSaveQueue } from '@/composables/commands/useSaveQueue'
import { useLocaleConfig } from '@/composables/core/useLocaleConfig'
import { useWorkspace } from '@/composables/workspace/useWorkspace'

const { state } = useWorkspace()
const { localeConfig } = useLocaleConfig()
const { saving, pendingCount, lastSavedAt, saveError } = useSaveQueue()
const { isSyncing, lastSyncedAt, error: syncError } = useProjectFileSync()

const statusVariant = computed<StatusVariants['variant']>(() => {
  if (saveError.value) {
    return 'error'
  }
  else if (saving.value) {
    return 'loading'
  }
  else if (pendingCount.value > 0) {
    return 'pending'
  }
  else if (lastSavedAt.value) {
    return 'saved'
  }
  else {
    return 'idle'
  }
})
const statusText = computed<string>(() => {
  if (saveError.value) {
    return '保存失败，等待重试'
  }
  else if (saving.value) {
    return '正在保存 ...'
  }
  else if (pendingCount.value > 0) {
    return `待保存 ${pendingCount.value} 项`
  }
  else if (lastSavedAt.value) {
    return '已保存'
  }
  else {
    return '暂无未保存修改'
  }
})

const syncStatusVariant = computed<StatusVariants['variant']>(() => {
  if (syncError.value) {
    return 'error'
  }
  else if (isSyncing.value) {
    return 'loading'
  }
  else if (lastSyncedAt.value) {
    return 'saved'
  }
  else {
    return 'idle'
  }
})

const syncStatusText = computed<string>(() => {
  if (syncError.value) {
    return '同步失败'
  }
  else if (isSyncing.value) {
    return '正在同步 ...'
  }
  else if (lastSyncedAt.value) {
    return '已同步'
  }
  else {
    return '未同步'
  }
})
</script>

<template>
  <footer class="flex items-center justify-between gap-4 p-1 px-2 text-xs">
    <p
      v-if="state.isBootstrapping"
      class="text-muted-foreground"
    >
      正在加载 /bootstrap ...
    </p>
    <span
      v-else-if="state.bootstrapError && !state.hasBootstrapped"
      class="text-destructive"
    >
      加载失败：{{ state.bootstrapError }}
    </span>
    <p
      v-else
      class="text-muted-foreground"
    >
      默认语言 {{ localeConfig.defaultLocaleConfig?.label }}
    </p>
    <div class="flex items-center gap-3">
      <Status
        :variant="syncStatusVariant"
        class="text-xs"
      >
        <small>{{ syncStatusText }}</small>
      </Status>
      <Status
        :variant="statusVariant"
        class="text-xs"
      >
        <small>{{ statusText }}</small>
      </Status>
    </div>
  </footer>
</template>
