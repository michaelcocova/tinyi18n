<script setup lang="ts">
import { useWorkspaceView } from './workspace/useWorkspace'
import WorkspaceDetailView from './workspace/WorkspaceDetailView.vue'
import WorkspaceTreeView from './workspace/WorkspaceTreeView.vue'

const workspace = useWorkspaceView()
</script>

<template>
  <ResizablePanelGroup
    direction="horizontal"
    class="h-full overflow-hidden "
  >
    <ResizablePanel
      size-unit="px"
      :default-size="300"
      :min-size="260"
      :max-size="480"
    >
      <WorkspaceTreeView :workspace="workspace" />
    </ResizablePanel>
    <ResizableHandle with-handle />
    <ResizablePanel size-unit="px">
      <WorkspaceDetailView :workspace="workspace" />
    </ResizablePanel>
  </ResizablePanelGroup>
</template>
