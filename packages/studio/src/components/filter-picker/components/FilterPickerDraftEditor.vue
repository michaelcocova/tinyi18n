<script setup lang="ts">
import type { FilterPickerOptionValue } from '../types'
import type { FilterPickerPanelModelKey } from './panel/distribution'
import { computed } from 'vue'
import { useFilterPickerControls } from '../composables/useFilterPickerControls'
import { isOptionValue, isOptionValueList, isStringList } from '../value'
import { resolveFilterPickerPanel } from './panel/distribution'

const { draft, commit, updateValue } = useFilterPickerControls()

type FilterPickerPanelModelValue
  = | string
    | number
    | FilterPickerOptionValue
    | FilterPickerOptionValue[]
    | string[]
    | undefined

/**
 * 将统一的 draft.value 适配为各个 value-input 组件各自的 v-model 形状。
 * 这样底层输入组件可以保持简单，只关心自己对应类型的值。
 */
const inputValue = computed<string>({
  get: () => typeof draft.value?.value === 'string' ? draft.value.value : '',
  set: value => updateValue(value),
})

/** number 类型输入的适配值。 */
const numberValue = computed<number | undefined>({
  get: () => typeof draft.value?.value === 'number' ? draft.value.value : undefined,
  set: value => updateValue(value),
})

/** select 类型输入的适配值。 */
const selectValue = computed<FilterPickerOptionValue | undefined>({
  get: () => isOptionValue(draft.value?.value) ? draft.value.value : undefined,
  set: value => updateValue(value),
})

/** checkbox 类型输入的适配值。 */
const checkboxValue = computed<FilterPickerOptionValue[]>({
  get: () => isOptionValueList(draft.value?.value) ? draft.value.value : [],
  set: value => updateValue(value),
})

const tagsValue = computed<string[]>({
  get: () => isStringList(draft.value?.value) ? draft.value.value : [],
  set: value => updateValue(value),
})

/** 当前字段对应的面板分发配置。 */
const currentPanel = computed(() => resolveFilterPickerPanel(draft.value?.item.type))
/** 当前面板统一消费的 schema。 */
const currentSchema = computed(() => draft.value?.item)
/** 当前面板是否需要在内部交互后立刻提交。 */
const currentPanelListeners = computed(() => currentPanel.value?.commitOnChange ? { commit } : undefined)

/** 根据分发表读取当前面板对应的 modelValue。 */
function getPanelModelValue(model: FilterPickerPanelModelKey): FilterPickerPanelModelValue {
  switch (model) {
    case 'inputValue':
      return inputValue.value
    case 'numberValue':
      return numberValue.value
    case 'selectValue':
      return selectValue.value
    case 'checkboxValue':
      return checkboxValue.value
    case 'tagsValue':
      return tagsValue.value
  }
}

/** 当前动态面板的统一 modelValue。 */
const currentPanelModelValue = computed<FilterPickerPanelModelValue>(() => {
  const model = currentPanel.value?.model
  return model == null ? undefined : getPanelModelValue(model)
})

/** 将动态面板的更新值分发回对应的适配 model。 */
function handlePanelModelValueUpdate(value: FilterPickerPanelModelValue) {
  switch (currentPanel.value?.model) {
    case 'inputValue':
      inputValue.value = typeof value === 'string' ? value : ''
      return
    case 'numberValue':
      numberValue.value = typeof value === 'number' ? value : undefined
      return
    case 'selectValue':
      selectValue.value = isOptionValue(value) ? value : undefined
      return
    case 'checkboxValue':
      checkboxValue.value = isOptionValueList(value) ? value : []
      return
    case 'tagsValue':
      tagsValue.value = isStringList(value) ? value : []
  }
}
</script>

<template>
  <component
    :is="currentPanel?.component"
    v-if="currentPanel != null && currentSchema != null"
    :model-value="currentPanelModelValue"
    :schema="currentSchema"
    v-on="currentPanelListeners"
    @update:model-value="handlePanelModelValueUpdate"
  />
  <p
    v-if="draft?.error"
    class="text-xs text-destructive"
  >
    {{ draft.error }}
  </p>
</template>
