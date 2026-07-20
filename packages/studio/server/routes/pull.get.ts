import type { TinyI18nItem } from '../../../cli/src/core/message.ts'
import { defineEventHandler } from 'nitro/h3'
import {
  loadWorkspaceNamespaceItems,
  resolveWorkspaceContext,
  workspaceDataDir,
  workspaceDir,
} from '../../../cli/src/core/workspace/index.ts'
import { getProjectRoot } from '../utils/project-root.ts'

function buildTisfItems(items: TinyI18nItem[]): any[] {
  const childMap = new Map<string | undefined, TinyI18nItem[]>()
  for (const item of items) {
    const bucket = childMap.get(item.parent) ?? []
    bucket.push(item)
    childMap.set(item.parent, bucket)
  }

  function walk(pid: string | undefined): any[] {
    return (childMap.get(pid) ?? []).map(child => {
      if (child.type === 'message') {
        const tls: Record<string, string> = {}
        for (const [k, v] of Object.entries(child.translations ?? {})) {
          tls[k] = String(v)
        }
        return { key: child.key, translations: tls }
      }
      return { key: child.key, $label: (child as any).title ?? '', items: walk(child.id) }
    })
  }

  const roots = items.filter(i => !i.parent)
  return roots.length > 0 ? walk(roots[0].id) : walk(undefined)
}

export interface WorkspacePullItem {
  dir: string
  files: string[]
  data: Record<string, any>
}

/**
 * GET /pull
 * - 全量拉取配置声明的所有 namespace 原始数据
 * - 返回数组：[{ name, data }]
 *
 * 约束：
 * - 不返回 config（配置在 /bootstrap 中获取）
 * - 缺失的 namespace 文件会自动补齐为默认数据源（不会删除多余历史文件）
 */
export default defineEventHandler(async (): Promise<WorkspacePullItem[]> => {
  const projectRoot = getProjectRoot()
  const { config, targets } = await resolveWorkspaceContext(projectRoot)
const namespaceFiles = await loadWorkspaceNamespaceItems(projectRoot, targets, config?.locales?.map((l: any) => l.code) ?? [])

  const isSingle = config?.mode === 'single'
  return namespaceFiles.map(nf => {
    const ns = nf.target.namespace ?? 'default'
    const label = (nf.items.find(i => !i.parent) as any)?.title ?? ''
    const dir = isSingle
      ? `${workspaceDir}/${workspaceDataDir}`
      : `${workspaceDir}/${workspaceDataDir}/${ns}`

    return {
      dir,
      files: ['.skeleton.yaml', ...(config?.locales ?? []).map((l: any) => l.code + '.yaml')],
      data: { $code: ns, $label: label, items: buildTisfItems(nf.items) },
    }
  })
})
