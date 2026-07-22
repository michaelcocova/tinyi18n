<script setup lang="ts">
import { ChevronDown, Save, Search } from '@lucide/vue'
import { useEventListener } from '@vueuse/core'

import { useMessageTree } from '@/composables/workspace/useMessageTree'
import { useTranslationEditor } from '@/composables/workspace/useTranslationEditor'
import DropdownMenuItem from '../ui/dropdown-menu/DropdownMenuItem.vue'

const { activeNamespace, searchKeyword, rootNamespaces } = useMessageTree()

const { saveImmediate } = useTranslationEditor()

function onSave() {
  saveImmediate()
  toast?.dismiss?.()
  toast.success('保存成功')
}
function blockSave(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    onSave()
  }
}
useEventListener('keydown', blockSave, { capture: true })
</script>

<template>
  <header class="flex shrink-0 items-center gap-2 px-4 py-2 select-none border-b">
    <div class="inline-flex items-center gap-2 bg-primary text-primary-foreground px-2 py-1 rounded-md">
      <span class="relative text-sm inline-flex bg-white rounded"><span class="relative text-primary font-bold px-1 py-0.5">Tiny I18n</span></span>
      <span>Studio</span>
    </div>
    <Separator
      orientation="vertical"
      class="data-[orientation=vertical]:h-4"
    />
    <InputGroup class="shadow-none max-w-md h-8">
      <InputGroupInput
        :model-value="searchKeyword"
        class="text-xs placeholder:text-xs"
        placeholder="key,翻译字段搜索"
        @update:model-value="searchKeyword = $event"
      />
      <InputGroupAddon class="[--radius:0.75rem]">
        <Search class="size-3.5" />
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <InputGroupButton
              variant="ghost"
              class="pr-1.5 text-xs"
            >
              {{ activeNamespace === '__all__' ? '全部' : rootNamespaces.find((n: any) => n.path === activeNamespace)?.key || '已选择命名空间' }}
              <ChevronDown class="size-3" />
            </InputGroupButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
          >
            <DropdownMenuLabel class="text-xs font-normal text-muted-foreground font-mono">
              命名空间
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="text-xs font-normal cursor-pointer data-[state=activated]:bg-accent"
              value="__all__"
              :data-state="activeNamespace === '__all__' ? 'activated' : undefined"
              :model-value="activeNamespace === '__all__'"
              @select="activeNamespace = '__all__'"
            >
              全部
            </DropdownMenuItem>
            <DropdownMenuItem
              v-for="ns in rootNamespaces"
              :key="ns.path"
              :data-state="activeNamespace === ns.path ? 'activated' : undefined"
              class="text-xs font-normal cursor-pointer data-[state=activated]:bg-accent"
              :value="ns.path"
              @select="activeNamespace = ns.path"
            >
              {{ ns.key }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>
    </InputGroup>
    <div class="ml-auto" />
    <Button
      variant="ghost"
      size="icon-sm"
      @click="onSave"
    >
      <Save />
    </Button>
  </header>
</template>
