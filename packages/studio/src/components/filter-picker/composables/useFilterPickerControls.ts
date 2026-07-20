import type { Ref } from 'vue'
import type {
  FilterPickerChangeEvent,
  FilterPickerClearEvent,
  FilterPickerCommitEvent,
  FilterPickerDraft,
  FilterPickerDraftValue,
  FilterPickerItem,
  FilterPickerOption,
  FilterPickerOptionItem,
  FilterPickerRemoveEvent,
  FilterPickerSelectedItem,
  Recordable,
} from '../types'
import { createEventHook, createInjectionState } from '@vueuse/core'
import { shallowRef, watch } from 'vue'
import {
  getItemRule,
  normalizeRule,
  resolveRuleDefaultValue,
  resolveRulePredicate,
} from '../rules'
import { FilterPickerType } from '../types'
import {
  isActiveFilterPickerValue,
  validateFilterPickerValueShape,
} from '../value'
import { useFilterPicker } from './useFilterPicker'
import { resolveFilterPickerOptions } from './useResolvedFilterPickerOptions'

/**
 * 为不同类型生成草稿初始值，保证 begin 后总能得到可编辑的值。
 */
function getDefaultDraftValue(item: FilterPickerItem): FilterPickerDraftValue {
  switch (item.type) {
    case FilterPickerType.CHECKBOX:
    case FilterPickerType.TAGS:
      return []
    case FilterPickerType.INPUT:
      return ''
    default:
      return undefined
  }
}

/**
 * 将外部 modelValue 反推为内部 conditions，作为控制器的单一显示来源。
 */
function buildConditionsFromModelValue(
  items: readonly FilterPickerItem[],
  modelValue: Recordable | undefined,
): FilterPickerSelectedItem[] {
  if (modelValue == null) {
    return []
  }

  return items.flatMap((item) => {
    const value = modelValue[item.field]
    if (!isActiveFilterPickerValue(item, value)) {
      return []
    }

    return [{
      field: item.field,
      item,
      value,
    }]
  })
}

/**
 * 将 conditions 转为键值对象，便于规则函数直接按字段读取当前条件值。
 */
function buildConditionValues(conditions: FilterPickerSelectedItem[]): Recordable {
  return Object.fromEntries(
    conditions.map(condition => [condition.field, condition.value]),
  )
}

function isOptionItem(item: FilterPickerItem): item is FilterPickerOptionItem {
  return item.type === FilterPickerType.SELECT || item.type === FilterPickerType.CHECKBOX
}

/** 判断某个值是否仍然存在于当前 options 中。 */
function hasOptionValue(value: unknown, options: FilterPickerOption[]) {
  return options.some(option => Object.is(option.value, value) || String(option.value) === String(value))
}

/** 比较两个值是否语义一致，兼容数组值。 */
function isSameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => isSameValue(value, right[index]))
  }

  return Object.is(left, right)
}

/** 比较两组条件是否等价，用于判断联动收敛是否稳定。 */
function isSameConditions(
  left: FilterPickerSelectedItem[],
  right: FilterPickerSelectedItem[],
) {
  return left.length === right.length
    && left.every((item, index) => item.field === right[index]?.field && isSameValue(item.value, right[index]?.value))
}

/**
 * 根据最新 options 收敛条件值。
 * `SELECT` 不存在即删除，`CHECKBOX` 会保留交集。
 */
function reconcileConditionValue(
  condition: FilterPickerSelectedItem,
  options: FilterPickerOption[],
): FilterPickerSelectedItem | null {
  if (condition.item.type === FilterPickerType.SELECT) {
    return hasOptionValue(condition.value, options) ? condition : null
  }

  if (condition.item.type === FilterPickerType.CHECKBOX) {
    if (!Array.isArray(condition.value)) {
      return null
    }

    const nextValue = condition.value.filter(value => hasOptionValue(value, options))
    if (nextValue.length === 0) {
      return null
    }

    if (isSameValue(nextValue, condition.value)) {
      return condition
    }

    return {
      ...condition,
      value: nextValue,
    }
  }

  return condition
}

