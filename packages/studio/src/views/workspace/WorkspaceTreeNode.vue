<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { WorkspaceTreeRow, WorkspaceViewModel } from './useWorkspace'
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronRight, Grid2x2Plus, Group, Languages, ListEnd, ListPlus, ListStart, Plus, SquareDashedText, Trash2 } from '@lucide/vue'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import {
  NumberField,
  NumberFieldContent,
  NumberFieldInput,
} from '@/components/ui/number-field'
import { cn } from '@/utils/tailwind'

const props = defineProps<{
  row: WorkspaceTreeRow
  workspace: WorkspaceViewModel
}>()

function isMissingKeyRow() {
  if (props.row.type !== 'node') {
    return false
  }
  return String(props.row.node.original.key ?? '').trim() === ''
}

const NumberInput = defineComponent({
  props: {
    class: {
      type: String as PropType<HTMLAttributes['class']>,
      default: '',
    },
    modelValue: {
      type: Number,
      default: 1,
    },
  },
  emits: {
    'update:modelValue': (_value: number) => true,
  },
  setup(props, { emit }) {
    return () => h(
      NumberField,
      {
        'defaultValue': 1,
        'min': 1,
        'max': 99,
        'step': 1,
        'modelValue': props.modelValue,
        'onUpdate:modelValue': (value: number) => emit('update:modelValue', value),
        'stepSnapping': true,
        'class': cn('ml-auto w-10 text-xs shadow-none flex items-center', props.class),
        'onInput': (e: Event) => {
          const target = e.target as HTMLInputElement | null
          if (target && Number(target.value) > 99) {
            target.value = '99'
          }
        },
        'onClick': (e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
        },
      },
      {
        default: () => [
          h(NumberFieldContent, () => [
            h(NumberFieldInput, {
              class: 'h-6 py-0 shadow-none focus-visible:ring-0 text-xs focus-visible:border-slate-400',
            }),
          ]),
        ],
      },
    )
  },
})

const beforeValue = ref(1)
const afterValue = ref(1)
const insideValue = ref(1)

function onContextMenuOpenChange(open: boolean) {
  if (open) {
    beforeValue.value = 1
    afterValue.value = 1
    insideValue.value = 1
  }
}

function handleCreate(type: 'group' | 'message', position: 'before' | 'after' | 'inside', count: number = 1) {
  const row = props.row
  if (row.type !== 'node')
    return

  const node = row.node
  const w = props.workspace

  if (position === 'inside') {
    if (node.type !== 'group')
      return
    w.toggleExpanded(node.id, true)
    if (type === 'group') {
      w.createGroup(node)
    }
    else {
      w.createChildMessages(node, count)
    }
    return
  }

  // before / after — 同级插入
  if (type === 'group') {
    w.insertSiblingGroup(node, position)
  }
  else {
    w.insertSiblingMessages(node, position, count)
  }
}
</script>

