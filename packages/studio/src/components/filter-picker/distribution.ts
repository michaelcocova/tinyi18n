import type { VNode } from 'vue'
import type { FilterPickerSelectedItem } from './types'

/** condition 插槽默认透传参数。 */
export interface FilterPickerConditionSlotProps {
  open: boolean
  condition: FilterPickerSelectedItem
  remove: (field: string) => void
}

/** condition 标题插槽透传参数。 */
export interface FilterPickerConditionLabelSlotProps {
  condition: FilterPickerSelectedItem
}

/** 单个 Condition 组件支持的插槽。 */
export interface FilterPickerConditionSlots {
  condition: (props: FilterPickerConditionSlotProps) => VNode
  label: (props: FilterPickerConditionLabelSlotProps) => VNode
  separator: () => VNode
  remove: (props: FilterPickerConditionSlotProps) => VNode
}

/** 菜单触发器支持的插槽。 */
export interface FilterPickerMenuSlots {
  trigger: () => VNode
  triggerIcon: () => VNode
}

/** 顶层 FilterPicker 暴露给用户的插槽。 */
export interface FilterPickerSlots extends FilterPickerMenuSlots, FilterPickerConditionSlots {
  default: () => VNode
  head: () => VNode
  center: () => VNode
  tail: () => VNode
}
