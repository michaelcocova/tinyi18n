<script setup lang="ts">
import type { FilterPickerConditionSlots } from '../distribution'
import type { FilterPickerSelectedItem } from '../types'
import { X } from '@lucide/vue'
import { computed } from 'vue'
import { sleep } from '@/utils/sleep.ts'
import { useFilterPickerControls } from '../composables/useFilterPickerControls'
import { useResolvedFilterPickerOptions } from '../composables/useResolvedFilterPickerOptions'
import { FilterPickerType } from '../types'
import { findOptionLabel } from '../utils'
import FilterPickerDraftEditor from './FilterPickerDraftEditor.vue'

const props = defineProps<{
  condition: FilterPickerSelectedItem
}>()

defineSlots<FilterPickerConditionSlots>()

const { begin, cancel, commit, draft, isItemDisabled, remove } = useFilterPickerControls()

/** 当前条件是否正处于编辑打开态。 */
const open = computed(() => draft.value?.item.field === props.condition.field)
/** 当前条件对应字段是否被规则禁用。 */
const disabled = computed(() => isItemDisabled(props.condition.item))

// select/checkbox 需要借助 options 将已提交值格式化为可读文案。
const optionItem = computed(() => {
  const { item } = props.condition
  if (item.type === FilterPickerType.SELECT || item.type === FilterPickerType.CHECKBOX) {
    return item
  }

  return undefined
})

const { options } = useResolvedFilterPickerOptions(optionItem)

// 统一处理不同类型的展示值，避免按钮上直接渲染原始 value。
const valueText = computed(() => {
  const { item, value } = props.condition
  if (item.type === FilterPickerType.SELECT) {
    return findOptionLabel(value, options.value, String(value))
  }

  if (item.type === FilterPickerType.CHECKBOX || item.type === FilterPickerType.TAGS) {
    if (!Array.isArray(value) || value.length === 0) {
      return ''
    }

    return value
      .map(currentValue => findOptionLabel(currentValue, options.value, String(currentValue)))
      .join(', ')
  }

  return String(value)
})

async function handleOpenChange(nextOpen: boolean) {
  if (nextOpen) {
    begin(props.condition.item)
    return
  }
  // 等待下拉菜单状态稳定后再清理 draft，避免切换 tab 时误触发取消。
  await sleep(100)
  if (open.value) {
    cancel()
  }
}

function handleCancel() {
  cancel()
}

async function handleCommit() {
  await commit()
}
</script>

<template>
  <Popover
    :open="open"
    @update:open="handleOpenChange"
  >
    <PopoverTrigger as-child>
      <slot
        name="condition"
        v-bind="{ condition, remove, open }"
      >
        <Button
          :disabled="disabled"
          class="font-normal pl-2 pr-1 data-[state=open]:bg-accent"
          variant="outline"
        >
          <slot
            name="label"
            :condition="condition"
          >
            <label class="text-sm text-muted-foreground">
              {{ condition.item.label }}
            </label>
          </slot>
          <slot name="separator">
            :
          </slot>
          <span>{{ valueText }}</span>
          <slot
            name="remove"
            :condition="condition"
            :remove="remove"
            :open="open"
          >
            <button
              class="rounded size-5 inline-flex items-center justify-center text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-zinc-200"
              @click="remove(condition.field)"
            >
              <X />
            </button>
          </slot>
        </Button>
      </slot>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="w-fit p-0"
    >
      <div
        class="flex flex-col"
        :data-type="props.condition.item.type"
      >
        <FilterPickerDraftEditor />
        <footer
          class="flex items-center gap-2 border-t px-3 py-2"
          :data-type="props.condition.item.type"
        >
          <Button
            size="sm"
            variant="ghost"
            class="ml-auto font-normal"
            @click="handleCancel"
          >
            取消
          </Button>
          <Button
            size="sm"
            variant="secondary"
            class="font-normal"
            @click="handleCommit"
          >
            确定
          </Button>
        </footer>
      </div>
    </PopoverContent>
  </Popover>
</template>
