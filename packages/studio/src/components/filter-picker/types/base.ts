import type { Component, Reactive, Ref, VNode } from 'vue'

/** 键值对象 */
export type Recordable<T = unknown> = Record<string, T>

/** 可获取器 */
export type MaybeGetter<T> = T | (() => T)

/** 可异步获取器 */
export type MaybeAsyncGetter<T> = T | (() => T) | (() => Promise<T>) | Promise<T>

/** 过滤器类型 */
const filterPickerType = {
  /** 输入框 */
  INPUT: 'input',
  /** 数字选择 */
  NUMBER: 'number',
  /** 下拉选择 */
  SELECT: 'select',
  /** 多选 */
  CHECKBOX: 'checkbox',
  /** 标签输入 */
  TAGS: 'tags',
} as const

export { filterPickerType as FilterPickerType }

export type FilterPickerType = (typeof filterPickerType)[keyof typeof filterPickerType]

/** 选项值 */
export type FilterPickerOptionValue = string | number | boolean | symbol

/** 选项项 */
export interface FilterPickerOption {
  /** 文案 */
  label: string
  /** 值 */
  value: FilterPickerOptionValue
}

/** 静态可选项配置 */
export type FilterPickerStaticOptions = MaybeGetter<FilterPickerOption[]>

/** 过滤字段 */
export type FilterPickerField<TModelValue extends Recordable> = Extract<keyof TModelValue, string>

/** 绑定值 */
export type FilterPickerModelValue<TModelValue extends Recordable> = Reactive<TModelValue> | Ref<TModelValue>

/** 图标 */
export type FilterPickerIcon = MaybeGetter<VNode | Component>
