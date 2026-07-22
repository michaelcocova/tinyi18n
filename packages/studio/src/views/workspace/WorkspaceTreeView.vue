<script setup lang="ts">
import { useMessageTree } from '@/composables/workspace/useMessageTree'
import { useTranslationEditor } from '@/composables/workspace/useTranslationEditor'
import { confirm } from '@/utils/confirm.ts'
import WorkspaceTreeNode from './WorkspaceTreeNode.vue'

const { items, isExpanded, toggleExpanded, isSelected, toggleSelected } = useMessageTree()
const { addMessage, deleteNode, getPath } = useTranslationEditor()

async function handleDelete(nodeId: string) {
  const path = getPath(nodeId)
  if (!path)
    return
  const ok = await confirm({ title: '确认删除', description: '删除后无法恢复', confirmText: '删除', confirmVariant: 'destructive' })
  if (!ok)
    return
  deleteNode(path)
}

function handleSelect(node: any) {
  toggleSelected(node.id)
}
</script>

<template>
  <div class="h-full overflow-auto text-sm select-none">
    <WorkspaceTreeNode
      v-for="item in items"
      :key="item.id"
      :node="item"
      :is-selected="isSelected(item.id)"
      :is-expanded="isExpanded(item.id)"
      :show-number-input="(item.original as any).type === 1"
      @select="handleSelect"
      @toggle-expanded="(node: any) => toggleExpanded(node.id)"
      @insert="addMessage(getPath($event) || '')"
      @delete="handleDelete($event)"
    />
  </div>
</template>
