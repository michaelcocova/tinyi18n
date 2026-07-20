<script setup lang="ts">
import { ref } from 'vue'
import { useInitForm } from '../../composables/useInitForm'
import SetupForm from './SetupForm.vue'

const form = useInitForm()

function normalizeNamespaces(namespaces: any[] = []) {
  return namespaces
    .filter(item => item?.key)
    .map(item => ({
      key: item.key,
      description: item.description || '',
    }))
}

function normalizeLocales(locales: any[] = []) {
  return locales
    .filter(locale => locale?.code)
    .map(locale => ({
      code: locale.code,
      filename: locale.filename || `${locale.code}.yaml`,
    }))
}

function normalizeEntries(entries: any[] = []) {
  return entries
    .filter(entry => entry?.dir)
    .map(entry => ({
      dir: entry.dir,
      paths: (entry.paths || []).filter((path: string) => path.trim() !== ''),
    }))
}

function buildSetupConfig(values: Record<string, any>) {
  const mode = values.mode || 'multi'
  const config: Record<string, any> = {
    filename: values.filename || '.data',
    namespaces: mode === 'single'
      ? []
      : normalizeNamespaces(values.namespaces),
    locales: normalizeLocales(values.locales),
    mode,
  }

  const entries = normalizeEntries(values.entries)
  if (entries.length > 0) {
    config.entries = entries
  }

  return config
}
const isSubmitting = ref(false)

const onSubmit = form.handleSubmit(async (values) => {
  try {
    isSubmitting.value = true
    const config = buildSetupConfig(values)

    const response = await fetch('/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      throw new Error(`Failed to initialize: ${response.statusText}`)
    }

    window.location.reload()
  }
  catch (error) {
    console.error(error)
  }
  finally {
    isSubmitting.value = false
  }
})
</script>

<template>
  <div class="min-h-svh bg-background flex items-center box-border">
    <div
      class="mx-auto max-w-5xl w-full gap-6 grid lg:grid-cols-[1fr_400px] items-start"
    >
      <div class="flex-1 flex flex-col min-h-svh justify-center py-10">
        <h1 class="text-xl font-bold tracking-tight sm:text-3xl">
          欢迎使用 TinyI18n
        </h1>
        <p
          class="mt-5 max-w-md text-base leading-relaxed text-muted-foreground"
        >
          让我们通过几个简单的步骤来初始化你的工作区配置。
        </p>
        <SetupForm
          :is-submitting="isSubmitting"
          @submit="onSubmit"
        />
      </div>
    </div>
  </div>
</template>
