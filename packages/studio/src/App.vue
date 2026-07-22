<script setup lang="ts">
import { onMounted } from 'vue'
import { Toaster } from 'vue-sonner'
import { useAssembleMessages } from './composables/workspace/useAssemblyMessages'
import { useLocalesStore } from './composables/workspace/useLocalesStore'
import 'vue-sonner/style.css'

const { loading, error, onLoad } = useLocalesStore()
const { loadMessages } = useAssembleMessages()

onMounted(async () => {
  await onLoad()
  loadMessages()
})

async function handleRetry() {
  await onLoad()
  loadMessages()
}
</script>

<template>
  <Toaster
    :duration="2000"
    rich-colors
    position="top-center"
  />
  <div class="h-screen w-full flex flex-col bg-white">
    <div
      v-if="loading"
      class="flex-1 flex items-center justify-center"
    >
      <div class="size-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
    </div>
    <div
      v-else-if="error"
      class="flex-1 flex items-center justify-center p-4"
    >
      <div class="text-center">
        <p class="text-sm text-rose-600">
          {{ error }}
        </p>
        <button
          class="mt-3 text-xs text-zinc-500 hover:text-zinc-900 underline"
          @click="handleRetry"
        >
          重试
        </button>
      </div>
    </div>
    <template v-else>
      <AppHeader />
      <main class="flex-1 overflow-hidden">
        <RouterView />
      </main>
    </template>
  </div>
</template>
