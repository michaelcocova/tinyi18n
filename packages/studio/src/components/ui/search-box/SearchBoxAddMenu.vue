<script setup lang="ts">
import type { SearchBoxModelValue, SearchBoxSchema, ToggleSearchBoxSchema } from './types'
import { FunnelPlus } from '@lucide/vue'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import CustomContent from './content/CustomContent.vue'
import EnumContent from './content/EnumContent.vue'
import InputContent from './content/InputContent.vue'
import SelectContent from './content/SelectContent.vue'
import ToggleContent from './content/ToggleContent.vue'
import { useSearchBoxStore } from './useSearchBox'

const props = withDefaults(defineProps<{
  modelValue?: SearchBoxModelValue
  excludeFields?: string[]
  editingValue?: any
}>(), {
  modelValue: () => ({}),
  excludeFields: () => [],
  editingValue: undefined,
})

const emit = defineEmits<{
  (event: 'confirm', payload: { schema: SearchBoxSchema, value: any }): void
}>()

const { addBtnState, schemas, onActiveSchema, clearActiveSchema, activeSchema } = useSearchBoxStore()

const visibleSchemas = computed(() =>
  schemas.value.filter((item) => {
    if (props.excludeFields.includes(item.field)) {
      return false
    }
    if (item.repeatable === true) {
      return true
    }
    const v = (props.modelValue ?? {})[item.field]
    if (v === undefined || v === null)
      return true
    if (item.type === 'toggle')
      return v !== true
    if (item.type === 'enum' && item.mode === 'multi')
      return !(Array.isArray(v) && v.length)
    if (item.type === 'select' && item.multiple)
      return !(Array.isArray(v) && v.length)
    if (item.type === 'custom' && item.repeatable)
      return true
    return String(v).trim() === ''
  }),
)

function closeAndReset() {
  addBtnState.visible = false
  clearActiveSchema()
}

function emitDirect(schema: SearchBoxSchema, value: any) {
  emit('confirm', { schema, value })
  closeAndReset()
}

function handleOpenChange(open: boolean) {
  addBtnState.visible = open
  if (!open) {
    clearActiveSchema()
  }
}

function handleConfirmInput(value: string) {
  if (!activeSchema.value)
    return
  emitDirect(activeSchema.value, value)
}

function handleConfirmToggle() {
  if (!activeSchema.value)
    return
  emitDirect(activeSchema.value, true)
}

function handleConfirmSelect(value: string | string[]) {
  if (!activeSchema.value)
    return
  emitDirect(activeSchema.value, value)
}

function handleConfirmEnum(value: string | string[]) {
  emitDirect(activeSchema.value as any, value)
}

function handleConfirmCustom(value: string | string[]) {
  if (!activeSchema.value)
    return
  emitDirect(activeSchema.value, value)
}

function handleSchemaSelect(schema: SearchBoxSchema) {
  if (schema.type === 'toggle') {
    const toggleSchema = schema as ToggleSearchBoxSchema
    if (!toggleSchema.description) {
      emitDirect(schema, true)
      return
    }
  }

  onActiveSchema(schema)
}
</script>

<template>
  <Popover
    :open="addBtnState.visible"
    @update:open="handleOpenChange"
  >
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 shrink-0 font-normal"
        @click="addBtnState.visible = true"
      >
        <FunnelPlus />
        <!-- <ListFilterPlus class="size-4" /> -->
        更多筛选
      </Button>
    </PopoverTrigger>
    <PopoverContent
      class="w-[22rem] p-2"
      align="start"
    >
      <div
        v-if="activeSchema?.field"
        class="space-y-2"
      >
        <InputContent @confirm="handleConfirmInput" />
        <ToggleContent @confirm="handleConfirmToggle" />
        <SelectContent @confirm="handleConfirmSelect" />
        <EnumContent @confirm="handleConfirmEnum" />
        <CustomContent
          @confirm="handleConfirmCustom"
          @cancel="closeAndReset"
        >
          <template #default="slotProps">
            <slot
              v-bind="{ ...slotProps, value: props.editingValue, modelValue: props.modelValue }"
            />
          </template>
        </CustomContent>
      </div>
      <div
        v-else
        class="space-y-1"
      >
        <button
          v-for="item in visibleSchemas"
          :key="item.field"
          type="button"
          class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
          @click="handleSchemaSelect(item)"
        >
          <span>{{ item.label }}</span>
          <Badge
            v-if="item.repeatable"
            variant="secondary"
            class="h-5 rounded-md px-1.5 text-[10px] font-normal"
          >
            可重复
          </Badge>
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
