import type { TinyI18nUserConfig } from '../../../cli/src/core/config.ts'
import { defineEventHandler, readBody } from 'nitro/h3'
import { initWorkspace } from '../../../cli/src/core/workspace/index.ts'
import { getProjectRoot } from '../utils/project-root.ts'

function generateConfigSource(config: TinyI18nUserConfig): string {
  // 使用 config.json：不再兼容 config.ts
  return `${JSON.stringify(config, null, 2)}\n`
}

/**
 * POST /setup
 * - 初始化项目：写入 config.json
 * - 补齐配置里声明但缺失的 namespace 文件
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event)

  if (!body || typeof body !== 'object' || !('locales' in body)) {
    throw new Error('Invalid configuration data')
  }

  const configSource = generateConfigSource(body as TinyI18nUserConfig)
  const result = await initWorkspace(getProjectRoot(), configSource)

  return {
    success: true,
    created: result.created,
    workspaceDir: result.workspaceDir,
  }
})
