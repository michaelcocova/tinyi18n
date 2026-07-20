<script setup lang="ts">
import type { EnumSearchBoxSchema, InputSearchBoxSchema, SearchBoxBeforeUpdate, SearchBoxModelValue, SearchBoxSchema, SearchBoxSchemas, SelectSearchBoxSchema, ToggleSearchBoxSchema } from './types.ts'
import { computed, ref, watchEffect } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import CustomContentPanel from './content/CustomContent.vue'
import EnumContentPanel from './content/EnumContent.vue'
import InputContent from './content/InputContent.vue'
import SelectContentPanel from './content/SelectContent.vue'
import ToggleContentPanel from './content/ToggleContent.vue'
import SearchBoxAddMenu from './SearchBoxAddMenu.vue'
import SearchBoxTagList from './SearchBoxTagList.vue'
import { useSearchBoxStore } from './useSearchBox'
import { useProvideSearchBoxStore } from './useSearchBox.ts'

const props = withDefaults(defineProps<{
  items?: SearchBoxSchemas
  modelValue?: SearchBoxModelValue
  beforeUpdate?: SearchBoxBeforeUpdate
  /**
   * 默认展示的筛选项 field：
   * - 传 string：展示对应的筛选项（通常是 query input）
   * - 传 null/undefined：不展示，只有“更多筛选”按钮
   */
  defaultFilterField?: string | null
}>(), {
  items: () => [],
  modelValue: () => ({}),
  beforeUpdate: undefined,
  defaultFilterField: undefined,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: SearchBoxModelValue): void
  (event: 'change', value: SearchBoxModelValue, oldValue: SearchBoxModelValue): void
}>()

useProvideSearchBoxStore(toRef(props, 'items'))
// 需要在默认筛选按钮里主动打开面板
const store = useSearchBoxStore()
const openEditorId = ref<string | null>(null)

const defaultSchema = computed(() => {
  const field = props.defaultFilterField
  if (field === null || field === undefined)
    return undefined
  if (typeof field === 'string' && field.trim()) {
    return (props.items ?? []).find(item => item.field === field.trim())
  }
  return undefined
})

const defaultField = computed(() => defaultSchema.value?.field)

const defaultInputDraft = ref('')
const isDefaultInputEditing = ref(false)
const editingDefaultInline = ref(false)

const hasDefaultValueInModel = computed(() => {
  const schema = defaultSchema.value
  if (!schema)
    return false
  const raw = (props.modelValue ?? {})[schema.field]
  if (schema.type === 'input')
    return String(raw ?? '').trim().length > 0
  if (schema.type === 'toggle')
    return raw === true
  if (schema.type === 'select' && schema.multiple)
    return Array.isArray(raw) && raw.length > 0
  if (schema.type === 'enum' && schema.mode === 'multi')
    return Array.isArray(raw) && raw.length > 0
  if (schema.type === 'custom' && schema.repeatable)
    return Array.isArray(raw) && raw.length > 0
  return String(raw ?? '').trim().length > 0
})

const hasDefaultValueInRenderItems = computed(() => {
  if (!defaultField.value)
    return false
  // eslint-disable-next-line ts/no-use-before-define
  return renderItems.value.some(item => item.field === defaultField.value)
})

const showDefaultInline = computed(() => {
  const schema = defaultSchema.value
  if (!schema)
    return false

  // 只有 default-filter-field 指向的 schema 才会出现在 inline 区域
  // 行为：
  // - 未设置时：显示 inline
  // - 已设置后：显示 chip，inline 消失
  // - 点 chip 编辑时：临时显示 inline（只针对 input）
  if (editingDefaultInline.value) {
    return schema.type === 'input'
  }

  return !hasDefaultValueInModel.value && !hasDefaultValueInRenderItems.value
})

watchEffect(() => {
  // 仅在默认筛选是 input 时同步 draft（用户输入过程中不抢占）
  if (defaultSchema.value?.type !== 'input')
    return
  if (isDefaultInputEditing.value)
    return
  defaultInputDraft.value = String((props.modelValue ?? {})[defaultSchema.value.field] ?? '')
})

function commitDefaultInput() {
  if (defaultSchema.value?.type !== 'input')
    return
  isDefaultInputEditing.value = false
  editingDefaultInline.value = false
  applyDefaultFilter(String(defaultInputDraft.value ?? '').trim())
}

const editing = ref<null | {
  itemId: string
  field: string
  value: string
}>(null)

