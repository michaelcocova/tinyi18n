import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { defineEventHandler, setResponseStatus } from 'nitro/h3'
import { getProjectRoot } from '../../utils/project-root.ts'

export default defineEventHandler(async (event) => {
  const root = getProjectRoot()
  const configPath = path.resolve(root, 'tinyi18n.config.json')

  if (!existsSync(configPath)) {
    setResponseStatus(event, 404)
    return { error: true, status: 404, project: root, message: 'tinyi18n.config.json 不存在' }
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'))

  // 解析 entities（兼容新旧格式）
  let entities: Array<{ dir: string, namespaces: string[] }>
  let locales: Array<{ code: string, filename?: string, label?: string }> = []

  if (Array.isArray(raw)) {
    entities = raw
  }
  else {
    const cfgRoot = raw.root || '.'
    const suffix = raw.suffix || 'src/locales'
    entities = (raw.entities || []).map((e: any) => ({
      dir: path.posix.join(cfgRoot, e.dir, suffix),
      namespaces: e.namespaces || [],
    }))
    locales = raw.locales || []
  }

  // 构建 filename → code 映射
  const nameToCode: Record<string, string> = {}
  for (const loc of locales) {
    nameToCode[loc.filename || loc.code] = loc.code
  }

  const data: Record<string, Record<string, Record<string, any>>> = {}

  for (const entry of entities) {
    const dirPath = path.resolve(root, entry.dir)
    if (!existsSync(dirPath))
      continue

    const files = readdirSync(dirPath, { withFileTypes: true })
    const localeMap: Record<string, Record<string, any>> = {}

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json'))
        continue
      const baseName = file.name.slice(0, -5)
      const code = nameToCode[baseName] || baseName
      try {
        localeMap[code] = JSON.parse(readFileSync(path.join(dirPath, file.name), 'utf-8'))
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