<template>
  <ContextMenu @update:open="onContextMenuOpenChange">
    <ContextMenuTrigger as-child>
      <div
        :class="cn([
          'group/row relative flex items-center gap-1',
          'h-(--row-height) rounded px-2 bg-background',
          'text-sm select-none cursor-pointer',
          'ring ring-inset ring-px ring-transparent',
          'data-[state=open]:bg-primary/20 data-[state=open]:ring-primary',
        ], {
          'hover:bg-muted': row.type === 'node',
          'bg-primary/20!': row.type === 'node' && workspace?.isSelected?.(row.node.id),
          'text-muted-foreground h-auto': row.type === 'empty',
          'z-2026': row.type === 'node' && row.node.type === 'group',
        })"
        @click="row.type === 'node' && workspace.toggleSelected?.(row.node.id)"
      >
        <div
          data-slot="node-indent"
          class="flex items-stretch gap-2 h-(--row-height)"
        >
          <span
            v-for="(i, idx) in row.depth"
            :key="`indent-block-${i}`"
            data-slot="indent-block"
            :class="cn('border-l shrink-0 h-full w-(--indent-width)', {
              'ml-2': idx === 0,
            })"
          />
        </div>

        <button
          v-if="row.type === 'node' && row.node.type === 'group'"
          class="inline-flex items-center justify-center size-4 rounded hover:bg-muted"
          @click.stop="workspace.toggleExpanded(row.node.id)"
        >
          <ChevronDown
            v-if="workspace.isExpanded(row.node.id)"
            class="size-3"
          />
          <ChevronRight
            v-else
            class="size-3"
          />
        </button>
        <span
          v-else
          class="inline-flex size-4"
        />

        <component
          :is="row.type === 'node' && row.node.type === 'group' ? Group : Languages"
          v-if="row.type === 'node'"
          class="size-3"
        />
        <span
          v-else
          class="inline-flex size-3"
        />

        <button
          v-if="row.type === 'empty'"
          data-slot="node-content"
          class="py-1.5 truncate flex-1 text-left text-xs"
          variant="secondary"
        >
          当前分组下暂无翻译词条
        </button>
        <span
          v-else-if="row.type === 'node' && row.node.type === 'group'"
          data-slot="node-content"
          class="py-1.5 font-medium truncate"
        >
          {{ workspace.getGroupTitle(row.node.original) }}
        </span>
        <span
          v-else-if="row.type === 'node'"
          data-slot="node-content"
          class="py-1.5 font-medium truncate"
        >
          {{ row.node.original.key }}
        </span>

        <span
          v-if="row.type === 'node' && isMissingKeyRow()"
          class="text-destructive text-xs"
        >
          未定义 Key
        </span>
        <div
          v-if="row.type === 'node'"
          class="ml-auto opacity-0 pointer-events-none group-hover/row:opacity-100 group-hover/row:pointer-events-auto"
        >
          <template v-if="row.node.type === 'group'">
            <Button
              size="icon-xs"
              variant="ghost"
              @click.stop.prevent="workspace.createMessage(row.node)"
            >
              <Plus :stroke-width="2.5" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              @click.stop.prevent="workspace.createGroup(row.node)"
            >
              <Grid2x2Plus
                class="size-3"
                :stroke-width="2.5"
              />
            </Button>
          </template>
          <Button
            size="icon-xs"
            variant="ghost"
            @click.stop.prevent="workspace.handleDeleteNode(row.node)"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent class="min-w-54">
      <!-- 当前只有 Group 有 点击往子节点末尾追加 insideValue 条词条 -->
      <template v-if="row.type === 'node' && row.node.type === 'group'">
        <ContextMenuItem
          class="text-xs"
          @click="handleCreate('group', 'before')"
        >
          <ListStart />
          上方插入分组
        </ContextMenuItem>
        <ContextMenuItem
          class="text-xs"
          @click="handleCreate('group', 'after')"
        >
          <ListEnd />
          下方插入分组
        </ContextMenuItem>
        <ContextMenuItem
          class="text-xs"
          @click="handleCreate('group', 'inside')"
        >
          <ListPlus />
          插入子分组
        </ContextMenuItem>

        <ContextMenuItem
          class="text-xs"
          @click="handleCreate('message', 'inside', insideValue)"
        >
          <SquareDashedText />
          插入词条
          <!-- insideValue 每次打开都从 0 开始 -->
          <NumberInput
            v-model="insideValue"
          />
        </ContextMenuItem>
        <ContextMenuSeparator />
      </template>
      <template v-if="row.type === 'node' && row.node.type === 'message'">
        <ContextMenuItem
          class="text-xs"
          @click="handleCreate('message', 'before', beforeValue)"
        >
          <ArrowUpToLine />
          上方插入词条
          <!-- beforeValue 每次打开都从 0 开始 -->
          <NumberInput
            v-model="beforeValue"
          />
        </ContextMenuItem>
        <ContextMenuItem
          class="text-xs"
          @click="handleCreate('message', 'after', afterValue)"
        >
          <ArrowDownToLine />
          下方插入词条
          <!-- afterValue 每次打开都从 0 开始 -->
          <NumberInput
            v-model="afterValue"
          />
        </ContextMenuItem>
        <ContextMenuSeparator />
      </template>
      <ContextMenuItem
        variant="destructive"
        class="text-destructive text-xs"
        @click="row.type === 'node' && workspace.handleDeleteNode(row.node)"
      >
        <Trash2 />
        删除
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
