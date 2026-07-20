import type { TinyI18nDataResponse } from '../../../../cli/src/core/message.ts'
import { defineEventHandler } from 'nitro/h3'
import { readWorkspaceInfo } from '../../../../cli/src/core/workspace/index.ts'
import { getProjectRoot } from '../../utils/project-root.ts'

export default defineEventHandler(async () => {
  return readWorkspaceInfo(getProjectRoot()) as Promise<TinyI18nDataResponse>
})
