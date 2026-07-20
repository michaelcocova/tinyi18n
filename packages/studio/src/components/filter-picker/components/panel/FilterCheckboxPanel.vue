<script setup lang="ts">
import type { FilterPickerCheckbox, FilterPickerOptionValue } from '../../types'
import { Check } from '@lucide/vue'
import { useResolvedFilterPickerOptions } from '../../composables/useResolvedFilterPickerOptions'

const props = withDefaults(defineProps<{
  schema: FilterPickerCheckbox
  modelValue?: FilterPickerOptionValue[]
}>(), {
  modelValue: () => [],
})

const emits = defineEmits<{
  (e: 'update:modelValue', value: FilterPickerOptionValue[]): void
  (e: 'commit'): void
}>()

const { options } = useResolvedFilterPickerOptions(props.schema)

function isSelected(value: FilterPickerOptionValue) {
  return props.modelValue.includes(value)
}

function toggleValue(value: FilterPickerOptionValue) {
  if (isSelected(value)) {
    emits('update:modelValue', props.modelValue.filter(item => item !== value))
    emits('commit')
    return
  }

  emits('update:modelValue', [...props.modelValue, value])
  emits('commit')
}
</script>

<template>
  <Command>
    <CommandInput :placeholder="props.schema.placeholder || props.schema.label" />
    <CommandList>
      <CommandGroup>
        <CommandEmpty>暂无可选项</CommandEmpty>
        <CommandItem
          v-for="option in options"
          :key="String(option.value)"
          :value="String(option.label)"
          class="justify-between"
          @select="toggleValue(option.value)"
        >
          <span>{{ option.label }}</span>
          <Check v-if="isSelected(option.value)" />
        </CommandItem>
      </CommandGroup>
      <CommandGroup>
        <Button
          v-if="modelValue.length"
          size="sm"
          variant="link"
        >
          清空
        </Button>
        <Button
          size="sm"
          class="ml-auto"
          variant="ghost"
        >
          取消
        </Button>
        <Button
          size="sm"
          variant="secondary"
        >
          确认
        </Button>
      </CommandGroup>
    </CommandList>
  </Command>
</template>
