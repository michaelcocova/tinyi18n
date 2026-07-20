import type { TinyI18nDataFile, TinyI18nItem } from '../message.ts'
import { DEFAULT_NAMESPACE_KEY } from '../config.ts'
import { emptyConfig, ensureWorkspaceDir, resolveWorkspaceContext } from './context.ts'
import {
  loadWorkspaceNamespaceItems,
  readWorkspaceTrashFile,
  writeWorkspaceNamespaceFile,
  writeWorkspaceTrashFile,
} from './tisf.ts'

/**
 * workspace store：负责“读全量 + 写回”的 IO 层封装。
 *
 * 设计目标：
 * - 让上层 `read/apply` 只关心业务规则，不掺杂文件读写细节
 * - 保持依赖方向：store -> context/tisf，不反向依赖 read/apply
 */
function withNamespace(items: TinyI18nItem[], namespace?: string) {
  if (!namespace) {
    return items
  }

  return items.map(item => ({
    ...item,
    namespace: item.namespace ?? namespace,
  }))
}

export async function openWorkspaceData(projectRoot: string) {
  const { config, targets } = await resolveWorkspaceContext(projectRoot)

  await ensureWorkspaceDir(projectRoot)

  const resolvedConfig = config ?? emptyConfig
  const locales = resolvedConfig.locales.map((item: { code: string }) => item.code)
  const trash = await readWorkspaceTrashFile(projectRoot)
  const namespaceFiles = await loadWorkspaceNamespaceItems(projectRoot, targets, locales)

  return {
    config: resolvedConfig,
    targets,
    data: {
      items: namespaceFiles.flatMap(file =>
        withNamespace(file.items, file.target.namespace),
      ),
      trash,
    } satisfies TinyI18nDataFile,
    async write(nextData: TinyI18nDataFile) {
      // 1) 写入每个 namespace 的 TISF 数据文件
      for (const target of targets) {
        const namespaceKey = target.namespace ?? DEFAULT_NAMESPACE_KEY
        const nsItems = nextData.items.filter(item => item.namespace === namespaceKey)
        await writeWorkspaceNamespaceFile(projectRoot, nsItems, locales)
      }

      // 2) 写入 trash（独立文件，避免污染 TISF）
      await writeWorkspaceTrashFile(projectRoot, nextData.trash ?? [])
    },
  }
}
