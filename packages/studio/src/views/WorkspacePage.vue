<script setup lang="ts">
import { computed } from 'vue'
import { useMessageTree } from '@/composables/workspace/useMessageTree'
import WorkspaceDetailView from './workspace/WorkspaceDetailView.vue'
import WorkspaceTreeView from './workspace/WorkspaceTreeView.vue'

const { selectedKey, findNode } = useMessageTree()
const selectedNode = computed(() => selectedKey.value ? findNode(selectedKey.value) : undefined)
</script>

<template>
  <ResizablePanelGroup
    direction="horizontal"
    class="h-full overflow-hidden"
  >
    <ResizablePanel
      size-unit="px"
      :default-size="300"
      :min-size="220"
      :max-size="480"
    >
      <WorkspaceTreeView />
    </ResizablePanel>
    <ResizableHandle with-handle />
    <ResizablePanel size-unit="px">
      <WorkspaceDetailView :node="selectedNode as any" />
    </ResizablePanel>
  </ResizablePanelGroup>
</template>
