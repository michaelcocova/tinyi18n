<script setup lang="ts">
import { ArrowBigDownDash, ChevronDown, RefreshCcw, Search, Settings2 } from '@lucide/vue'
import { find } from 'lodash-es'
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import EntriesConfigDialog from '@/components/workspace/EntriesConfigDialog.vue'
import { useWorkspace } from '@/composables/workspace/useWorkspace'
import { useWorkspaceView } from '@/views/workspace/useWorkspace'
import { useProjectFileSync } from '../../composables/commands/useProjectFileSync'

defineEmits<{
  refresh: []
}>()

const { config, namespaces, activeNamespace } = useWorkspace()
const { isSyncing, sync } = useProjectFileSync()
const currentNamespace = computed(() => find(namespaces.value, { key: activeNamespace.value }))

const entriesDialogOpen = ref(false)

const route = useRoute()
const workspaceView = useWorkspaceView()
const showWorkspaceSearch = computed(() =>
  route.name === 'dashboard' || route.name === 'translations',
)
</script>

<template>
  <header class="flex shrink-0 items-center gap-2 px-4 py-2 select-none">
    <div class="inline-flex items-center gap-2 bg-primary text-primary-foreground px-2 py-1 rounded-md">
      <span class="relative text-sm inline-flex bg-white rounded">
        <span class="relative text-primary font-bold px-1 py-0.5 dark:text-gray-950">
          Tiny I18n
        </span>
      </span>
      <span>
        Studio
      </span>
    </div>
    <template v-if="config?.mode === 'multi'">
      <Separator
        orientation="vertical"
        class="data-[orientation=vertical]:h-4"
      />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Badge
            as="button"
            variant="info"
            class="text-xs font-normal cursor-pointer"
          >
            <template v-if="currentNamespace?.key">
              {{ [currentNamespace?.key, currentNamespace?.description].filter(Boolean).join(' - ') }}
            </template>
            <template v-else>
              -
            </template>
            <ChevronDown class="size-3" />
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="start"
        >
          <DropdownMenuLabel class="text-xs font-normal text-muted-foreground font-mono">
            命名空间
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            v-for="namespace in namespaces"
            :key="namespace.key"
            class="text-xs font-normal cursor-pointer"
            :value="namespace.key"
            :model-value="namespace.key === activeNamespace"
            @select="activeNamespace = namespace.key"
          >
            {{ [namespace.key, namespace.description].filter(Boolean).join(' - ') }}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <!-- <Tabs v-model:model-value="activeNamespace">
        <TabsList>
          <TabsTrigger
            v-for="namespace in namespaces"
            :key="namespace.key"
            class="text-xs font-normal"
            :value="namespace.key"
          >
            {{ namespace.description || namespace.key }}
          </TabsTrigger>
        </TabsList>
      </Tabs> -->
    </template>
    <template v-if="showWorkspaceSearch">
      <Separator
        orientation="vertical"
        class="data-[orientation=vertical]:h-4"
      />
      <InputGroup class="shadow-none max-w-md h-8">
        <InputGroupInput
          class="text-xs placeholder:text-xs"
          :model-value="workspaceView.keywords.value"
          placeholder="搜索 key / path / label / 翻译内容"
          @update:model-value="workspaceView.setKeywords(String($event))"
        />

        <InputGroupAddon>
          <Search class="size-3.5" />
        </InputGroupAddon>
      </InputGroup>
    </template>
    <div class="ml-auto" />
    <!-- 刷新 -->
    <Button
      variant="ghost"
      size="icon-sm"
      @click="$emit('refresh')"
    >
      <RefreshCcw />
    </Button>
    <!-- 生成到项目文件 -->
    <Button
      variant="ghost"
      size="icon-sm"
      :disabled="isSyncing"
      :title="isSyncing ? '正在生成项目文件' : '生成到项目文件'"
      @click="sync"
    >
      <ArrowBigDownDash />
    </Button>
    <!-- Entries 配置 -->
    <Button
      variant="ghost"
      size="icon-sm"
      title="源码入口配置（Entries）"
      @click="entriesDialogOpen = true"
    >
      <Settings2 />
    </Button>

    <EntriesConfigDialog v-model:open="entriesDialogOpen" />
  </header>
</template>
