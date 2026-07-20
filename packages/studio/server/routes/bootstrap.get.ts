import { unset } from 'lodash-es'
import { defineEventHandler } from 'nitro/h3'
import { readWorkspaceInfo } from '../../../cli/src/core/workspace/index.ts'
import { getProjectRoot } from '../utils/project-root.ts'

/**
 * GET /bootstrap
 * - 检查 workspace 是否已初始化
 * - 返回配置（前端初始化所需）
 *
 * 注意：保持轻量，不解析 TISF 内容。
 */
export default defineEventHandler(async () => {
  const info = await readWorkspaceInfo(getProjectRoot())
  const config = info.config ? { ...info.config } : null
  // 单命名空间模式下不返回 namespaces
  if (config && config.mode === 'single') {
    unset(config, 'namespaces')
  }

  return {
    root: info.root,
    initialized: info.initialized,
    config,
    error: info.error,
  }
})
