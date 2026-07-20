<script setup lang="ts">
import { createHighlighter } from 'shiki'
import { computed, onMounted, ref, shallowRef, watchEffect } from 'vue'

const props = defineProps<{
  code: string
  files: string[]
}>()

const highlightedCode = ref('')
const highlightedTree = ref('')
const highlighter = shallowRef<any>(null)

onMounted(async () => {
  highlighter.value = await createHighlighter({
    themes: ['one-light'],
    langs: ['json', 'bash'],
  })
})

const treeLines = computed(() => {
  const files = [...props.files]
    .map((item) => {
      const normalized = item.replace(/^\.\/+/, '')
      return normalized.replace(/^\.tinyi18n\//, '')
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  if (files.length === 0) {
    return ['./.tinyi18n']
  }

  const lines = ['./.tinyi18n']

  files.forEach((file, index) => {
    const isLast = index === files.length - 1
    lines.push(`${isLast ? '└──' : '├──'} ${file}`)
  })

  return lines
})

watchEffect(() => {
  if (highlighter.value) {
    highlightedTree.value = highlighter.value.codeToHtml(treeLines.value.join('\n'), {
      lang: 'bash',
      theme: 'one-light',
    })
    highlightedCode.value = highlighter.value.codeToHtml(props.code, {
      lang: 'json',
      theme: 'one-light',
    })
  }
  else {
    highlightedTree.value = `<pre class="font-mono text-xs leading-6 text-zinc-600"><code>${treeLines.value.join('\n')}</code></pre>`
    highlightedCode.value = `<pre class="font-mono text-sm leading-relaxed text-zinc-300"><code>${props.code}</code></pre>`
  }
})
</script>

<template>
  <div class="h-svh sticky top-0 flex items-center">
    <div class="w-full lg:w-md space-y-4 max-h-4/5 flex flex-col">
      <div
        class="w-full max-h-auto overflow-hidden flex flex-col rounded-lg border bg-muted/50"
      >
        <div class="flex items-center gap-2 border-b bg-background/60 px-4 py-2.5">
          <div class="flex gap-1.5">
            <span class="size-2.5 rounded-full bg-red-500" />
            <span class="size-2.5 rounded-full bg-yellow-500" />
            <span class="size-2.5 rounded-full bg-green-500" />
          </div>
          <span class="ml-2 font-mono text-sm text-muted-foreground/60">
            ./.tinyi18n
          </span>
        </div>
        <div
          class="flex-1 overflow-y-auto outline-0 px-5 py-4 font-mono text-xs leading-6 sm:px-6"
          v-html="highlightedTree"
        />
      </div>
      <div
        class="w-full max-h-auto overflow-hidden flex flex-col rounded-lg border bg-muted/50"
      >
        <div class="flex items-center gap-2 border-b bg-background/60 px-4 py-2.5">
          <div class="flex gap-1.5">
            <span class="size-2.5 rounded-full bg-red-500" />
            <span class="size-2.5 rounded-full bg-yellow-500" />
            <span class="size-2.5 rounded-full bg-green-500" />
          </div>
          <span class="ml-2 font-mono text-sm text-muted-foreground/60">
            config.json
          </span>
        </div>
        <div
          class="flex-1 overflow-y-auto outline-0 px-5 py-4 font-mono text-xs leading-6 sm:px-6"
          v-html="highlightedCode"
        />
      </div>
    </div>
  </div>
</template>
