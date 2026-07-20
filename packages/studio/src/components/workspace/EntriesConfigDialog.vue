<script setup lang="ts">
import { ChevronDown, Plus, Settings2, Trash2 } from '@lucide/vue'
import { toTypedSchema } from '@vee-validate/zod'
import { useFieldArray, useForm } from 'vee-validate'
import { computed, ref, watch } from 'vue'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWorkspace } from '@/composables/workspace/useWorkspace'
import { toast } from '@/utils/toast'

const open = defineModel<boolean>('open', { default: false })

const globalWorkspace = useWorkspace()
const config = computed(() => globalWorkspace.config.value)
const isMulti = computed(() => config.value?.mode === 'multi')

const isSaving = ref(false)
const error = ref('')

const schema = toTypedSchema(z.object({
  entries: z.array(z.object({
    dir: z.string().default(''),
    // 保留 namespace 字段用于"读-改-写"不丢数据，但 UI 不提供编辑入口
    namespaces: z.union([z.string(), z.array(z.string())]).optional(),
    paths: z.array(z.string()).default([]),
  }).superRefine((entry, ctx) => {
    const dirEmpty = entry.dir.trim() === ''
    const pathsEmpty = entry.paths.length === 0

    // 两者都为空，视为空记录，允许存在（用于表单空行）
    if (dirEmpty && pathsEmpty) {
      return
    }

    if (dirEmpty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dir'],
        message: '目录不能为空',
      })
    }

    if (pathsEmpty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paths'],
        message: '至少需要一个路径',
      })
    }
  })).default([]),
}))

const form = useForm({
  validationSchema: schema,
  validateOnMount: false,
  initialValues: {
    entries: [{ dir: '', paths: [] as string[] }],
  },
})

const { fields: customEntries, push: addEntry, remove: removeEntry } = useFieldArray('entries')

function parsePaths(val: string | number) {
  if (!val) {
    return []
  }
  return val
    .toString()
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function normalizeEntries(entries: any[] = []) {
  return entries
    .filter(entry => entry?.dir && String(entry.dir).trim() !== '')
    .map(entry => ({
      dir: String(entry.dir),
      namespaces: entry.namespaces,
      paths: (entry.paths || []).filter((p: string) => String(p).trim() !== ''),
    } satisfies TinyI18nEntryConfig))
}

function resetFormFromConfig() {
  error.value = ''
  const entries = config.value?.entries ?? []
  form.resetForm({
    values: {
      entries: entries.length
        ? entries.map(e => ({
            dir: e.dir ?? '',
            namespaces: e.namespaces,
            paths: Array.isArray(e.paths) ? e.paths : [],
          }))
        : [{ dir: '', paths: [] }],
    },
  })
}

watch(open, (v) => {
  if (v) {
    resetFormFromConfig()
  }
})
watch(config, (v) => {
  if (v && open.value) {
    resetFormFromConfig()
  }
})

const onSubmit = form.handleSubmit(async (values) => {
  const baseConfig = config.value
  if (!baseConfig) {
    error.value = '当前未加载到 config，无法保存。'
    toast.error(error.value)
    return
  }

  error.value = ''
  isSaving.value = true
  try {
    const entries = normalizeEntries(values.entries)

    // 只能改 entries：拷贝现有 config，仅替换 entries
    const nextConfig = JSON.parse(JSON.stringify(baseConfig)) as TinyI18nConfig
    if (entries.length > 0) {
      nextConfig.entries = entries
    }
    else {
      delete (nextConfig as any).entries
    }

    const resp = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextConfig),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(text || `保存失败：${resp.status}`)
    }
    await resp.json().catch(() => null)
    // 保存后自动同步生成输出文件
    await fetch('/api/data/sync', { method: 'POST' }).catch(() => {})
    await globalWorkspace.refreshAll(true)
    open.value = false
    toast.success('Entries 已保存并同步')
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    error.value = message
    toast.error(message)
  }
  finally {
    isSaving.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>源码入口配置（Entries）</DialogTitle>
        <DialogDescription>
          这里只能编辑 `entries`，其它配置将保持不变。
        </DialogDescription>
      </DialogHeader>

      <form
        class="space-y-3"
        @submit.prevent="onSubmit"
      >
        <div class="flex items-center gap-2">
          <Settings2 class="size-4 text-muted-foreground" />
          <Label class="text-sm font-medium">源码入口配置 (Entries)</Label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            class="ml-auto"
            @click="addEntry({ dir: '', paths: [] })"
          >
            <Plus class="size-4" />
            新增
          </Button>
        </div>
        <Collapsible
          v-for="(entrie, idx) in customEntries"
          :key="entrie.key"
        >
          <header>
            <FormField
              v-slot="{ componentField }"
              :name="`entries[${idx}].dir`"
            >
              <FormItem>
                <FormControl>
                  <InputGroup>
                    <InputGroupInput
                      v-bind="componentField"
                      placeholder="src/locales"
                    />
                    <InputGroupAddon align="inline-end">
                      <CollapsibleTrigger as-child>
                        <InputGroupButton
                          type="button"
                          size="icon-xs"
                          class="data-[state=open]:rotate-180 data-[state=open]:bg-accent"
                        >
                          <ChevronDown />
                        </InputGroupButton>
                      </CollapsibleTrigger>
                    </InputGroupAddon>
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </header>
          <CollapsibleContent class="flex flex-col gap-4 pt-4 pl-3">
            <FormField
              v-if="isMulti"
              v-slot="{ componentField, handleChange }"
              :name="`entries[${idx}].namespaces`"
            >
              <FormItem>
                <FormLabel>
                  命名空间 (Namespace)
                </FormLabel>
                <FormControl>
                  <Input
                    :model-value="(componentField.modelValue || []).join(', ')"
                    placeholder="shared"
                    @update:model-value="handleChange(parsePaths($event))"
                  />
                </FormControl>
                <FormDescription>
                  选择需要包含的命名空间，多个用逗号分隔
                </FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>
            <FormField
              v-slot="{ componentField, handleChange }"
              :name="`entries[${idx}].paths`"
            >
              <FormItem>
                <FormLabel>路径(Paths)</FormLabel>
                <FormControl>
                  <Input
                    :model-value="(componentField.modelValue || []).join(', ')"
                    placeholder="common, home"
                    @update:model-value="handleChange(parsePaths($event))"
                  />
                </FormControl>
                <FormDescription>
                  按路径前缀筛选词条，多个用逗号分隔，以 ! 开头排除
                </FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>
          </CollapsibleContent>
        </Collapsible>
        <div
          v-if="error"
          class="text-xs text-destructive"
        >
          {{ error }}
        </div>

        <DialogFooter class="pt-1">
          <DialogClose as-child>
            <Button
              type="button"
              variant="secondary"
              :disabled="isSaving"
            >
              取消
            </Button>
          </DialogClose>
          <button
            type="submit"
            :disabled="isSaving"
            class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 shadow-xs bg-primary text-primary-foreground hover:bg-primary/80 h-9 px-4 py-2"
          >
            保存并同步到 config.yaml
          </button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
