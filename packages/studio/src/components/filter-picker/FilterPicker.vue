<script setup lang="ts">
import type { FilterPickerSlots } from './distribution'
import type { FilterPickerProps, Recordable } from './types'
import FilterPickerCondition from './components/FilterPickerCondition.vue'
import FilterPickerMenu from './components/FilterPickerMenu.vue'
import FilterPickerPinnedField from './components/FilterPickerPinnedField.vue'
import { useFilterPickerView } from './composables/useFilterPickerView'

const props = withDefaults(defineProps<FilterPickerProps>(), {
  items: () => [],
})

defineSlots<FilterPickerSlots>()

const modelValue = defineModel<Recordable>()

const {
  clearConditions,
  normalConditions,
  pinnedItems,
  resolvedClearButtonProps,
  resolvedClearIcon,
  resolvedClearText,
  showClearButton,
} = useFilterPickerView(props, modelValue)
</script>

<template>
  <div
    data-filter="picker"
    class="flex items-center flex-wrap gap-2"
  >
    <slot name="head" />
    <FilterPickerPinnedField
      v-for="item in pinnedItems"
      :key="item.field"
      :item="item"
    >
      <template
        v-if="$slots.condition"
        #condition="slotProps"
      >
        <slot
          name="condition"
          v-bind="slotProps"
        />
      </template>
      <template
        v-if="$slots.label"
        #label="slotProps"
      >
        <slot
          name="label"
          v-bind="slotProps"
        />
      </template>
      <template
        v-if="$slots.separator"
        #separator
      >
        <slot name="separator" />
      </template>
      <template
        v-if="$slots.remove"
        #remove="slotProps"
      >
        <slot
          name="remove"
          v-bind="slotProps"
        />
      </template>
    </FilterPickerPinnedField>

    <FilterPickerCondition
      v-for="condition in normalConditions"
      :key="condition.field"
      :condition="condition"
    >
      <template
        v-if="$slots.condition"
        #condition="slotProps"
      >
        <slot
          name="condition"
          v-bind="slotProps"
        />
      </template>
      <template
        v-if="$slots.label"
        #label="slotProps"
      >
        <slot
          name="label"
          v-bind="slotProps"
        />
      </template>
      <template
        v-if="$slots.separator"
        #separator
      >
        <slot name="separator" />
      </template>
      <template
        v-if="$slots.remove"
        #remove="slotProps"
      >
        <slot
          name="remove"
          v-bind="slotProps"
        />
      </template>
    </FilterPickerCondition>
    <slot name="center" />
    <FilterPickerMenu
      :trigger-text="props.triggerText"
      :trigger-icon="props.triggerIcon"
      :hide-trigger-text="props.hideTriggerText"
      :trigger-button-props="props.triggerButtonProps"
    >
      <template
        v-if="$slots.trigger"
        #trigger
      >
        <slot name="trigger" />
      </template>
      <template
        v-if="$slots.triggerIcon"
        #triggerIcon
      >
        <slot name="triggerIcon" />
      </template>
    </FilterPickerMenu>
    <Button
      v-if="showClearButton"
      v-bind="resolvedClearButtonProps"
      @click="clearConditions()"
    >
      <component :is="resolvedClearIcon" />
      {{ resolvedClearText }}
    </Button>
    <slot name="tail" />
  </div>
</template>
