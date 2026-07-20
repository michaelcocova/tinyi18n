import { defineEventHandler } from 'nitro/h3'
import { readWorkspaceTrash } from '../../../../cli/src/core/workspace/index.ts'
import { getProjectRoot } from '../../utils/project-root.ts'

export default defineEventHandler(() =>
  readWorkspaceTrash(getProjectRoot()),
)
