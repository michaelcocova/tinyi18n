<script setup lang="ts">
import type { MessageTreeNode } from '@/composables/workspace/useMessageTree'
import { ChevronRight, SquareDashedText, Trash2 } from '@lucide/vue'
import { NumberInput } from '@/components/NumberInput'

const props = defineProps<{
  node: MessageTreeNode
  isExpanded?: boolean
  isSelected?: boolean
  showNumberInput?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', node: MessageTreeNode): void
  (e: 'toggleExpanded', node: MessageTreeNode): void
  (e: 'insert', id: string): void
  (e: 'delete', id: string): void
}>()

function handleDbClick() {
  emit('select', props.node)
  emit('toggleExpanded', props.node)
}

function handleClick() {
  emit('select', props.node)
}

function handleExpand() {
  emit('toggleExpanded', props.node)
}
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div
        :style="{ 'padding-left': `calc(var(--spacing) * 3 * ${node.depth || 0})` }"
        :data-id="node.id"
        :data-selected="isSelected ? 'selected' : undefined"
        class="min-h-7 font-mono cursor-pointer px-1 flex items-center gap-1 relative data-[state=open]:bg-zinc-100 data-[selected=selected]:bg-zinc-100 hover:bg-zinc-100"
        @click="handleClick"
        @dblclick.stop.prevent="handleDbClick"
      >
        <button
          :class="cn('ml-1 transition-all rounded-full size-5 flex items-center justify-center hover:bg-zinc-200', {
            'opacity-0 pointer-events-none': node.original.type === 2,
          })"
          @click.stop.prevent="handleExpand"
        >
          <ChevronRight :class="cn('size-3.5 transition-transform duration-200', { 'rotate-90': isExpanded })" />
        </button>
        <label>{{ node.original?.key }}</label>
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem
        v-if="node.original?.type === 1"
        class="text-xs focus-within:bg-accent"
        @select="emit('insert', node.id)"
      >
        <SquareDashedText />
        插入词条
        <NumberInput
          v-if="showNumberInput"
          class="w-10"
        />
      </ContextMenuItem>
      <ContextMenuItem
        variant="destructive"
        class="text-xs text-destructive/80 hover:text-destructive!"
        @select="emit('delete', node.id)"
      >
        <Trash2 />
        删除
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