/**
 * 提供 FilterPicker 的编辑控制器。
 * 负责维护 draft/conditions，并将提交、删除、清空统一收敛为 change 事件。
 */
const [useProvideFilterPickerControls, _useFilterPickerControls] = createInjectionState((
  modelValue: Ref<Recordable | undefined>,
) => {
  const filterPicker = useFilterPicker()
  const draft = shallowRef<FilterPickerDraft | null>(null)
  const conditions = shallowRef<FilterPickerSelectedItem[]>([])
  const commitEvent = createEventHook<FilterPickerCommitEvent>()
  const removeEvent = createEventHook<FilterPickerRemoveEvent>()
  const clearEvent = createEventHook<FilterPickerClearEvent>()
  const changeEvent = createEventHook<FilterPickerChangeEvent>()
  let syncingFromControls = false
  let modelSyncVersion = 0

  /** 判断某个字段是否已经进入 conditions。 */
  function isFieldSelected(field: string) {
    return conditions.value.some(item => item.field === field)
  }

  /** 按字段读取当前已提交条件。 */
  function getCondition(field: string) {
    return conditions.value.find(item => item.field === field)
  }

  /** 统一覆盖内部 conditions，避免直接暴露可变数组引用。 */
  function setConditions(nextConditions: FilterPickerSelectedItem[]) {
    conditions.value = [...nextConditions]
  }

  /** 清理当前草稿。 */
  function resetDraft() {
    draft.value = null
  }

  /**
   * 生成当前规则执行上下文。
   * `values` 会保留外部 modelValue 的其他字段，但以当前 conditions 为准覆盖过滤字段。
   */
  function getRuleContext(nextConditions: FilterPickerSelectedItem[] = conditions.value) {
    const conditionValues = buildConditionValues(nextConditions)
    const resetFilterValues = Object.fromEntries(
      filterPicker.config.value.items.map(item => [item.field, undefined]),
    )

    return {
      values: {
        ...(modelValue.value ?? {}),
        ...resetFilterValues,
        ...conditionValues,
      },
      conditions: conditionValues,
    }
  }

  function isItemVisible(item: FilterPickerItem, nextConditions: FilterPickerSelectedItem[] = conditions.value) {
    const rule = normalizeRule(getItemRule(filterPicker.config.value, item))
    const context = getRuleContext(nextConditions)
    return resolveRulePredicate(rule.visible, true, context.values, context.conditions)
  }

  function isItemDisabled(item: FilterPickerItem, nextConditions: FilterPickerSelectedItem[] = conditions.value) {
    const rule = normalizeRule(getItemRule(filterPicker.config.value, item))
    const context = getRuleContext(nextConditions)
    return resolveRulePredicate(rule.disabled, false, context.values, context.conditions)
  }

  /**
   * 将不可见条件从结果中剔除，避免隐藏字段残留在已选条件和 modelValue 中。
   */
  function pruneInvisibleConditions(nextConditions: FilterPickerSelectedItem[]) {
    let currentConditions = [...nextConditions]

    while (true) {
      const filteredConditions = currentConditions.filter(condition => isItemVisible(condition.item, currentConditions))

      if (filteredConditions.length === currentConditions.length) {
        return filteredConditions
      }

      currentConditions = filteredConditions
    }
  }

  function syncModelValue(nextConditions: FilterPickerSelectedItem[]) {
    if (modelValue.value == null) {
      return
    }

    const context = getRuleContext(nextConditions)

    for (const item of filterPicker.config.value.items) {
      modelValue.value[item.field] = context.values[item.field]
    }
  }

  /** 解析字段在当前规则上下文下的默认值。 */
  function getDefaultValue(item: FilterPickerItem) {
    const rule = normalizeRule(getItemRule(filterPicker.config.value, item))
    const context = getRuleContext()
    const value = resolveRuleDefaultValue(rule.defaultValue, context.values, context.conditions)
    return value ?? getDefaultDraftValue(item)
  }

  /** 用指定字段和值生成下一份条件列表草稿。 */
  function buildNextConditionsWithValue(
    item: FilterPickerItem,
    value: FilterPickerDraftValue,
    baseConditions: FilterPickerSelectedItem[] = conditions.value,
  ) {
    return [
      ...baseConditions.filter(condition => condition.field !== item.field),
      {
        field: item.field,
        item,
        value,
      },
    ]
  }

  /** 对单个字段值执行 `rules.normalize`。 */
  function normalizeItemValue(
    item: FilterPickerItem,
    value: FilterPickerDraftValue,
    nextConditions: FilterPickerSelectedItem[],
  ) {
    const rule = normalizeRule(getItemRule(filterPicker.config.value, item))
    const context = getRuleContext(nextConditions)
    if (rule.normalize == null) {
      return {
        success: true as const,
        value,
      }
    }

    try {
      return {
        success: true as const,
        value: rule.normalize(value, context.values, context.conditions),
      }
    }
    catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : '值规范化失败',
      }
    }
  }

  /**
   * 校验某个字段值在目标条件列表下是否合法。
   * 校验顺序：visible -> disabled -> normalize -> validate。
   */
  function validateItemValue(
    item: FilterPickerItem,
    value: FilterPickerDraftValue,
    baseConditions: FilterPickerSelectedItem[] = conditions.value,
  ) {
    const nextConditions = buildNextConditionsWithValue(item, value, baseConditions)

    if (!isItemVisible(item, nextConditions)) {
      return {
        success: false as const,
        error: '当前条件已被隐藏',
      }
    }

    if (isItemDisabled(item, nextConditions)) {
      return {
        success: false as const,
        error: '当前条件已被禁用',
      }
    }

    const builtInShapeError = validateFilterPickerValueShape(item, value)
    if (builtInShapeError != null) {
      return {
        success: false as const,
        error: builtInShapeError,
      }
    }

    const normalizedValue = normalizeItemValue(item, value, nextConditions)
    if (!normalizedValue.success) {
      return normalizedValue
    }

    const normalizedShapeError = validateFilterPickerValueShape(item, normalizedValue.value)
    if (normalizedShapeError != null) {
      return {
        success: false as const,
        error: normalizedShapeError,
      }
    }

    const rule = normalizeRule(getItemRule(filterPicker.config.value, item))
    const validator = rule.validate

    if (validator == null) {
      return {
        success: true as const,
        value: normalizedValue.value,
      }
    }

    const result = validator.safeParse(normalizedValue.value)
    if (result.success) {
      return {
        success: true as const,
        value: normalizedValue.value,
      }
    }

    return {
      success: false as const,
      error: result.error.issues[0]?.message ?? '校验失败',
    }
  }

  async function settleOptionConditions(
    nextConditions: FilterPickerSelectedItem[],
  ) {
    let currentConditions = pruneInvisibleConditions(nextConditions)

    while (true) {
      const settledConditions = (await Promise.all(
        currentConditions.map(async (condition) => {
          if (!isOptionItem(condition.item)) {
            return condition
          }

          const options = await resolveFilterPickerOptions(
            filterPicker.config.value,
            condition.item,
            getRuleContext(currentConditions),
          )

          return reconcileConditionValue(condition, options)
        }),
      )).filter(condition => condition != null)

      const nextSettledConditions = pruneInvisibleConditions(settledConditions)
      if (isSameConditions(currentConditions, nextSettledConditions)) {
        return nextSettledConditions
      }

      currentConditions = nextSettledConditions
    }
  }

  /**
   * 将条件列表应用到内部状态与外部 modelValue。
   * 这里会先完成 options 收敛，再统一同步出去。
   */
  async function applyConditions(nextConditions: FilterPickerSelectedItem[]) {
    const settledConditions = await settleOptionConditions(nextConditions)
    conditions.value = settledConditions

    syncingFromControls = true
    try {
      syncModelValue(settledConditions)
    }
    finally {
      syncingFromControls = false
    }

    return settledConditions
  }

  watch(
    [() => filterPicker.config.value.items, modelValue],
    async () => {
      if (syncingFromControls) {
        return
      }

      const currentVersion = modelSyncVersion + 1
      modelSyncVersion = currentVersion

      const nextConditions = await settleOptionConditions(
        buildConditionsFromModelValue(filterPicker.config.value.items, modelValue.value),
      )

      if (modelSyncVersion !== currentVersion) {
        return
      }

      setConditions(nextConditions)
      syncModelValue(nextConditions)
      resetDraft()
    },
    {
      deep: true,
      immediate: true,
    },
  )

  function begin(item: FilterPickerItem) {
    if (!isItemVisible(item) || isItemDisabled(item)) {
      return null
    }

    const condition = conditions.value.find(current => current.field === item.field)
    const value = condition?.value ?? getDefaultValue(item)
    draft.value = {
      item,
      value,
    }
    return draft.value
  }

  /** 更新当前草稿值，并清除上一次错误信息。 */
  function updateValue(value: FilterPickerDraftValue) {
    if (draft.value == null) {
      return
    }

    draft.value = {
      ...draft.value,
      value,
      error: undefined,
    }
  }

  /** 校验当前草稿，并把规范化后的值回写到 draft。 */
  function validate() {
    if (draft.value == null) {
      return false
    }

    const result = validateItemValue(draft.value.item, draft.value.value)
    draft.value = {
      ...draft.value,
      value: result.success ? result.value : draft.value.value,
      error: result.success ? undefined : result.error,
    }

    return result.success
  }

  /**
   * 直接提交某个字段值。
   * 供 pinned 空值态这类“非弹层入口”复用同一条提交链路。
   */
  async function commitItem(
    item: FilterPickerItem,
    value: FilterPickerDraftValue,
    baseConditions: FilterPickerSelectedItem[] = conditions.value,
  ) {
    const result = validateItemValue(item, value, baseConditions)
    if (!result.success) {
      return result
    }

    const nextItem: FilterPickerSelectedItem = {
      field: item.field,
      item,
      value: result.value,
    }
    const nextConditions = await applyConditions(
      buildNextConditionsWithValue(item, result.value, baseConditions),
    )

    if (draft.value?.item.field === item.field) {
      resetDraft()
    }

    commitEvent.trigger({
      condition: nextItem,
      conditions: nextConditions,
    })
    changeEvent.trigger({
      type: 'commit',
      condition: nextItem,
      conditions: nextConditions,
    })

    return {
      success: true as const,
      condition: nextItem,
      conditions: nextConditions,
    }
  }

  async function commit() {
    if (draft.value == null) {
      return false
    }

    const result = await commitItem(draft.value.item, draft.value.value)
    if (!result.success) {
      draft.value = {
        ...draft.value,
        error: result.error,
      }
      return false
    }

    return true
  }

  /**
   * 取消当前操作
   */
  function cancel() {
    resetDraft()
  }

  async function remove(field: string) {
    const condition = conditions.value.find(item => item.field === field)
    const nextConditions = await applyConditions(
      conditions.value.filter(item => item.field !== field),
    )

    if (draft.value?.item.field === field) {
      resetDraft()
    }

    removeEvent.trigger({
      field,
      condition,
      conditions: nextConditions,
    })
    changeEvent.trigger({
      type: 'remove',
      field,
      condition,
      conditions: nextConditions,
    })
  }

  /** 清空全部条件，并同步清理 modelValue 对外值。 */
  async function clear() {
    const currentConditions = [...conditions.value]
    await applyConditions([])
    resetDraft()
    clearEvent.trigger({
      conditions: currentConditions,
    })
    changeEvent.trigger({
      type: 'clear',
      conditions: [],
    })
  }

  return {
    draft,
    conditions,
    begin,
    commitItem,
    updateValue,
    validate,
    commit,
    cancel,
    remove,
    clear,
    getCondition,
    getRuleContext,
    getDefaultValue,
    isFieldSelected,
    isItemVisible,
    isItemDisabled,
    onCommit: commitEvent.on,
    onRemove: removeEvent.on,
    onClear: clearEvent.on,
    onChange: changeEvent.on,
  }
})

export { useProvideFilterPickerControls }

/**
 * 读取当前 FilterPicker 控制器。
 */
export function useFilterPickerControls() {
  const store = _useFilterPickerControls()
  if (store == null) {
    throw new Error(
      'Please call `useProvideFilterPickerControls` on the appropriate parent component',
    )
  }
  return store
}
