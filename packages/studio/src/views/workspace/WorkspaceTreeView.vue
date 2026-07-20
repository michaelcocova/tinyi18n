<script setup lang="ts">
import type { VirtualizerProps } from 'virtua/vue'
import type { WorkspaceTreeRow, WorkspaceViewModel } from './useWorkspace'
import type { In18MessageNode } from '@/workers/i18n-messages.worker'
import { Grid2x2Plus, ListChevronsDownUp, ListChevronsUpDown, Plus } from '@lucide/vue'
import { Virtualizer } from 'virtua/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ScrollArea from '@/components/ui/scroll-area/ScrollArea.vue'
import WorkspaceTreeNode from './WorkspaceTreeNode.vue'

const props = defineProps<{
  workspace: WorkspaceViewModel
}>()

const virtualizerRef = ref<InstanceType<typeof Virtualizer>>()
const scrollAreaRef = ref<InstanceType<typeof ScrollArea> | null>(null)
const scrollViewportEl = ref<HTMLElement>()
const viewportScrollTop = ref(0)
let removeViewportScrollListener: (() => void) | null = null

// VSCode sticky scroll 风格：顶部悬浮的“祖先 group 链”
const stickyGroups = ref<In18MessageNode[]>([])
const stickyRows = computed<WorkspaceTreeRow[]>(() => {
  return stickyGroups.value.map((node, depth) => ({
    type: 'node',
    key: `sticky::${node.id}`,
    node,
    depth,
    isLast: true,
  }))
})
function updateStickyGroups() {
  const rows = props.workspace.decoratedItems.value
  const virtualizer = virtualizerRef.value
  if (!rows.length || !virtualizer?.findItemIndex) {
    stickyGroups.value = []
    return
  }

  const startIndex = Math.max(0, virtualizer.findItemIndex(viewportScrollTop.value))
  const currentRow = rows[startIndex]
  if (!currentRow) {
    stickyGroups.value = []
    return
  }

  const nodeById = new Map(props.workspace.items.value.map(node => [node.id, node]))

  let ids: string[] = []

  if (currentRow.type === 'node') {
    ids = currentRow.node.chain.split(',').filter(Boolean)
  }
  else if (currentRow.parentId) {
    const parent = nodeById.get(currentRow.parentId)
    if (parent) {
      ids = parent.chain.split(',').filter(Boolean)
      ids.push(parent.id)
    }
  }

  stickyGroups.value = ids
    .map(id => nodeById.get(id))
    .filter((node): node is In18MessageNode => Boolean(node && node.type === 'group'))
}

function jumpToNode(nodeId: string) {
  const index = props.workspace.findNodeIndex(nodeId)
  if (index < 0) {
    return
  }
  virtualizerRef.value?.scrollToIndex(index, { align: 'start', smooth: true })
}

function bindScrollAreaViewport() {
  removeViewportScrollListener?.()
  removeViewportScrollListener = null

  const rootEl = scrollAreaRef.value?.$el as HTMLElement | undefined
  const viewportEl = rootEl?.querySelector?.('[data-slot="scroll-area-viewport"]') as HTMLElement | null
  if (!viewportEl) {
    scrollViewportEl.value = undefined
    return
  }

  scrollViewportEl.value = viewportEl

  const handleScroll = () => {
    viewportScrollTop.value = viewportEl.scrollTop
    updateStickyGroups()
  }

  viewportScrollTop.value = viewportEl.scrollTop
  viewportEl.addEventListener('scroll', handleScroll, { passive: true })
  removeViewportScrollListener = () => {
    viewportEl.removeEventListener('scroll', handleScroll)
  }
}

onMounted(async () => {
  await nextTick()
  bindScrollAreaViewport()
  updateStickyGroups()
})

onBeforeUnmount(() => {
  removeViewportScrollListener?.()
  removeViewportScrollListener = null
})