const schemaMap = computed(() => {
  const map = new Map<string, SearchBoxSchema>()
  for (const schema of props.items ?? []) {
    map.set(schema.field, schema)
  }
  return map
})
const editingValueForPanel = computed(() => {
  if (!editing.value)
    return undefined
  const schema = schemaMap.value.get(editing.value.field)
  if (!schema)
    return undefined
  // repeatable custom：只编辑当前这一条
  if (schema.type === 'custom' && schema.repeatable) {
    return editing.value.value
  }
  // 其它情况：编辑整个 field
  return (props.modelValue ?? {})[schema.field]
})

watchEffect(() => {
  // 编辑弹窗关闭就清空编辑态
  if (!openEditorId.value) {
    editing.value = null
  }
})

function applyDefaultFilter(value: any) {
  const schema = defaultSchema.value
  if (!schema)
    return
  applyFieldValue(schema, value)
}

function openDefaultFilterPanel() {
  const schema = defaultSchema.value
  if (!schema)
    return
  store.onActiveSchema(schema)
  store.addBtnState.visible = true
}

const defaultToggleSchema = computed(() =>
  defaultSchema.value?.type === 'toggle'
    ? defaultSchema.value as ToggleSearchBoxSchema
    : undefined,
)
const defaultInputSchema = computed(() =>
  defaultSchema.value?.type === 'input'
    ? defaultSchema.value as InputSearchBoxSchema
    : undefined,
)
const defaultSingleSelectSchema = computed(() =>
  (defaultSchema.value?.type === 'select' && !defaultSchema.value.multiple)
    ? defaultSchema.value as SelectSearchBoxSchema
    : undefined,
)
const defaultSingleEnumSchema = computed(() =>
  (defaultSchema.value?.type === 'enum' && defaultSchema.value.mode !== 'multi')
    ? defaultSchema.value as EnumSearchBoxSchema
    : undefined,
)

function handleDefaultToggleClick() {
  const schema = defaultToggleSchema.value
  if (!schema)
    return
  if (schema.description) {
    openDefaultFilterPanel()
    return
  }
  applyDefaultFilter(!(props.modelValue ?? {})[schema.field])
}

function cloneModel(value: SearchBoxModelValue) {
  return JSON.parse(JSON.stringify(value ?? {})) as SearchBoxModelValue
}

function emitModel(next: SearchBoxModelValue, context: Parameters<SearchBoxBeforeUpdate>[2]) {
  const prev = cloneModel(props.modelValue ?? {})
  const nextCloned = cloneModel(next)
  const finalValue = props.beforeUpdate
    ? props.beforeUpdate(nextCloned, prev, context)
    : nextCloned

  emit('update:modelValue', cloneModel(finalValue))
  emit('change', cloneModel(finalValue), prev)
}

function normalizeToArray(value: any): string[] {
  if (Array.isArray(value))
    return value.map(v => String(v)).filter(Boolean)
  if (value === undefined || value === null)
    return []
  const s = String(value)
  return s ? [s] : []
}

function normalizeRenderValues(schema: SearchBoxSchema, value: any): string[] {
  if (schema.type === 'toggle')
    return normalizeToArray(value ? '是' : '')

  const keepsArrayShape
    = (schema.type === 'custom' && schema.repeatable)
      || (schema.type === 'enum' && schema.mode === 'multi')
      || (schema.type === 'select' && schema.multiple)

  return normalizeToArray(keepsArrayShape ? value : String(value ?? ''))
}

function normalizeFieldValue(schema: SearchBoxSchema, value: any) {
  if (schema.type === 'toggle')
    return Boolean(value)

  const keepsArrayShape
    = (schema.type === 'enum' && schema.mode === 'multi')
      || (schema.type === 'select' && schema.multiple)

  return keepsArrayShape ? normalizeToArray(value) : String(value ?? '')
}

interface RenderItem {
  id: string
  field: string
  value: string
}

