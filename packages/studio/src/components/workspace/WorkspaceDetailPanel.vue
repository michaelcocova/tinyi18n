<script setup lang="ts">
import type { LocaleTreeGroupNode } from '../../../../cli/src/core/message.ts'
import { FolderInput, FolderPlus, Plus, Trash2 } from '@lucide/vue'
import { get } from 'lodash-es'
import { useItemEditor } from '../../composables/commands/useItemEditor.ts'
import { useLocaleConfig } from '../../composables/core/useLocaleConfig.ts'
import { useGroupTree } from '../../composables/group/useGroupTree.ts'
import { useMoveTargetPolicy } from '../../composables/group/useMoveTargetPolicy.ts'
import { useTranslations } from '../../composables/message/useTranslations.ts'
import { confirm } from '../../utils/confirm'
import { Button } from '../ui/button/index.ts'
import { Input } from '../ui/input/index.ts'
import { Textarea } from '../ui/textarea/index.ts'
import WorkspaceGroupSelectMenu from './WorkspaceGroupSelectMenu.vue'

const { localeConfig } = useLocaleConfig()
const { tree } = useGroupTree()
const { toggleExpanded, select, selectedNode, moveItems, removeItems, createGroup, createMessage } = useTranslations()
const { renameKey, renameTitle, setTranslation } = useItemEditor()
const draftKey = ref('')

watch(() => selectedNode.value?.id, () => {
  draftKey.value = selectedNode.value?.original.key ?? ''
}, { immediate: true })
const blockedSourceIds = computed(() =>
  selectedNode.value ? [selectedNode.value.id] : [],
)
const { blockedIds } = useMoveTargetPolicy(blockedSourceIds)
// 除了默认语言，语言的翻译
const translationLanguages = computed(() =>
  localeConfig.value.locales.filter(
    item => item.code !== localeConfig.value.defaultLocale,
  ),
)
const canCreateGroup = computed(
  () =>
    selectedNode.value?.original.type !== 'message'
    && Boolean(selectedNode.value),
)

async function handleAddGroup() {
  const current = selectedNode.value
  if (!current || current.original.type === 'message') {
    return
  }

  const nextItem = await createGroup(current.id)
  if (!nextItem) {
    return
  }

  toggleExpanded(current.id, true)
  select(nextItem.id)
}

async function handleAddMessage() {
  const current = selectedNode.value
  if (!current) {
    return
  }

  const nextItem = await createMessage(current.id)
  if (!nextItem) {
    return
  }

  if (nextItem.parent) {
    toggleExpanded(nextItem.parent, true)
  }
  select(nextItem.id)
}

async function handleMove(target: LocaleTreeGroupNode) {
  const current = selectedNode.value
  if (!current) {
    return
  }

  await moveItems([current.id], target.id)
}

async function handleDelete() {
  const current = selectedNode.value
  if (!current) {
    return
  }

  const ok = await confirm({
    title: '确定删除当前记录吗？',
    description: '删除后会移入最近删除。',
    confirmText: '删除',
    confirmVariant: 'destructive',
  })
  if (!ok)
    return

  await removeItems([current.id])
}

async function commitSelectedKey() {
  const node = selectedNode.value
  if (!node) {
    return
  }

  const nextKey = String(draftKey.value ?? '')
  if (nextKey === String(node.original.key ?? '')) {
    return
  }

  await renameKey(node.id, nextKey)
}

function updateSelectedTitle(value: string | number) {
  const item = selectedNode.value?.original

  if (!item || item.type === 'message') {
    return
  }

  renameTitle(item.id, String(value))
}

function updateTranslation(locale: string, value: string | number) {
  const item = selectedNode.value?.original

  if (!item || item.type !== 'message') {
    return
  }

  setTranslation(item.id, locale, String(value))
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    {{ selectedNode }}
    <div
      class="size-full max-w-5xl mx-auto flex flex-col gap-4 p-4 opacity-0 transition-opacity duration-400"
      :class="selectedNode?.id && 'opacity-100'"
    >
      <ElemField legend="操作">
        <div class="flex flex-wrap gap-2">
          <template v-if="canCreateGroup">
            <Button
              variant="secondary"
              class="font-normal text-xs"
              size="sm"
              @click="handleAddGroup"
            >
              <FolderPlus class="size-3.5" />
              新建分组
            </Button>
            <Button
              variant="secondary"
              class="font-normal text-xs"
              size="sm"
              :disabled="!selectedNode"
              @click="handleAddMessage"
            >
              <Plus class="size-3.5" />
              新建消息
            </Button>
          </template>
          <WorkspaceGroupSelectMenu
            label="移动到"
            :tree="tree.roots"
            :blocked-ids="blockedIds"
            expansion-scope="move"
            @select="handleMove"
          >
            <template #default="{ disabled }">
              <Button
                variant="secondary"
                class="font-normal text-xs"
                size="sm"
                :disabled="disabled || !selectedNode"
              >
                <FolderInput class="size-3.5" />
                移动到
              </Button>
            </template>
          </WorkspaceGroupSelectMenu>
          <Button
            variant="secondary"
            class="font-normal text-xs"
            size="sm"
            :disabled="!selectedNode"
            @click="handleDelete"
          >
            <Trash2 class="size-3.5" />
            删除
          </Button>
        </div>
      </ElemField>
      <ElemField legend="Key(开发使用)">
        <template #extra>
          {{ selectedNode?.meta.keyChain.join(".") }}
          <!-- 分割符 -->
          <CopyButton
            class="size-3.5"
            separator="."
            :content="selectedNode?.meta.keyChain"
          />
        </template>
        <Input
          v-model="draftKey"
          placeholder="请输入"
          @blur="commitSelectedKey"
        />
      </ElemField>
      <ElemField
        v-if="selectedNode?.type !== 'message'"
        :legend="selectedNode?.type === 'group' ? '分组名称' : '命名空间名称'"
      >
        <Input
          :model-value="
            selectedNode?.original.type !== 'message'
              ? selectedNode?.original.title
              : ''
          "
          placeholder="请输入"
          @update:model-value="updateSelectedTitle"
        />
      </ElemField>
      <template v-else>
        <ElemField
          v-if="localeConfig.defaultLocaleConfig"
          :legend="localeConfig.defaultLocaleConfig.label"
        >
          <Textarea
            class="field-sizing-content min-h-8 max-h-60 resize-none"
            :model-value="
              get(
                selectedNode,
                [
                  'original',
                  'translations',
                  localeConfig.defaultLocaleConfig.code,
                ],
                '',
              )
            "
            placeholder="请输入"
            @update:model-value="
              updateTranslation(localeConfig.defaultLocaleConfig.code, $event)
            "
          />
        </ElemField>
        <ElemField
          v-for="locale in translationLanguages"
          :key="locale.code"
          :legend="locale.label"
        >
          <Textarea
            class="field-sizing-content min-h-8 max-h-60 resize-none"
            :model-value="
              get(selectedNode, ['original', 'translations', locale.code], '')
            "
            placeholder="请输入"
            @update:model-value="updateTranslation(locale.code, $event)"
          />
        </ElemField>
      </template>
    </div>
  </div>
</template>
