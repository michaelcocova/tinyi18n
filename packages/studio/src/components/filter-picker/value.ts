import type {
  FilterPickerItem,
  FilterPickerOptionValue,
} from './types'
import { FilterPickerType } from './types'

/** 判断单个值是否可作为 select 类型的取值。 */
export function isOptionValue(value: unknown): value is FilterPickerOptionValue {
  return ['string', 'number', 'boolean', 'symbol'].includes(typeof value)
}

/** 判断数组值是否可作为 checkbox 类型的取值。 */
export function isOptionValueList(value: unknown): value is FilterPickerOptionValue[] {
  return Array.isArray(value) && value.every(item => isOptionValue(item))
}

export function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

/** 判断某个字段的值在当前形状下是否应视为已激活条件。 */
export function isActiveFilterPickerValue(item: FilterPickerItem, value: unknown) {
  switch (item.type) {
    case FilterPickerType.INPUT:
      return typeof value === 'string' && value.trim().length > 0
    case FilterPickerType.NUMBER:
      return typeof value === 'number' && !Number.isNaN(value)
    case FilterPickerType.CHECKBOX:
      return Array.isArray(value) && value.length > 0
    case FilterPickerType.TAGS:
      return isStringList(value) && value.length > 0
    default:
      return value != null
  }
}

/** 对新增类型执行内建值形状校验，避免无规则时提交非法结构。 */
export function validateFilterPickerValueShape(item: FilterPickerItem, value: unknown): string | undefined {
  switch (item.type) {
    case FilterPickerType.INPUT:
      return typeof value === 'string' && value.trim().length > 0 ? undefined : '请输入内容'
    case FilterPickerType.NUMBER:
      return typeof value === 'number' && !Number.isNaN(value) ? undefined : '请输入有效数字'
    case FilterPickerType.SELECT:
      return isOptionValue(value) ? undefined : '请选择有效选项'
    case FilterPickerType.CHECKBOX:
      if (!isOptionValueList(value)) {
        return '请选择有效选项'
      }
      return value.length > 0 ? undefined : '请至少选择一项'
    case FilterPickerType.TAGS:
      if (!isStringList(value)) {
        return '请输入有效标签'
      }
      return value.length > 0 ? undefined : '请至少输入一项'
  }
}
