<script setup lang="ts">
import type { FilterPickerOptionValue, FilterPickerSelect } from '../../types'
import { Check } from '@lucide/vue'
import { useResolvedFilterPickerOptions } from '../../composables/useResolvedFilterPickerOptions'

const props = defineProps<{
  schema: FilterPickerSelect
  modelValue?: FilterPickerOptionValue
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', value: FilterPickerOptionValue | undefined): void
  (e: 'commit'): void
}>()

const { options } = useResolvedFilterPickerOptions(props.schema)

function isSelected(value: FilterPickerOptionValue) {
  return props.modelValue === value
}
function onSelect(value: FilterPickerOptionValue) {
  emits('update:modelValue', value)
  emits('commit')
}
</script>

<template>
  <Command class="p-0">
    <CommandInput :placeholder="props.schema.placeholder || props.schema.label" />
    <CommandList>
      <CommandGroup>
        <CommandEmpty>暂无可选项</CommandEmpty>
        <CommandItem
          v-for="option in options"
          :key="String(option.value)"
          :value="String(option.label)"
          class="justify-between"
          @select="onSelect(option.value)"
        >
          <span>{{ option.label }}</span>
          <Check v-if="isSelected(option.value)" />
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
</template>
