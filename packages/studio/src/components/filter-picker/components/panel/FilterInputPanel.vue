<script setup lang="ts">
import type { FilterPickerInput } from '../../types'
import { CornerDownLeft, Edit } from '@lucide/vue'

const props = withDefaults(defineProps<{
  schema: FilterPickerInput
  modelValue?: string
  labelAsAddon?: boolean
}>(), {
  modelValue: '',
  labelAsAddon: false,
})

const emits = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'commit'): void
}>()
</script>

<template>
  <InputGroup>
    <InputGroupAddon>
      <span
        v-if="props.labelAsAddon"
        class="text-muted-foreground font-normal"
      >
        {{ props.schema.label }}
      </span>
      <component
        :is="props.schema.addonIcon || Edit "
        v-else
      />
    </InputGroupAddon>
    <InputGroupInput
      :model-value="props.modelValue"
      :placeholder="props.schema.placeholder"
      @update:model-value="emits('update:modelValue', String($event ?? ''))"
      @keydown.enter="emits('commit')"
    />
    <InputGroupAddon
      align="inline-end"
      @click="emits('commit')"
    >
      <CornerDownLeft />
    </InputGroupAddon>
  </InputGroup>
</template>
