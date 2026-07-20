import type { MaybeRefOrGetter, ShallowRef } from 'vue'
import type {
  FilterPickerConfig,
  FilterPickerItem,
  FilterPickerOption,
  FilterPickerOptionItem,
  FilterPickerOptionValue,
  Recordable,
} from '../types'
import { computed, shallowRef, toValue, watchEffect } from 'vue'
import { getItemRule, normalizeRule } from '../rules'
import { FilterPickerType } from '../types'
import { useFilterPicker } from './useFilterPicker'
import { useFilterPickerControls } from './useFilterPickerControls'

type FilterPickerOptionsCacheKey = FilterPickerOptionValue | '__default__' | '__static__'

interface FilterPickerRuleContext {
  values: Recordable
  conditions: Recordable
}

/** 单个 options 缓存槽。 */
interface FilterPickerOptionsCenterEntry {
  loaded: boolean
  requestVersion: number
  options: ShallowRef<FilterPickerOption[]>
}

interface ResolvedOptionsDescriptor {
  key: FilterPickerOptionsCacheKey
  load: () => Promise<FilterPickerOption[]>
}

/** 全局 options 数据中心，按 item + 上下文 key 缓存已解析结果。 */
const optionsCenter = new WeakMap<FilterPickerOptionItem, Map<FilterPickerOptionsCacheKey, FilterPickerOptionsCenterEntry>>()
const pendingOptionsRequests = new WeakMap<FilterPickerOptionItem, Map<FilterPickerOptionsCacheKey, Promise<FilterPickerOption[]>>>()

export const resolvedFilterPickerOptionsCache = optionsCenter

/** 判断字段是否具备 options 能力。 */
function isOptionItem(item: unknown): item is FilterPickerOptionItem {
  return typeof item === 'object'
    && item != null
    && 'type' in item
    && (item.type === FilterPickerType.SELECT || item.type === FilterPickerType.CHECKBOX)
}

/** 读取某个字段的缓存桶；不存在时自动创建。 */
function getOptionsBucket(item: FilterPickerOptionItem) {
  const currentBucket = optionsCenter.get(item)
  if (currentBucket != null) {
    return currentBucket
  }

  const nextBucket = new Map<FilterPickerOptionsCacheKey, FilterPickerOptionsCenterEntry>()
  optionsCenter.set(item, nextBucket)
  return nextBucket
}

/** 读取某个字段的 pending 请求桶；用于合并并发请求。 */
function getPendingBucket(item: FilterPickerOptionItem) {
  const currentBucket = pendingOptionsRequests.get(item)
  if (currentBucket != null) {
    return currentBucket
  }

  const nextBucket = new Map<FilterPickerOptionsCacheKey, Promise<FilterPickerOption[]>>()
  pendingOptionsRequests.set(item, nextBucket)
  return nextBucket
}

/** 读取某个字段在指定上下文 key 下的缓存槽。 */
function getOptionsCenterEntry(
  item: FilterPickerOptionItem,
  key: FilterPickerOptionsCacheKey,
) {
  const bucket = getOptionsBucket(item)
  const currentEntry = bucket.get(key)
  if (currentEntry != null) {
    return currentEntry
  }

  const nextEntry: FilterPickerOptionsCenterEntry = {
    loaded: false,
    requestVersion: 0,
    options: shallowRef<FilterPickerOption[]>([]),
  }
  bucket.set(key, nextEntry)
  return nextEntry
}

/** 将动态 key 规范化为缓存层可直接使用的 key。 */
function resolveOptionsKey(key: FilterPickerOptionValue | null | undefined) {
  return key ?? '__default__'
}

/**
 * 根据字段定义和当前规则上下文，解析本次应使用的 options 描述。
 * 运行时动态 options 优先于字段上的静态 options。
 */
function getResolvedOptionsDescriptor(
  config: FilterPickerConfig,
  item: FilterPickerOptionItem,
  context: FilterPickerRuleContext,
): ResolvedOptionsDescriptor | null {
  const rule = normalizeRule(getItemRule(config, item))
  if (rule.options != null) {
    return {
      key: resolveOptionsKey(rule.options.key?.(context.values, context.conditions)),
      load: async () => {
        const value = rule.options!.load(context.values, context.conditions)
        return typeof value === 'function'
          ? await value()
          : await value
      },
    }
  }

  if (item.options != null) {
    return {
      key: '__static__',
      load: async () => toValue(item.options) ?? [],
    }
  }

  return null
}

/**
 * 解析单个字段在当前上下文下的最终 options。
 * 会复用缓存并自动合并同 key 的并发请求。
 */
