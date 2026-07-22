import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createError, defineEventHandler } from 'nitro/h3'
import { getProjectRoot } from '../../utils/project-root.ts'

/**
 * GET /api/locales
 * 返回按目录分组的 locale 数据
 *
 * {
 *   ".apps/admin/src/locales": {
 *     "zh-CN": { "shared.search": "搜索", ... },
 *     "en": { "shared.search": "Search", ... }
 *   }
 * }
 */
export default defineEventHandler(async () => {
  const root = getProjectRoot()
  const configPath = path.resolve(root, 'tinyi18n.config.json')

  if (!existsSync(configPath)) {
    throw createError({ statusCode: 404, message: 'tinyi18n.config.json 不存在' })
  }

  const raw = readFileSync(configPath, 'utf-8')
  const config: Array<{ dir: string, namespaces: string[] }> = JSON.parse(raw)

  if (!Array.isArray(config)) {
    throw createError({ statusCode: 400, message: 'tinyi18n.config.json 格式错误' })
  }

  const data: Record<string, Record<string, Record<string, any>>> = {}

  for (const entry of config) {
    const dirPath = path.resolve(root, entry.dir)
    if (!existsSync(dirPath))
      continue

    const files = readdirSync(dirPath, { withFileTypes: true })
    const localeMap: Record<string, Record<string, any>> = {}

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json'))
        continue

      const locale = file.name.slice(0, -5)
      try {
        localeMap[locale] = JSON.parse(readFileSync(path.join(dirPath, file.name), 'utf-8'))
      }
      catch {
        continue
      }
    }

    if (Object.keys(localeMap).length > 0) {
      data[entry.dir] = localeMap
    }
  }

  return data
})
