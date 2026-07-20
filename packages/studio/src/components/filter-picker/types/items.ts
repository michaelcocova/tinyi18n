import type {
  FilterPickerField,
  FilterPickerIcon,
  FilterPickerOptionValue,
  FilterPickerStaticOptions,
  FilterPickerType,
  Recordable,
} from './base'

/** 基础过滤器项 */
interface FilterPickerBasic<TModelValue extends Recordable = Recordable> {
  /** 图标 */
  icon?: FilterPickerIcon
  /** 字段 */
  field: FilterPickerField<TModelValue>
  /** 标题 */
  label: string
  /** 类型 */
  type: FilterPickerType
  /** 分组（可选，用于组织过滤器） */
  group?: string
  /** 占位符 */
  placeholder?: string
}

/** 过滤器项 —— 输入框 */
export interface FilterPickerInput<TModelValue extends Recordable = Recordable> extends FilterPickerBasic<TModelValue> {
  type: typeof FilterPickerType.INPUT
  /** 前置图标 */
  addonIcon?: FilterPickerIcon
}

/** 过滤器项 —— 数字选择 */
export interface FilterPickerNumber<TModelValue extends Recordable = Recordable> extends FilterPickerBasic<TModelValue> {
  type: typeof FilterPickerType.NUMBER
}

/** 过滤器项 —— 下拉选择 */
export interface FilterPickerSelect<TModelValue extends Recordable = Recordable> extends FilterPickerBasic<TModelValue> {
  type: typeof FilterPickerType.SELECT
  /** 静态可选项 */
  options?: FilterPickerStaticOptions
}

/** 过滤器项 —— 多选 */
export interface FilterPickerCheckbox<TModelValue extends Recordable = Recordable> extends FilterPickerBasic<TModelValue> {
  type: typeof FilterPickerType.CHECKBOX
  /** 静态可选项 */
  options?: FilterPickerStaticOptions
}

/** 过滤器项 —— 标签输入 */
export interface FilterPickerTags<TModelValue extends Recordable = Recordable> extends FilterPickerBasic<TModelValue> {
  type: typeof FilterPickerType.TAGS
}

/** 带可选项的过滤器项 */
export type FilterPickerOptionItem<TModelValue extends Recordable = Recordable>
  = FilterPickerSelect<TModelValue> | FilterPickerCheckbox<TModelValue>

/** 过滤器项 */
export type FilterPickerItem<TModelValue extends Recordable = Recordable>
  = | FilterPickerInput<TModelValue>
    | FilterPickerNumber<TModelValue>
    | FilterPickerSelect<TModelValue>
    | FilterPickerCheckbox<TModelValue>
    | FilterPickerTags<TModelValue>

/** 根据单个 item 推导其对外值类型。 */
export type InferFilterPickerExternalValue<TItem extends FilterPickerItem = FilterPickerItem>
  = TItem extends FilterPickerInput ? string
    : TItem extends FilterPickerNumber ? number
      : TItem extends FilterPickerSelect ? FilterPickerOptionValue
        : TItem extends FilterPickerCheckbox ? FilterPickerOptionValue[]
          : TItem extends FilterPickerTags ? string[]
            : unknown

/** 根据 items 推导对外 modelValue 形状。 */
export type InferFilterPickerExternalModel<TItems extends readonly FilterPickerItem[]> = {
  [TItem in TItems[number] as TItem['field']]: InferFilterPickerExternalValue<TItem>
}

/** 常见的可选对外 modelValue 形状。 */
export type InferFilterPickerExternalPartialModel<TItems extends readonly FilterPickerItem[]>
  = Partial<InferFilterPickerExternalModel<TItems>>
