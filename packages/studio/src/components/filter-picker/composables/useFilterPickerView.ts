import type { Ref } from 'vue'
import type { FilterPickerProps, Recordable } from '../types'
import { computed } from 'vue'
import { useFilterPicker, useProvideFilterPickerStore } from './useFilterPicker'
import { useProvideFilterPickerControls } from './useFilterPickerControls'

/**
 * 提供 FilterPicker 顶层视图所需的聚合状态。
 * 将 pinned/clear 之类的展示逻辑从入口组件中抽离，保持顶层模板轻量。
 * @param props 组件完整属性
 * @param modelValue 对外双向绑定值
 */
export function useFilterPickerView(
  props: FilterPickerProps,
  modelValue: Ref<Recordable | undefined>,
) {
  /** 在视图层初始化 store，供后续子 composables 共享配置与缓存。 */
  useProvideFilterPickerStore(computed(() => props))

  /** 过滤器实例 */
  const filterPicker = useFilterPicker()
  /** 控制器 */
  const controls = useProvideFilterPickerControls(modelValue)
  /** 视图层直接消费的控制器状态。 */
  const { clear: clearConditions, conditions, draft, isFieldSelected } = controls

  /** pinned 字段集合，便于快速判断某个字段是否属于固定入口。 */
  const pinnedFields = computed(() => new Set(props.pinned ?? []))
  /** 固定展示字段，对应空值态和有值态的入口渲染。 */
  const pinnedItems = computed(() => props.items.filter(item => pinnedFields.value.has(item.field)))
  /** 常规条件列表，会自动排除 pinned 字段。 */
  const normalConditions = computed(() => (
    conditions.value.filter(condition => !pinnedFields.value.has(condition.field))
  ))
  /** 当前是否存在有效筛选条件。 */
  const hasActiveFilters = computed(() => conditions.value.length > 0)
  /** 清空按钮是否应该显示；开启常驻后即使无条件也会保留入口。 */
  const showClearButton = computed(() => props.clearPersistent || hasActiveFilters.value)
  /** 清空按钮最终属性，额外根据当前是否存在有效筛选值控制禁用态。 */
  const resolvedClearButtonProps = computed(() => ({
    ...filterPicker.resolvedClearButtonProps.value,
    disabled: !hasActiveFilters.value,
  }))

  return {
    conditions,
    draft,
    isFieldSelected,
    clearConditions,
    pinnedItems,
    normalConditions,
    showClearButton,
    resolvedClearButtonProps,
    resolvedClearIcon: filterPicker.resolvedClearIcon,
    resolvedClearText: filterPicker.resolvedClearText,
  }
}
