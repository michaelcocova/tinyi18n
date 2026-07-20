<script setup lang="ts">
import { TagsInput, TagsInputInput, TagsInputItem, TagsInputItemDelete, TagsInputItemText } from '@/components/ui/tags-input'

defineProps<{
  schema?: {
    label?: string
    placeholder?: string
  }
  modelValue?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()
</script>

<template>
  <div class="w-80 p-3">
    <TagsInput
      :model-value="modelValue ?? []"
      @update:model-value="emit('update:modelValue', $event.map(item => String(item)))"
    >
      <TagsInputItem
        v-for="item in modelValue ?? []"
        :key="item"
        :value="item"
      >
        <TagsInputItemText />
        <TagsInputItemDelete />
      </TagsInputItem>
      <TagsInputInput :placeholder="schema?.placeholder || '输入后回车'" />
    </TagsInput>
    <p class="mt-2 text-xs text-muted-foreground">
      输入路径后按回车添加
    </p>
  </div>
</template>
