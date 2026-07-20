import type { Component } from 'vue'
import { FilterPickerType } from '../../types'
import FilterCheckboxPanel from './FilterCheckboxPanel.vue'
import FilterInputPanel from './FilterInputPanel.vue'
import FilterNumberPanel from './FilterNumberPanel.vue'
import FilterSelectPanel from './FilterSelectPanel.vue'
import FilterTagsPanel from './FilterTagsPanel.vue'

/** DraftEditor 中不同面板对应的 model 适配键。 */
export type FilterPickerPanelModelKey
  = | 'inputValue'
    | 'numberValue'
    | 'selectValue'
    | 'checkboxValue'
    | 'tagsValue'

/** DraftEditor 面板分发配置。 */
export interface FilterPickerPanelDistributionItem {
  component: Component
  model: FilterPickerPanelModelKey
  commitOnChange?: boolean
  pinnedInline?: boolean
}

/** 各类型字段到具体编辑面板的分发关系。 */
export const filterPickerPanelDistribution = {
  [FilterPickerType.INPUT]: {
    component: FilterInputPanel,
    model: 'inputValue',
    commitOnChange: true,
    pinnedInline: true,
  },
  [FilterPickerType.NUMBER]: {
    component: FilterNumberPanel,
    model: 'numberValue',
    commitOnChange: true,
  },
  [FilterPickerType.SELECT]: {
    component: FilterSelectPanel,
    model: 'selectValue',
    commitOnChange: true,
  },
  [FilterPickerType.CHECKBOX]: {
    component: FilterCheckboxPanel,
    model: 'checkboxValue',
    commitOnChange: true,
  },
  [FilterPickerType.TAGS]: {
    component: FilterTagsPanel,
    model: 'tagsValue',
  },
} as const satisfies Partial<Record<FilterPickerType, FilterPickerPanelDistributionItem>>

/** 解析当前字段类型对应的编辑面板配置。 */
export function resolveFilterPickerPanel(
  type?: FilterPickerType,
): FilterPickerPanelDistributionItem | undefined {
  return type == null ? undefined : filterPickerPanelDistribution[type]
}

/** 当前类型在 pinned 区域是否应以内联面板方式渲染。 */
export function isFilterPickerPinnedInlinePanel(type?: FilterPickerType): boolean {
  return resolveFilterPickerPanel(type)?.pinnedInline === true
}
