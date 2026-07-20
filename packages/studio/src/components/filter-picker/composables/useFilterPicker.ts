import type { ToRef } from 'vue'
import type { FilterPickerProps } from '../types'
import { X } from '@lucide/vue'
import { createInjectionState } from '@vueuse/core'
import { computed, toValue, watchEffect } from 'vue'
import {
  preloadResolvedFilterPickerOptions,
  refreshResolvedFilterPickerOptions,
  resolvedFilterPickerOptionsCache,
} from './useResolvedFilterPickerOptions'

/**
 * 提供 FilterPicker 的基础 store。
 * 除配置本身外，还向下游暴露 options 缓存中心与强刷入口。
 */
const [useProvideFilterPickerStore, _useFilterPicker] = createInjectionState(
  (userConfig: ToRef<FilterPickerProps>) => {
    /** 原始配置的响应式视图，供下游统一读取。 */
    const config = computed(() => userConfig.value)
    /** 全局 options 缓存中心。 */
    const optionsCache = resolvedFilterPickerOptionsCache
    /** 清空按钮的默认属性解析。 */
    const resolvedClearButtonProps = computed(() => ({
      variant: 'ghost' as const,
      ...config.value.clearButtonProps,
    }))
    /** 清空按钮图标解析；未传时回退到默认 X。 */
    const resolvedClearIcon = computed(() => {
      if (config.value.clearIcon == null) {
        return X
      }

      return toValue(config.value.clearIcon)
    })
    const resolvedClearText = computed(() => config.value.clearText || 'Clear')
    /** 清空按钮文案解析。 */

    watchEffect(() => {
    /** 预热静态 options，避免首次打开选择器时再发起额外解析。 */
      preloadResolvedFilterPickerOptions(config.value, config.value.items)
    })

    async function refresh(target = config.value.items) {
    /**
     * 强制刷新指定字段的 options。
     * 不传时默认刷新当前 FilterPicker 配置中的全部字段。
     */
      return refreshResolvedFilterPickerOptions(config.value, target)
    }

    return {
      config,
      optionsCache,
      resolvedClearButtonProps,
      resolvedClearIcon,
      resolvedClearText,
      refresh,
    }
  },
)

export { useProvideFilterPickerStore }

/**
 * 读取当前 FilterPicker store。
 */
export function useFilterPicker() {
  const store = _useFilterPicker()
  if (store == null) {
    throw new Error(
      'Please call `useProvideFilterPickerStore` on the appropriate parent component',
    )
  }
  return store
}
