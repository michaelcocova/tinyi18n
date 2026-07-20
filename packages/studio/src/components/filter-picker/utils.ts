import type { FilterPickerOption } from './types'

/**
 * 获取 Options 中 value = 传入值的 label
 * @param value 值
 * @param options
 * @param defaultValue
 */
export function findOptionLabel<T = any>(
  value: T,
  options: MaybeRefOrGetter<FilterPickerOption[]>,
  defaultValue: string = '-',
): string {
  return (
    toValue(options)?.find(item => String(item.value) === String(value))?.label || defaultValue
  )
}
