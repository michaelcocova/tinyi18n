<script setup lang="ts">
import type { SearchBoxSchema } from './types'
import { Search, X } from '@lucide/vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const props = defineProps<{
  items: Array<{
    id: string
    schema: SearchBoxSchema
    value: string
  }>
  openEditorId?: string | null
}>()

const emit = defineEmits<{
  (event: 'removeItem', item: { id: string }): void
  (event: 'openEditor', item: { id: string }): void
  (event: 'closeEditor'): void
}>()
</script>

<template>
  <Search class="size-4 shrink-0 text-muted-foreground" />

  <Popover
    v-for="item in props.items"
    :key="item.id"
    :open="props.openEditorId === item.id"
    @update:open="(open) => open ? emit('openEditor', { id: item.id }) : emit('closeEditor')"
  >
    <PopoverTrigger as-child>
      <span
        class="inline-flex h-7 max-w-64 items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-xs font-normal"
        :title="`${item.schema.label} ${item.schema.operator || ':'} ${item.value}`"
        role="button"
        tabindex="0"
      >
        <slot
          name="tag"
          :schema="item.schema"
          :value="item.value"
          :remove="() => emit('removeItem', { id: item.id })"
          :edit="() => emit('openEditor', { id: item.id })"
        >
          <span class="truncate">
            {{ item.schema.label }} {{ item.schema.operator || ":" }} {{ item.value }}
          </span>
        </slot>
        <button
          class="rounded-md p-0.5 hover:bg-black/10"
          type="button"
          aria-label="移除条件"
          @click.stop="emit('removeItem', { id: item.id })"
        >
          <X class="size-3" />
        </button>
      </span>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="w-[22rem] p-2"
    >
      <slot
        name="editor"
        :schema="item.schema"
        :value="item.value"
        :close="() => emit('closeEditor')"
      />
    </PopoverContent>
  </Popover>
</template>