watch(() => props.workspace.pendingScrollNodeId.value, async (nodeId) => {
  if (!nodeId) {
    return
  }

  await nextTick()
  const scrollIndex = props.workspace.findNodeIndex(nodeId)
  if (scrollIndex >= 0) {
    virtualizerRef.value?.scrollToIndex(scrollIndex, {
      align: 'center',
      smooth: true,
    })
  }
  props.workspace.consumePendingScrollNodeId()
})

watch(
  () => [props.workspace.decoratedItems.value, props.workspace.expandedKeys.value],
  async () => {
    await nextTick()
    bindScrollAreaViewport()
    updateStickyGroups()
  },
  { deep: true, immediate: true },
)

type ItemProps = VirtualizerProps<import('./useWorkspace').WorkspaceTreeRow>['itemProps']
const itemProps: ItemProps = ({ item }) => {
  return {
    'data-row': item.depth,
    'data-status': item.type === 'node' && props?.workspace?.isSelected?.(item.node.id) ? 'selected' : undefined,
  }
}
const buttons = [
  { label: '全部折叠', icon: ListChevronsDownUp, command: () => props?.workspace?.toggleExpandedAll?.(false) },
  { label: '全部展开', icon: ListChevronsUpDown, command: () => props?.workspace?.toggleExpandedAll?.(true) },
  { label: '新增分组', class: 'ml-auto', icon: Grid2x2Plus, command: () => props?.workspace?.createGroup?.() },
  { label: '新增词条', icon: Plus, command: () => props?.workspace?.createMessage?.() },
]

function handleRowClick(item: WorkspaceTreeRow, sticky: boolean = false) {
  if (item.type === 'empty') {
    return
  }
  props?.workspace?.toggleSelected?.(item.node.id)
  if (sticky) {
    jumpToNode(item.node.id)
  }
}

</script>

<template>
  <div
    class="h-full group/library flex flex-col overflow-hidden [--indent-width:calc(--spacing(3.5))] [--row-height:calc(--spacing(8))] z-10"
  >
    <header class="group/header relative z-21 bg-background p-1 flex items-center gap-1 border-b text-muted-foreground text-xs">
      <TooltipProvider>
        <Tooltip
          v-for="item in buttons"
          :key="item.label"
        >
          <TooltipTrigger as-child>
            <InputGroupButton
              :aria-label="item.label"
              :title="item.label"
              size="icon-xs"
              :class="cn(item?.class)"
              @click.stop.prevent="item.command()"
            >
              <component
                :is="item.icon"
                class="size-3"
              />
            </InputGroupButton>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{{ item.label }}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </header>
    <nav
      :class="cn([
        'opacity-0 overflow-hidden z-20 px-2 relative transition-[height,opacity] duration-100 ease-out',
        `h-[calc(var(--row-height) * ${stickyRows.length})]`,
      ], {
        'py-1 opacity-100 border-b shadow-[0_0_10px_rgba(0,0,0,0.1)]': stickyRows.length,
      })"
    >
      <WorkspaceTreeNode
        v-for="row in stickyRows"
        :key="row.key"
        :row="row"
        :workspace="workspace"
        @click="handleRowClick(row, true)"
      />
    </nav>
    <section class="flex-1 overflow-hidden backdrop-blur-sm">
      <ScrollArea
        ref="scrollAreaRef"
        class="h-full overflow-y-auto px-2"
      >
        <Virtualizer
          ref="virtualizerRef"
          v-slot="{ item: row, index }"
          :scroll-ref="scrollViewportEl"
          :data="workspace.decoratedItems.value"
          :item-props="itemProps"
          class="h-full"
        >
          <WorkspaceTreeNode
            :key="row.key"
            :class="{
              'mt-1': index === 0,
            }"
            :row="row"
            :workspace="workspace"
            @click="handleRowClick(row)"
          />
        </Virtualizer>
      </ScrollArea>
    </section>
  </div>
</template>
