<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Clipboard, ClipboardCheck } from '@lucide/vue'
import { useClipboard } from '@vueuse/core'

const props = withDefaults(defineProps<{
  separator?: string
  text?: string | false
  content?: string | string[]
  class?: HTMLAttributes['class']
}>(), {
  text: false,
})
const copyText = computed(() => {
  if (!props.content) {
    return ''
  }
  return Array.isArray(props.content) ? props.content.join(props.separator || '') : props.content
})
const { copied, copy } = useClipboard({
  legacy: true,
  source: copyText,
})
function onCopy() {
  if (!copyText.value) {
    return
  }
  copy().then(() => {
    toast.success('复制成功')
  })
}
</script>

<template>
  <Button
    :disabled="!copyText"
    variant="ghost"
    :class="cn(props?.class, 'overflow-hidden')"
    :size="text ? 'sm' : 'icon-sm'"
    @click="onCopy"
  >
    <ClipboardCheck v-if="copied" />
    <Clipboard v-else />
    <span
      v-if="text"
      class="truncate flex-1"
    >
      {{ text }}
    </span>
  </Button>
</template>
