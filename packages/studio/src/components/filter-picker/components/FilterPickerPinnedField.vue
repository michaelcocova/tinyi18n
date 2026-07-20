<script setup lang="ts">
import type { FilterPickerConditionSlots } from '../distribution'
import type { FilterPickerItem } from '../types'
import { ChevronDown } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { sleep } from '@/utils/sleep.ts'
import { useFilterPickerControls } from '../composables/useFilterPickerControls'
import FilterPickerCondition from './FilterPickerCondition.vue'
import FilterPickerDraftEditor from './FilterPickerDraftEditor.vue'
import {
  isFilterPickerPinnedInlinePanel,
  resolveFilterPickerPanel,
} from './panel/distribution'

const props = defineProps<{
  item: FilterPickerItem
}>()

defineSlots<FilterPickerConditionSlots>()

const {
  begin,
  cancel,
  commit,
  commitItem,
  draft,
  getCondition,
  getDefaultValue,
  isItemDisabled,
  isItemVisible,
} = useFilterPickerControls()

/** 当前 pinned 字段对应的已提交条件；无值时为空。 */
const condition = computed(() => getCondition(props.item.field))
/** 当前字段在规则约束下是否禁用。 */
const disabled = computed(() => isItemDisabled(props.item))
/** 当前字段在规则约束下是否可见。 */
const visible = computed(() => isItemVisible(props.item))
/** 选择类 pinned 字段的菜单开关状态。 */
const open = ref(false)
/** input 类型 pinned 字段在空值态下的本地输入值。 */
const inputValue = ref(String(getDefaultValue(props.item) ?? ''))
/** input 类型 pinned 字段在空值态下的本地错误信息。 */
const inputError = ref<string>()

/** 当前 draft 是否正处于这个 pinned 字段的编辑态。 */
const isEditingCurrentItem = computed(() => draft.value?.item.field === props.item.field)
/** 当前 pinned 字段对应的面板分发配置。 */
const currentPanel = computed(() => resolveFilterPickerPanel(props.item.type))
/** 当前 pinned 字段是否以内联面板方式渲染。 */
const inlinePanel = computed(() => isFilterPickerPinnedInlinePanel(props.item.type))

/**
 * 已提交条件变化时，同步 pinned 字段入口状态。
 * 一旦条件被提交，空值态入口需要退出；当条件被删除时，则回到默认输入值。
 */
watch(condition, (nextCondition) => {
  if (nextCondition != null) {
    open.value = false
    inputError.value = undefined
    return
  }

  inputValue.value = String(getDefaultValue(props.item) ?? '')
})

/**
 * 可见性变化时，及时关闭弹层并清理局部错误状态。
 * 配合 `visible = false` 的删除逻辑，避免隐藏字段残留交互态。
 */
watch(visible, (nextVisible) => {
  if (!nextVisible) {
    open.value = false
    inputError.value = undefined
  }
})

/**
 * 提交 input 类型 pinned 字段的空值态输入。
 * 成功后回到默认值，失败则保留错误信息供用户继续修正。
 */
async function handleInputCommit() {
  const result = await commitItem(props.item, inputValue.value)
  if (result.success) {
    inputValue.value = String(getDefaultValue(props.item) ?? '')
    inputError.value = undefined
    return
  }

  inputError.value = result.error
}

/**
 * 处理选择类 pinned 字段的下拉开关。
 * 打开时进入统一 draft 编辑链路，关闭时等待状态稳定后清理 draft。
 */
async function handleOpenChange(nextOpen: boolean) {
  open.value = nextOpen

  if (nextOpen) {
    begin(props.item)
    return
  }

  await sleep(100)
  if (isEditingCurrentItem.value) {
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
  <FilterPickerCondition
    v-if="condition != null"
    :condition="condition"
  >
    <template
      v-if="$slots.condition"
      #condition="slotProps"
    >
      <slot
        name="condition"
        v-bind="slotProps"
      />
    </template>
    <template
      v-if="$slots.label"
      #label="slotProps"
    >
      <slot
        name="label"
        v-bind="slotProps"
      />
    </template>
    <template
      v-if="$slots.separator"
      #separator
    >
      <slot name="separator" />
    </template>
    <template
      v-if="$slots.remove"
      #remove="slotProps"
    >
      <slot
        name="remove"
        v-bind="slotProps"
      />
    </template>
  </FilterPickerCondition>

  <div v-else-if="visible">
    <div
      v-if="inlinePanel && currentPanel != null"
      class="min-w-64 flex-1"
    >
      <component
        :is="currentPanel.component"
        v-model="inputValue"
        :schema="props.item"
        label-as-addon
        @commit="handleInputCommit"
      />
      <p
        v-if="inputError"
        class="mt-1 text-xs text-destructive"
      >
        {{ inputError }}
      </p>
    </div>

    <DropdownMenu
      :open="open"
      @update:open="handleOpenChange"
    >
      <DropdownMenuTrigger
        v-if="!inlinePanel"
        as-child
      >
        <Button
          :disabled="disabled"
          variant="outline"
          class="font-normal"
        >
          <span class="text-muted-foreground">
            {{ props.item.label }}
          </span>
          <ChevronDown class="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        v-if="!inlinePanel"
        align="start"
        class="w-fit p-0"
      >
        <div
          class="flex flex-col"
          :data-type="props.item.type"
        >
          <FilterPickerDraftEditor />
          <footer
            class="flex items-center gap-2 border-t px-3 py-2"
            :data-type="props.item.type"
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
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
