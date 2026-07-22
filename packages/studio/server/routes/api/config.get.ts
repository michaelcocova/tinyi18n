import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createError, defineEventHandler } from 'nitro/h3'
import { getProjectRoot } from '../../utils/project-root.ts'

export interface ConfigEntry {
  dir: string
  namespaces: string[]
}

/**
 * GET /api/config
 * 读取启动目录下的 tinyi18n.config.json
 */
export default defineEventHandler(async () => {
  const root = getProjectRoot()
  const configPath = path.resolve(root, 'tinyi18n.config.json')

  if (!existsSync(configPath)) {
    throw createError({
      statusCode: 404,
      message: `tinyi18n.config.json 不存在: ${configPath}`,
    })
  }

  const raw = readFileSync(configPath, 'utf-8')
  const config: ConfigEntry[] = JSON.parse(raw)

  if (!Array.isArray(config)) {
    throw createError({
      statusCode: 400,
      message: 'tinyi18n.config.json 格式错误，应为数组',
    })
  }

  return config
})
