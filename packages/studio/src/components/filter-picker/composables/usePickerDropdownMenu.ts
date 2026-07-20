import type { MaybeRefOrGetter } from 'vue'
import type { FilterPickerItem } from '../types'
import { computed, toValue } from 'vue'
import { useFilterPicker } from './useFilterPicker'
import { useFilterPickerControls } from './useFilterPickerControls'

/** 下拉菜单分组。顺序保持与原始 items 一致。 */
export interface FilterPickerMenuSection {
  key: string
  group?: string
  items: FilterPickerItem[]
}

export interface UsePickerDropdownMenuOptions {
  /** 过滤掉已加入的字段 */
  excludedFields?: MaybeRefOrGetter<string[]>
}
/**
 * 构建 FilterPicker 下拉菜单数据。
 * 会自动过滤掉已添加条件，并按原始 items 顺序组织分组。
 */
export function usePickerDropdownMenu(options: UsePickerDropdownMenuOptions = {}) {
  /** 过滤器 store，提供配置与共享解析能力。 */
  const filterPicker = useFilterPicker()
  /** 控制器，负责已选条件与禁用/可见规则判断。 */
  const { conditions, begin, isItemDisabled, isItemVisible } = useFilterPickerControls()

  /** 原始字段列表，保持与配置中的定义顺序一致。 */
  const items = computed(() => filterPicker.config.value.items)

  /**
   * 当前可进入下拉菜单的字段。
   * 会排除 pinned、已选条件，以及外部显式指定的 excludedFields。
   */
  const availableItems = computed(() => {
    const excludedFields = new Set([
      ...(filterPicker.config.value.pinned ?? []),
      ...conditions.value.map(item => item.field),
      ...(toValue(options.excludedFields) ?? []),
    ])

    return items.value.filter(item => !excludedFields.has(item.field) && isItemVisible(item))
  })

  /**
   * 按 group 对可选字段进行分段，供菜单模板直接渲染。
   */
  const menuSections = computed<FilterPickerMenuSection[]>(() => {
    const sections: FilterPickerMenuSection[] = []
    const grouped = new Map<string, FilterPickerMenuSection>()

    for (const item of availableItems.value) {
      if (item.group == null || item.group === '') {
        sections.push({
          key: item.field,
          items: [item],
        })
        continue
      }

      const section = grouped.get(item.group)
      if (section != null) {
        section.items.push(item)
        continue
      }

      const groupSection: FilterPickerMenuSection = {
        key: item.group,
        group: item.group,
        items: [item],
      }

      grouped.set(item.group, groupSection)
      sections.push(groupSection)
    }

    return sections
  })

  /**
   * 选择某个字段进入编辑态。
   * 若字段当前被禁用，则直接忽略本次选择。
   */
  function selectItem(item: FilterPickerItem) {
    if (isItemDisabled(item)) {
      return
    }

    begin(item)
  }

  return {
    availableItems,
    menuSections,
    isItemVisible,
    isItemDisabled,
    selectItem,
  }
}