export async function resolveFilterPickerOptions(
  config: FilterPickerConfig,
  item: FilterPickerOptionItem,
  context: FilterPickerRuleContext,
  force: boolean = false,
) {
  const descriptor = getResolvedOptionsDescriptor(config, item, context)
  if (descriptor == null) {
    return []
  }

  const entry = getOptionsCenterEntry(item, descriptor.key)
  if (!force && entry.loaded) {
    return entry.options.value
  }

  const pendingBucket = getPendingBucket(item)
  if (!force) {
    const pendingRequest = pendingBucket.get(descriptor.key)
    if (pendingRequest != null) {
      return pendingRequest
    }
  }

  const nextRequestVersion = entry.requestVersion + 1
  entry.requestVersion = nextRequestVersion

  const nextRequest = (async () => {
    try {
      const resolvedOptions = await descriptor.load()

      if (entry.requestVersion === nextRequestVersion) {
        entry.options.value = resolvedOptions
        entry.loaded = true
      }

      return resolvedOptions
    }
    finally {
      if (entry.requestVersion === nextRequestVersion) {
        pendingBucket.delete(descriptor.key)
      }
    }
  })()

  pendingBucket.set(descriptor.key, nextRequest)
  return nextRequest
}

/**
 * 预热一组 items 中的静态 options。
 */
export function preloadResolvedFilterPickerOptions(
  config: FilterPickerConfig,
  items: readonly FilterPickerItem[],
  context?: FilterPickerRuleContext,
) {
  const fallbackContext = context ?? {
    values: {},
    conditions: {},
  }

  for (const item of items) {
    if (!isOptionItem(item)) {
      continue
    }

    const rule = normalizeRule(getItemRule(config, item))
    if (context == null && rule.options != null) {
      continue
    }

    void resolveFilterPickerOptions(config, item, fallbackContext)
  }
}

/**
 * 强制刷新指定 item 或 items 的 options。
 */
export async function refreshResolvedFilterPickerOptions(
  config: FilterPickerConfig,
  target: readonly FilterPickerItem[] | FilterPickerOptionItem | null | undefined,
  context?: FilterPickerRuleContext,
) {
  if (target == null) {
    return []
  }

  if (Array.isArray(target)) {
    const fallbackContext = context ?? {
      values: {},
      conditions: {},
    }

    return Promise.all(
      target
        .filter(isOptionItem)
        .filter((item) => {
          const rule = normalizeRule(getItemRule(config, item))
          return context != null || rule.options == null
        })
        .map(item => resolveFilterPickerOptions(config, item, fallbackContext, true)),
    )
  }

  if (!isOptionItem(target)) {
    return []
  }

  return resolveFilterPickerOptions(
    config,
    target,
    context ?? {
      values: {},
      conditions: {},
    },
    true,
  )
}

/**
 * 读取并维护单个字段的 resolved options。
 */
export function useResolvedFilterPickerOptions(
  source: MaybeRefOrGetter<FilterPickerOptionItem | null | undefined>,
) {
  /** 当前 FilterPicker store。 */
  const filterPicker = useFilterPicker()
  /** 控制器提供的规则上下文读取能力。 */
  const { getRuleContext } = useFilterPickerControls()

  /** 当前正在消费 options 的字段。 */
  const currentItem = computed(() => {
    const value = toValue(source)
    return isOptionItem(value) ? value : undefined
  })

  /** 当前字段在当前规则上下文下对应的 options 描述。 */
  const currentDescriptor = computed<ResolvedOptionsDescriptor | null>(() => {
    if (currentItem.value == null) {
      return null
    }

    return getResolvedOptionsDescriptor(
      filterPicker.config.value,
      currentItem.value,
      getRuleContext(),
    )
  })

  /** 当前字段最终暴露给视图层的已解析 options。 */
  const options = computed<FilterPickerOption[]>(() => {
    if (currentItem.value == null || currentDescriptor.value == null) {
      return []
    }

    return getOptionsCenterEntry(currentItem.value, currentDescriptor.value.key).options.value
  })

  /** 监听字段和规则上下文变化，自动解析当前 options。 */
  watchEffect(() => {
    if (currentItem.value == null) {
      return
    }

    void resolveFilterPickerOptions(
      filterPicker.config.value,
      currentItem.value,
      getRuleContext(),
    )
  })

  /**
   * 强制刷新当前字段的 options。
   * 不传 target 时默认刷新当前 source 对应字段。
   */
  async function refresh(
    target: FilterPickerOptionItem | null | undefined = currentItem.value,
  ) {
    return refreshResolvedFilterPickerOptions(
      filterPicker.config.value,
      target,
      getRuleContext(),
    )
  }

  return {
    cache: optionsCenter,
    options,
    refresh,
  }
}
