import type {
  FilterPickerConfig,
  FilterPickerItem,
  Recordable,
  UserConfig,
} from './types'

function generatedId() {
  const random = Math.random().toString(36).substring(2)
  return ['filter-picker', random].join(':')
}

export function defineFilterPicker<
  const TModelValue extends Recordable = Recordable,
  const TItems extends readonly FilterPickerItem<TModelValue>[] = readonly FilterPickerItem<TModelValue>[],
>(
  config: UserConfig<TModelValue, TItems>,
): FilterPickerConfig<TModelValue, TItems> {
  return {
    // 标识
    id: generatedId(),
    ...config,
  }
}
