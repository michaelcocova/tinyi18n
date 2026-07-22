<script setup lang="ts">
import type { MessageTreeNode } from '@/composables/workspace/useMessageTree'
import { Languages } from '@lucide/vue'
import { get } from 'lodash-es'
import { useAssembleMessages } from '@/composables/workspace/useAssemblyMessages'
import { useTranslationEditor } from '@/composables/workspace/useTranslationEditor'

const props = defineProps<{
  node?: MessageTreeNode
}>()

const { locales } = useAssembleMessages()
const { updateTranslation, updateKey, save } = useTranslationEditor()

function onTranslationInput(locale: string, value: string) {
  updateTranslation(props.node.id, locale, value)
  save()
}

function onKeyInput(newKeySegment: string) {
  // namespace 的 key 不可编辑
  if (props.node?.original?.type === 1 && !props.node?.original?.parent)
    return
  updateKey(props?.node.id, newKeySegment)
  save()
}
</script>

<template>
  <div class="h-full overflow-auto p-6 mx-auto w-full max-w-7xl">
    <div
      v-if="!node?.id"
      class="text-sm text-zinc-400"
    >
      请选择一个节点
    </div>
    <template v-else>
      <InputGroup class="rounded-0 border-0 shadow-none rounded-none">
        <InputGroupInput
          id="textarea-code-key"
          placeholder="请输入 key"
          :model-value="get(node, ['original', 'key'], '')"
          :readonly="node.original?.type === 1 && !node.original?.parent"
          class="flex min-h-8 bg-accent rounded-md py-2"
          @update:model-value="onKeyInput($event)"
        />
        <InputGroupAddon
          align="block-start"
          class="pt-0!"
        >
          <InputGroupText class="text-xs font-mono font-medium">
            <Languages class="size-3.5" />
            <span class="uppercase">Key</span>
          </InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <div v-if="node.original?.type === 2">
        <div class="border-b border-dashed pb-5 mb-5" />
        <h2 class="text-sm font-semibold text-zinc-800 mb-2">
          Translations
        </h2>
        <div class="space-y-6">
          <InputGroup
            v-for="locale in locales"
            :key="locale"
            class="rounded-0 border-0 shadow-none"
          >
            <InputGroupTextarea
              :id="`textarea-code-${locale}`"
              placeholder="请输入翻译"
              :model-value="get(node, ['original', 'translations', locale], '')"
              class="flex field-sizing-content min-h-8 w-full resize-none bg-accent rounded-md py-2"
              @update:model-value="onTranslationInput(locale, $event)"
            />
            <InputGroupAddon
              align="block-start"
              class="pt-0!"
            >
              <InputGroupText class="text-xs font-mono font-medium">
                <Languages class="size-3.5" />
                <span class="uppercase">{{ locale }}</span>
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </template>
  </div>
</template>
