import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { defineEventHandler, setResponseStatus } from 'nitro/h3'
import { getProjectRoot } from '../../utils/project-root.ts'

interface ConfigEntry {
  dir: string
  namespaces: string[]
}

export default defineEventHandler(async (event) => {
  const root = getProjectRoot()
  const configPath = path.resolve(root, 'tinyi18n.config.json')

  if (!existsSync(configPath)) {
    setResponseStatus(event, 404)
    return { error: true, status: 404, project: root, message: 'tinyi18n.config.json 不存在' }
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'))

  // 兼容新老格式
  if (Array.isArray(raw)) {
    return raw as ConfigEntry[]
  }

  const cfgRoot = raw.root || '.'
  const suffix = raw.suffix || 'src/locales'
  const entities: ConfigEntry[] = (raw.entities || []).map((e: any) => ({
    dir: path.posix.join(cfgRoot, e.dir, suffix),
    namespaces: e.namespaces || [],
  }))

  return entities
})
