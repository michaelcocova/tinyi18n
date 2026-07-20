<script setup lang="ts">
import type { WorkspaceViewModel } from './useWorkspace'
import { FolderPlus, Plus, Trash2 } from '@lucide/vue'
import CopyButton from '@/components/CopyButton.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{
  workspace: WorkspaceViewModel
}>()

function handleAddGroup() {
  const node = props.workspace.selectedNode.value
  if (!node || node.type !== 'group') {
    return
  }
  props.workspace.createGroup(node)
}

function handleAddMessage() {
  const node = props.workspace.selectedNode.value
  if (!node) {
    return
  }

  if (node.type === 'group') {
    props.workspace.createMessage(node)
    return
  }

  props.workspace.appendMessageAfter(node)
}

function handleDelete() {
  const node = props.workspace.selectedNode.value
  if (!node) {
    return
  }
  props.workspace.handleDeleteNode(node)
}
</script>

<template>
  <div class="p-4">
    <div class="max-w-3xl mx-auto space-y-4">
      <div
        v-if="!workspace.selectedNode.value"
        class="text-sm text-muted-foreground"
      >
        请选择一个节点进行编辑
      </div>
      <div
        v-else
        class="py-4 space-y-4"
      >
        <div class="space-y-2">
          <!-- 分组操作栏 -->
          <div class="flex items-center gap-2 [&>button]:min-w-24 [&>button]:h-7">
            <Button
              v-if="workspace.selectedNode.value.type === 'group'"
              class="font-normal text-xs"
              variant="secondary"
              size="sm"
              @click="handleAddGroup"
            >
              <FolderPlus class="size-3.5" />
              添加分组
            </Button>
            <Button
              class="font-normal text-xs"
              variant="secondary"
              size="sm"
              @click="handleAddMessage"
            >
              <Plus class="size-3.5" />
              添加词条
            </Button>
            <Button
              variant="destructive"
              size="sm"
              class="font-normal text-xs bg-destructive/20 text-destructive hover:bg-destructive/50 hover:text-black"
              @click="handleDelete"
            >
              <Trash2 class="size-3.5" />
              删除
            </Button>
          </div>
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs text-muted-foreground">
              Key（开发使用）
            </div>
            <div class="flex items-center gap-2 min-w-0">
              <CopyButton
                class="shrink-0"
                separator="."
                :content="workspace.selectedKeyChain.value"
              />
            </div>
          </div>
          <Input
            :model-value="workspace.draftKey.value"
            class="text-sm"
            placeholder="请输入 key"
            @blur="workspace.commitSelectedKey"
            @keydown.enter.prevent="workspace.commitSelectedKey"
            @update:model-value="workspace.setDraftKey(String($event))"
          />
        </div>

        <template v-if="workspace.selectedNode.value.type === 'group'">
          <div class="space-y-2">
            <div class="text-xs text-muted-foreground">
              标题（$label）
            </div>
            <Input
              class="text-sm"
              :model-value="String(workspace.getSelectedRawGroup()?.$label ?? '')"
              placeholder="请输入分组标题"
              @update:model-value="workspace.updateGroupTitle(String($event))"
            />
            <div class="text-[11px] text-muted-foreground">
              置空会写入空字符串，不再删除 `$label` 字段。
            </div>
          </div>
        </template>

        <template v-else>
          <div
            v-for="locale in workspace.translationLocales.value"
            :key="locale.code"
            class="space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs text-muted-foreground">
                {{ locale.label }}
              </div>
              <div class="text-[11px] text-muted-foreground font-mono">
                {{ locale.code }}
              </div>
            </div>
            <Textarea
              class="field-sizing-content min-h-8 max-h-60 resize-none text-sm"
              :model-value="String(workspace.getSelectedRawMessage()?.translations?.[locale.code] ?? '')"
              placeholder="请输入"
              @update:model-value="workspace.updateMessageTranslation(locale.code, String($event))"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
