import type { ZodType } from 'zod'
import type { FilterPickerField, FilterPickerIcon, FilterPickerOption, FilterPickerOptionValue, MaybeAsyncGetter, Recordable } from './base'
import type { FilterPickerItem } from './items'
import type { ButtonProps } from '@/components/ui/button'

/** 字段规则布尔判断。 */
export type FilterPickerRulePredicate<TModelValue extends Recordable = Recordable>
  = (values: Partial<TModelValue>, conditions: Partial<TModelValue>) => boolean

/** 字段规则值解析。 */
export type FilterPickerRuleResolver<TResult, TModelValue extends Recordable = Recordable>
  = (values: Partial<TModelValue>, conditions: Partial<TModelValue>) => TResult

/** 字段规则禁用判断。 */
export type FilterPickerRuleDisabled<TModelValue extends Recordable = Recordable>
  = boolean | FilterPickerRulePredicate<TModelValue>

/** 字段规则可见判断。 */
export type FilterPickerRuleVisible<TModelValue extends Recordable = Recordable>
  = boolean | FilterPickerRulePredicate<TModelValue>

/** 字段规则默认值。 */
export type FilterPickerRuleDefaultValue<
  TValue = unknown,
  TModelValue extends Recordable = Recordable,
> = TValue | ((values: Partial<TModelValue>, conditions: Partial<TModelValue>) => TValue)

/** 字段规则值规范化。 */
export type FilterPickerRuleNormalize<
  TValue = unknown,
  TModelValue extends Recordable = Recordable,
> = (value: TValue, values: Partial<TModelValue>, conditions: Partial<TModelValue>) => TValue

/** 动态 options 的缓存 key。 */
export type FilterPickerRuleOptionsKey = FilterPickerOptionValue | null | undefined

/** 字段动态选项配置。 */
export interface FilterPickerRuleOptionsConfig<TModelValue extends Recordable = Recordable> {
  /** 上下文缓存 key。 */
  key?: FilterPickerRuleResolver<FilterPickerRuleOptionsKey, TModelValue>
  /** 动态加载选项。 */
  load: FilterPickerRuleResolver<MaybeAsyncGetter<FilterPickerOption[]>, TModelValue>
}

/** 单个字段规则配置。 */
export interface FilterPickerRuleConfig<
  TValue = unknown,
  TModelValue extends Recordable = Recordable,
> {
  /** 字段校验。 */
  validate?: ZodType<TValue>
  /** 字段是否可见。 */
  visible?: FilterPickerRuleVisible<TModelValue>
  /** 字段是否禁用。 */
  disabled?: FilterPickerRuleDisabled<TModelValue>
  /** 新建草稿时的默认值。 */
  defaultValue?: FilterPickerRuleDefaultValue<TValue, TModelValue>
  /** 提交前的值规范化。 */
  normalize?: FilterPickerRuleNormalize<TValue, TModelValue>
  /** 运行时动态 options。 */
  options?: FilterPickerRuleOptionsConfig<TModelValue>
}

/** 单个字段规则。 */
export type FilterPickerRule<
  TValue = unknown,
  TModelValue extends Recordable = Recordable,
> = ZodType<TValue> | FilterPickerRuleConfig<TValue, TModelValue>

/** 规则集合。 */
export type FilterPickerRules<
  TModelValue extends Recordable = Recordable,
  TItems extends readonly FilterPickerItem<TModelValue>[] = readonly FilterPickerItem<TModelValue>[],
> = Partial<{
  [TField in Extract<TItems[number]['field'], FilterPickerField<TModelValue>>]:
  FilterPickerRule<unknown, TModelValue>
}>

/**
 * 过滤器配置
 * @param TModelValue 数据模型类型
 * @param TItems 过滤器项类型
 */
export interface FilterPickerConfig<
  TModelValue extends Recordable = Recordable,
  TItems extends readonly FilterPickerItem<TModelValue>[] = readonly FilterPickerItem<TModelValue>[],
> {
  /** 标识 */
  id: string
  /** 过滤器项 */
  items: TItems
  /** 固定展示字段 */
  pinned?: TItems[number]['field'][]
  /** 默认字段 */
  defaultField?: TItems[number]['field']
  /** 字段规则 */
  rules?: FilterPickerRules<TModelValue, TItems>
}

/**
 * 用户配置
 */
export interface UserConfig<
  TModelValue extends Recordable = Recordable,
  TItems extends readonly FilterPickerItem<TModelValue>[] = readonly FilterPickerItem<TModelValue>[],
> extends Omit<FilterPickerConfig<TModelValue, TItems>, 'id'> {}

/** 组件属性 */
export interface FilterPickerProps extends FilterPickerConfig {
  /** 触发器文案 */
  triggerText?: string
  /** 触发器图标 */
  triggerIcon?: FilterPickerIcon
  /** 隐藏触发器文案 */
  hideTriggerText?: boolean
  /** 触发器按钮属性 */
  triggerButtonProps?: ButtonProps

  /** 清空文案 */
  clearText?: string
  /** 清空按钮属性 */
  clearButtonProps?: ButtonProps
  /** 清空按钮图标 */
  clearIcon?: FilterPickerIcon
  /** 清空按钮常驻显示 */
  clearPersistent?: boolean

}