function createId() {
  // 运行环境可能没有 crypto.randomUUID 的 polyfill，所以做个兜底
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toKey(field: string, value: string) {
  return `${field}::${value}`
}

const renderItems = ref<RenderItem[]>([])

function collectDesiredCounts(model: SearchBoxModelValue) {
  const counts = new Map<string, number>()

  for (const schema of props.items ?? []) {
    // default-filter-field 对应项在 inline 显示时，不参与 chips 渲染
    if (showDefaultInline.value && schema.field === defaultField.value)
      continue
    const raw = (model as any)?.[schema.field]

    if (schema.type === 'input') {
      const value = String(raw ?? '').trim()
      if (!value)
        continue
      const key = toKey(schema.field, value)
      counts.set(key, (counts.get(key) ?? 0) + 1)
      continue
    }

    if (schema.type === 'toggle' || schema.type === 'select' || schema.type === 'enum' || schema.type === 'custom') {
      const values = normalizeRenderValues(schema, raw)
      for (const v of values) {
        const key = toKey(schema.field, v)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      continue
    }
  }

  return counts
}

function syncRenderItemsFromModel() {
  // default-filter-field 对应项在 inline 显示时，不参与 chips 渲染
  if (showDefaultInline.value && defaultField.value) {
    renderItems.value = renderItems.value.filter(item => item.field !== defaultField.value)
  }

  const model = props.modelValue ?? {}
  const desired = collectDesiredCounts(model)

  // 1) 保留现有顺序，能匹配上的就留下（按次数）
  const nextItems: RenderItem[] = []
  for (const item of renderItems.value) {
    const key = toKey(item.field, item.value)
    const left = desired.get(key) ?? 0
    if (left <= 0)
      continue
    desired.set(key, left - 1)
    nextItems.push(item)
  }

  // 2) 把缺的补到末尾（按 schema 顺序补，避免完全随机）
  for (const schema of props.items ?? []) {
    // 遍历 desired 中属于这个 field 的 key
    for (const [key, left] of desired.entries()) {
      if (left <= 0)
        continue
      if (!key.startsWith(`${schema.field}::`))
        continue
      const value = key.slice(`${schema.field}::`.length)
      for (let i = 0; i < left; i++) {
        nextItems.push({ id: createId(), field: schema.field, value })
      }
      desired.set(key, 0)
    }
  }

  renderItems.value = nextItems
}

watchEffect(() => {
  // 当外部 modelValue / items 变化时，保证渲染列表能对齐（同时尽量保留当前顺序）
  syncRenderItemsFromModel()
})

const renderedList = computed(() => {
  return renderItems.value
    .map((item) => {
      const schema = schemaMap.value.get(item.field)
      if (!schema)
        return undefined
      if (showDefaultInline.value && schema.field === defaultField.value)
        return undefined
      return { ...item, schema }
    })
    .filter((item): item is (RenderItem & { schema: SearchBoxSchema }) => Boolean(item))
})

function applyFieldValue(schema: SearchBoxSchema, value: any) {
  const next = cloneModel(props.modelValue ?? {})

  if (schema.type === 'custom') {
    if (schema.repeatable) {
      const current = normalizeToArray(next[schema.field])
      const incoming = normalizeToArray(value)
      if (editing.value?.field === schema.field && editing.value?.itemId) {
        // 编辑某一条 repeatable：替换对应位置的值
        const sameFieldItems = renderItems.value.filter(i => i.field === schema.field)
        const occurrenceIndex = sameFieldItems.findIndex(i => i.id === editing.value?.itemId)
        const nextValue = incoming[0]
        if (occurrenceIndex >= 0 && nextValue) {
          const list = [...current]
          list[occurrenceIndex] = nextValue
          next[schema.field] = list
        }
        else if (occurrenceIndex >= 0 && !nextValue) {
          const list = [...current]
          list.splice(occurrenceIndex, 1)
          next[schema.field] = list
        }
        else {
          next[schema.field] = [...current, ...incoming]
        }
      }
      else {
        next[schema.field] = [...current, ...incoming]
      }
    }
    else {
      next[schema.field] = String(value ?? '')
    }
  }
  else {
    next[schema.field] = normalizeFieldValue(schema, value)
  }

  // 更新渲染数组（顺序即最终展示顺序）
  const incomingValues = normalizeRenderValues(schema, value)

  // default-filter-field：未设置时走 inline，不渲染 chip；
  // 一旦提交（回车/选择），这里需要生成 chip 并让 inline 消失。
  if (!(showDefaultInline.value && schema.field === defaultField.value)) {
    const existingIndices = renderItems.value
      .map((item, idx) => ({ item, idx }))
      .filter(x => x.item.field === schema.field)
      .map(x => x.idx)

    const hasMultipleValues
      = (schema.type === 'enum' && schema.mode === 'multi')
        || (schema.type === 'select' && schema.multiple)
        || (schema.type === 'custom' && schema.repeatable)

    // 1) repeatable + 编辑单条：原地改这个 chip
    if (schema.repeatable === true && editing.value?.field === schema.field && editing.value?.itemId) {
      const idx = renderItems.value.findIndex(i => i.id === editing.value?.itemId)
      const nextV = incomingValues.filter(Boolean)[0]
      if (idx >= 0 && nextV) {
        renderItems.value[idx] = { ...renderItems.value[idx], value: String(nextV) }
      }
      else if (idx >= 0 && !nextV) {
        renderItems.value.splice(idx, 1)
      }
    }
    // 2) 非 repeatable 字段：保持“原来的位置”，做就地替换（不会跑到最后）
    else if (schema.repeatable !== true) {
      const insertAt = existingIndices.length ? existingIndices[0] : renderItems.value.length
      // 移除旧的
      renderItems.value = renderItems.value.filter(item => item.field !== schema.field)
      // 插入新的（多值按顺序插）
      const nextValues = incomingValues.filter(Boolean)
      if (nextValues.length) {
        renderItems.value.splice(
          insertAt,
          0,
          ...nextValues.map(v => ({ id: createId(), field: schema.field, value: String(v) })),
        )
      }
    }
    // 3) repeatable 添加：追加到末尾
    else if (schema.repeatable === true && hasMultipleValues) {
      for (const v of incomingValues.filter(Boolean)) {
        renderItems.value.push({ id: createId(), field: schema.field, value: String(v) })
      }
    }
  }

  emitModel(next, { action: 'add' })
}

function removeRenderItem(payload: { id: string }) {
  const item = renderItems.value.find(x => x.id === payload.id)
  if (!item)
    return
  const schema = schemaMap.value.get(item.field)
  if (!schema)
    return

  const next = cloneModel(props.modelValue ?? {})
  if (schema.type === 'toggle') {
    next[schema.field] = false
  }
  else if (schema.type === 'enum' && schema.mode === 'multi') {
    const list = normalizeToArray(next[schema.field])
    const index = list.indexOf(item.value)
    if (index >= 0)
      list.splice(index, 1)
    next[schema.field] = list
  }
  else if (schema.type === 'select' && schema.multiple) {
    const list = normalizeToArray(next[schema.field])
    const index = list.indexOf(item.value)
    if (index >= 0)
      list.splice(index, 1)
    next[schema.field] = list
  }
  else if (schema.type === 'custom' && schema.repeatable) {
    const list = normalizeToArray(next[schema.field])
    const index = list.indexOf(item.value)
    if (index >= 0)
      list.splice(index, 1)
    next[schema.field] = list
  }
  else {
    delete next[schema.field]
  }

  renderItems.value = renderItems.value.filter(x => x.id !== payload.id)
  emitModel(next, { action: 'remove' })
}

function openChipEditor(payload: { id: string }) {
  const item = renderItems.value.find(x => x.id === payload.id)
  if (!item)
    return
  const schema = schemaMap.value.get(item.field)
  if (!schema)
    return

  // default-filter-field + input：点击 chip 进入 inline 编辑（chip 临时隐藏）
  if (schema.type === 'input' && schema.field === defaultField.value) {
    editingDefaultInline.value = true
    isDefaultInputEditing.value = true
    defaultInputDraft.value = item.value
    return
  }

  openEditorId.value = payload.id
  editing.value = { itemId: item.id, field: item.field, value: item.value }

  // 预填表单内容（input/select/enum 的二级面板会读 store.input）
  store.clearInput()
  if (schema.type === 'input') {
    store.input.value[schema.field] = item.value
  }
  else if (schema.type === 'select') {
    store.input.value[schema.field] = schema.multiple
      ? normalizeToArray((props.modelValue ?? {})[schema.field])
      : item.value
  }
  else if (schema.type === 'enum') {
    store.input.value[schema.field] = schema.mode === 'multi'
      ? normalizeToArray((props.modelValue ?? {})[schema.field])
      : item.value
  }
  else if (schema.type === 'toggle') {
    store.input.value[schema.field] = true
  }

  store.onActiveSchema(schema)
}

function closeChipEditor() {
  openEditorId.value = null
  store.clearInput()
  store.clearActiveSchema()
}

function confirmFromEditor(schema: SearchBoxSchema, value: any) {
  applyFieldValue(schema, value)
  closeChipEditor()
}
</script>

<template>
  <div class="flex items-center flex-wrap gap-2">
    <!-- 默认展示的筛选项（可为空） -->
    <div
      v-if="showDefaultInline"
      class="flex items-center gap-2"
    >
      <template v-if="defaultInputSchema">
        <Input
          class="h-7 min-w-56"
          :placeholder="defaultInputSchema.placeholder || defaultInputSchema.label"
          :model-value="defaultInputDraft"
          @update:model-value="(v) => { isDefaultInputEditing = true; defaultInputDraft = String(v ?? '') }"
          @keydown.enter.stop.prevent="commitDefaultInput"
          @blur="commitDefaultInput"
        />
      </template>
      <template v-else-if="defaultToggleSchema">
        <Button
          variant="outline"
          size="sm"
          class="h-7 px-2 text-xs font-normal"
          @click="handleDefaultToggleClick"
        >
          {{ defaultToggleSchema.label }}
        </Button>
      </template>
      <template v-else-if="defaultSingleSelectSchema">
        <Select
          :model-value="String((props.modelValue ?? {})[defaultSingleSelectSchema.field] ?? '')"
          @update:model-value="(v) => applyDefaultFilter(String(v ?? ''))"
        >
          <SelectTrigger class="h-7 min-w-44 text-xs">
            <SelectValue :placeholder="defaultSingleSelectSchema.placeholder || defaultSingleSelectSchema.label" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in defaultSingleSelectSchema.options"
              :key="String(opt.value ?? opt.label)"
              :value="String(opt.value ?? opt.label)"
              :disabled="opt.disabled"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </template>
      <template v-else-if="defaultSingleEnumSchema">
        <Select
          :model-value="String((props.modelValue ?? {})[defaultSingleEnumSchema.field] ?? '')"
          @update:model-value="(v) => applyDefaultFilter(String(v ?? ''))"
        >
          <SelectTrigger class="h-7 min-w-44 text-xs">
            <SelectValue :placeholder="defaultSingleEnumSchema.placeholder || defaultSingleEnumSchema.label" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in defaultSingleEnumSchema.options"
              :key="String(opt.value ?? opt.label)"
              :value="String(opt.value ?? opt.label)"
              :disabled="opt.disabled"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </template>
      <template v-else>
        <Button
          variant="outline"
          size="sm"
          class="h-7 px-2 text-xs font-normal"
          @click="openDefaultFilterPanel"
        >
          {{ defaultSchema?.label }}
        </Button>
      </template>
    </div>

    <SearchBoxTagList
      :items="renderedList"
      :open-editor-id="openEditorId"
      @remove-item="removeRenderItem"
      @open-editor="openChipEditor"
      @close-editor="closeChipEditor"
    >
      <template #tag="slotProps">
        <slot
          name="tag"
          v-bind="slotProps"
        />
      </template>
      <template #editor="{ schema, close }">
        <div class="space-y-2">
          <InputContent @confirm="(v) => confirmFromEditor(schema, v)" />
          <SelectContentPanel @confirm="(v) => confirmFromEditor(schema, v)" />
          <EnumContentPanel @confirm="(v) => confirmFromEditor(schema, v)" />
          <ToggleContentPanel @confirm="() => confirmFromEditor(schema, true)" />
          <div
            v-if="schema.type === 'toggle' && !(schema as any).description"
            class="flex justify-end"
          >
            <Button
              size="sm"
              class="h-7 px-3 text-xs font-normal"
              @click="confirmFromEditor(schema, false)"
            >
              关闭
            </Button>
          </div>
          <CustomContentPanel
            @confirm="(v) => confirmFromEditor(schema, v)"
            @cancel="close"
          >
            <template #default="slotProps">
              <slot
                :name="slotProps.schema.slotName ?? slotProps.schema.field"
                v-bind="{ ...slotProps, value: editingValueForPanel, modelValue: props.modelValue }"
              />
            </template>
          </CustomContentPanel>
        </div>
      </template>
    </SearchBoxTagList>

    <SearchBoxAddMenu
      :model-value="props.modelValue ?? {}"
      :exclude-fields="defaultField ? [defaultField] : []"
      :editing-value="editingValueForPanel"
      @confirm="({ schema, value }) => applyFieldValue(schema, value)"
    >
      <template #default="slotProps">
        <slot
          :name="slotProps.schema.slotName ?? slotProps.schema.field"
          v-bind="slotProps"
        />
      </template>
    </SearchBoxAddMenu>
  </div>
</template>

<style scoped></style>
