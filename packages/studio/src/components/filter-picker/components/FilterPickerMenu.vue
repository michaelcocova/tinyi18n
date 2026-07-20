<script setup lang="ts">
import type { FilterPickerMenuSlots } from '../distribution'
import type { FilterPickerProps } from '../types'
import { Funnel } from '@lucide/vue'
import { computed, toValue } from 'vue'
import { sleep } from '@/utils/sleep.ts'
import { useFilterPickerControls } from '../composables/useFilterPickerControls'
import { usePickerDropdownMenu } from '../composables/usePickerDropdownMenu'
import FilterPickerDraftEditor from './FilterPickerDraftEditor.vue'

const props = defineProps<Pick<
  FilterPickerProps,
  'triggerText' | 'triggerIcon' | 'hideTriggerText' | 'triggerButtonProps'
>>()

defineSlots<FilterPickerMenuSlots>()

/** 下拉菜单分组数据与字段交互能力。 */
const { menuSections, isItemDisabled, selectItem } = usePickerDropdownMenu()
/** 当前 draft 状态与取消能力。 */
const { draft, cancel } = useFilterPickerControls()

/** 触发器按钮属性解析。 */
const resolvedTriggerButtonProps = computed(() => ({
  variant: 'outline' as const,
  ...props.triggerButtonProps,
}))

/** 触发器图标解析；未传时回退到默认 Funnel。 */
const resolvedTriggerIcon = computed(() => {
  if (props.triggerIcon == null) {
    return Funnel
  }

  return toValue(props.triggerIcon)
})

/** 触发器文案解析。 */
const resolvedTriggerText = computed(() => props.triggerText || 'Filter')

/**
 * 等待下拉菜单状态稳定后再清理 draft，避免切换 tab 时误触发取消。
 */
async function handleOpenChange(open: boolean) {
  await sleep(100)
  if (!open) {
    cancel()
  }
}
</script>

<template>
  <DropdownMenu @update:open="handleOpenChange">
    <DropdownMenuTrigger as-child>
      <slot name="trigger">
        <Button v-bind="resolvedTriggerButtonProps">
          <slot name="triggerIcon">
            <component :is="resolvedTriggerIcon" />
          </slot>
          <span v-if="!props.hideTriggerText">
            {{ resolvedTriggerText }}
          </span>
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      class="w-fit max-h-[calc(var(--reka-dropdown-menu-content-available-height)-20px)] p-0"
      align="start"
    >
      <Tabs :model-value="draft ? 'value-input' : 'select-menu'">
        <TabsContent
          value="select-menu"
          class="p-2"
        >
          <template
            v-for="section in menuSections"
            :key="section.key"
          >
            <template v-if="section.group != null">
              <DropdownMenuGroup class="border-muted border-dashed border-b pb-1 mb-1 last:border-b-0 last:mb-0 last:pb-0">
                <DropdownMenuLabel class="px-2 py-1.5 text-xs font-normal text-muted-foreground">
                  {{ section.group }}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  v-for="item in section.items"
                  :key="item.field"
                  :disabled="isItemDisabled(item)"
                  class="text-sm text-secondary-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  @select.prevent="selectItem(item)"
                >
                  {{ item.label }}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </template>
            <DropdownMenuItem
              v-for="item in section.items"
              v-else
              :key="item.field"
              :disabled="isItemDisabled(item)"
              class="text-sm text-secondary-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              @select.prevent="selectItem(item)"
            >
              {{ item.label }}
            </DropdownMenuItem>
          </template>
        </TabsContent>
        <TabsContent value="value-input">
          <FilterPickerDraftEditor />
        </TabsContent>
      </Tabs>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
