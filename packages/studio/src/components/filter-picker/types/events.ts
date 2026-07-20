import type { FilterPickerItem } from './items'

/** 草稿值 */
export type FilterPickerDraftValue = unknown

/** 当前草稿 */
export interface FilterPickerDraft {
  /** 过滤器项 */
  item: FilterPickerItem
  /** 草稿值 */
  value: FilterPickerDraftValue
  /** 错误信息 */
  error?: string
}

/** 已添加的过滤项 */
export interface FilterPickerSelectedItem {
  /** 字段 */
  field: string
  /** 过滤器项 */
  item: FilterPickerItem
  /** 已提交的值 */
  value: FilterPickerDraftValue
}

/** 提交事件 */
export interface FilterPickerCommitEvent {
  /** 当前提交项 */
  condition: FilterPickerSelectedItem
  /** 最新条件列表 */
  conditions: FilterPickerSelectedItem[]
}

/** 删除事件 */
export interface FilterPickerRemoveEvent {
  /** 删除字段 */
  field: string
  /** 被删除的条件 */
  condition?: FilterPickerSelectedItem
  /** 最新条件列表 */
  conditions: FilterPickerSelectedItem[]
}

/** 清空事件 */
export interface FilterPickerClearEvent {
  /** 清空前的条件列表 */
  conditions: FilterPickerSelectedItem[]
}

/** 变化事件类型 */
export type FilterPickerChangeType = 'commit' | 'remove' | 'clear'

/** 变化事件 —— 提交 */
export interface FilterPickerCommitChangeEvent {
  /** 变化类型 */
  type: 'commit'
  /** 当前提交项 */
  condition: FilterPickerSelectedItem
  /** 最新条件列表 */
  conditions: FilterPickerSelectedItem[]
}

/** 变化事件 —— 删除 */
export interface FilterPickerRemoveChangeEvent {
  /** 变化类型 */
  type: 'remove'
  /** 删除字段 */
  field: string
  /** 被删除的条件 */
  condition?: FilterPickerSelectedItem
  /** 最新条件列表 */
  conditions: FilterPickerSelectedItem[]
}

/** 变化事件 —— 清空 */
export interface FilterPickerClearChangeEvent {
  /** 变化类型 */
  type: 'clear'
  /** 最新条件列表 */
  conditions: FilterPickerSelectedItem[]
}

/** 变化事件 */
export type FilterPickerChangeEvent
  = | FilterPickerCommitChangeEvent
    | FilterPickerRemoveChangeEvent
    | FilterPickerClearChangeEvent
