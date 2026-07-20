<script setup lang="ts">
import type { FilterPickerNumber } from '../../../types'
import { CornerDownLeft, Hash } from '@lucide/vue'

const props = withDefaults(defineProps<{
  schema: FilterPickerNumber
  modelValue?: number
}>(), {
  modelValue: undefined,
})

const emits = defineEmits<{
  (e: 'update:modelValue', value: number | undefined): void
  (e: 'commit'): void
}>()

function handleUpdate(value: string | number) {
  const nextValue = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(nextValue)) {
    emits('update:modelValue', undefined)
    return
  }

  emits('update:modelValue', nextValue)
}
</script>

<template>
  <InputGroup>
    <InputGroupAddon>
      <Hash />
    </InputGroupAddon>
    <InputGroupInput
      type="number"
      :model-value="props.modelValue"
      :placeholder="props.schema.placeholder"
      @update:model-value="handleUpdate"
      @keydown.enter="emits('commit')"
    />
    <InputGroupAddon align="inline-end" @click="emits('commit')">
      <CornerDownLeft />
    </InputGroupAddon>
  </InputGroup>
</template>
