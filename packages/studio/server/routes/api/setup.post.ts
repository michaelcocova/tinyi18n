import type { TinyI18nUserConfig } from '../../../../cli/src/core/config.ts'
import { dump } from 'js-yaml'
import { defineEventHandler, readBody } from 'nitro/h3'
import { initWorkspace } from '../../../../cli/src/core/workspace/index.ts'
import { getProjectRoot } from '../../utils/project-root.ts'

function generateConfigSource(config: TinyI18nUserConfig): string {
  return dump(config)
}

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
