<script setup lang="ts">
import {
  Globe,
  Languages,
  Plus,
  Trash2,
} from '@lucide/vue'
import { useField, useFieldArray, useFormValues } from 'vee-validate'
import SearchableSelect from '@/components/SearchableSelect.vue'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { languageOptions } from '@/constants/language'

defineProps<{
  isSubmitting: boolean
}>()

defineEmits<{
  (e: 'submit', payload: Event): void
}>()

const values = useFormValues()
const { errorMessage: namespacesError } = useField('namespaces')
const { value: mode } = useField<'single' | 'multi'>('mode')

const {
  fields: customNamespaces,
  push: addNamespace,
  remove: removeNamespace,
} = useFieldArray('namespaces')
const {
  fields: customLocales,
  push: addLocale,
  remove: removeLocale,
} = useFieldArray('locales')

</script>

<template>
  <form
    class="space-y-6 mt-6"
    @submit.prevent="$emit('submit', $event)"
  >
    <FormItem>
      <div class="flex items-center gap-2">
        <Globe class="size-5 text-zinc-400" />
        <Label class="text-sm font-medium">命名空间模式</Label>
      </div>
      <FormControl>
        <Tabs v-model="mode">
          <TabsList class="max-w-md">
            <TabsTrigger value="single">
              单命名空间
            </TabsTrigger>
            <TabsTrigger value="multi">
              多命名空间
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </FormControl>
    </FormItem>
    <div>
      <div
        v-if="mode === 'multi'"
        class="group flex flex-col gap-1"
      >
        <div class="flex items-center gap-2">
          <Globe class="size-5 text-zinc-400" />
          <Label class="text-sm font-medium">命名空间配置 (Namespaces)</Label>
          <Button
            type="button"
            class="transition-opacity duration-150 opacity-0 group-hover:opacity-100 ml-auto"
            variant="ghost"
            size="icon-sm"
            @click="addNamespace({ key: '', description: '' })"
          >
            <Plus class="size-4" />
          </Button>
        </div>
        <table class="w-full table-fixed">
          <colgroup>
            <col>
            <col>
            <col class="w-10">
          </colgroup>
          <thead>
            <tr class="text-left text-xs font-medium text-zinc-500">
              <th class="pb-2 pr-2 font-normal">
                Namespace Key
              </th>
              <th class="pb-2 px-2 font-normal">
                描述 (Description)
              </th>
              <th class="pb-2" />
            </tr>
          </thead>
          <tbody class="[&_td]:align-top [&_td]:px-1 [&_td]:pb-6">
            <tr
              v-for="(field, idx) in customNamespaces"
              :key="field.key"
            >
              <td class="pr-2 pb-3 align-top">
                <FormField
                  v-slot="{ componentField }"
                  :name="`namespaces[${idx}].key`"
                >
                  <FormItem>
                    <FormControl>
                      <Input
                        v-bind="componentField"
                        placeholder="default"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
              </td>
              <td class="px-2 pb-3 align-top">
                <FormField
                  v-slot="{ componentField }"
                  :name="`namespaces[${idx}].description`"
                >
                  <FormItem>
                    <FormControl>
                      <Input
                        v-bind="componentField"
                        placeholder="例如：公共文案"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
              </td>
              <td class="pl-2 pb-3 align-top pt-0.5">
                <Button
                  v-if="idx > 0 || customNamespaces.length > 1"
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="text-zinc-400 hover:text-destructive"
                  :disabled="customNamespaces.length === 1"
                  @click="removeNamespace(idx)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="namespacesError"
          class="text-xs text-destructive"
        >
          {{ namespacesError }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Languages class="size-5 text-zinc-400" />
        <Label class="text-sm font-medium">多语言配置 (Locales)</Label>
        <Button
          type="button"
          class="transition-opacity duration-150 opacity-0 group-hover:opacity-100 ml-auto"
          variant="ghost"
          size="icon-sm"
          @click="addLocale({ code: '', filename: '' })"
        >
          <Plus class="size-4" />
        </Button>
      </div>
      <table class="w-full table-fixed">
        <colgroup>
          <col>
          <col>
          <col class="w-10">
        </colgroup>
        <thead>
          <tr class="text-left text-xs font-medium text-zinc-500">
            <th class="pb-2 pr-2 font-normal">
              语言 (Language)
            </th>
            <th class="pb-2 px-2 font-normal">
              输出文件名 (可选)
            </th>
            <th class="pb-2" />
          </tr>
        </thead>
        <tbody class="[&_td]:align-top [&_td]:px-1 [&_td]:pb-6">
          <tr
            v-for="(field, idx) in customLocales"
            :key="field.key"
          >
            <td class="pr-2 pb-3 align-top">
              <FormField
                v-slot="{ componentField }"
                :name="`locales[${idx}].code`"
              >
                <FormItem>
                  <FormControl>
                    <SearchableSelect
                      v-bind="componentField"
                      :options="languageOptions"
                      :search-fields="['value', 'label']"
                      placeholder="搜索或选择语言"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </td>
            <td class="px-2 pb-3 align-top">
              <FormField
                v-slot="{ componentField }"
                :name="`locales[${idx}].filename`"
              >
                <FormItem>
                  <FormControl>
                    <Input
                      v-bind="componentField"
                      :placeholder="
                        (values.locales || [])[idx]?.code
                          ? `${(values.locales || [])[idx].code}.yaml`
                          : ''
                      "
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </td>
            <td class="pl-2 pb-3 align-top pt-0.5">
              <Button
                v-if="idx > 0 || customLocales.length > 1"
                type="button"
                variant="ghost"
                size="icon"
                class="text-zinc-400 hover:text-destructive"
                :disabled="customLocales.length === 1"
                @click="removeLocale(idx)"
              >
                <Trash2 class="size-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Button
      type="submit"
      size="lg"
      class="w-full h-10"
      :disabled="isSubmitting"
    >
      <Globe class="size-4 mr-2" />
      {{ isSubmitting ? "初始化中..." : "生成配置文件并初始化" }}
    </Button>
  </form>
</template>
