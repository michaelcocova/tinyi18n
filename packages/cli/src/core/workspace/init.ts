import type { InitWorkspaceResult, WorkspaceDataTarget } from './context.ts'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dump } from 'js-yaml'
import {
  clearWorkspaceConfigCache,
  configFilename,
  defaultConfigSource,
  emptyConfig,
  ensureWorkspaceDir,
  pathExists,
  readConfigData,
  resolveWorkspaceDataTargets,
  workspaceDir,
} from './context.ts'
import { createDefaultDataSource } from './tisf.ts'

const NANOID_ALPH = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

function nanoid(size = 11) {
  const bytes = randomBytes(size)
  let id = ''
  for (let i = 0; i < size; i++) {
    id += NANOID_ALPH[bytes[i] & 63]
  }
  return id
}

/**
 * workspace 初始化与存在性检测。
 *
 * 注意：
 * - 这里的职责仅限于“创建必要文件/写入 config/补齐缺失 namespace 文件”
 * - 不做任何数据解析与业务操作（那些属于 read/apply）
 */
export async function checkWorkspaceExists(projectRoot: string) {
  const targetWorkspaceDir = join(projectRoot, workspaceDir)
  const configFile = join(targetWorkspaceDir, configFilename)
  const dataSkel = join(targetWorkspaceDir, 'data', '.skeleton.yaml')

  if (
    (await pathExists(targetWorkspaceDir))
    || (await pathExists(configFile))
    || (await pathExists(dataSkel))
  ) {
    return {
      exists: true,
      workspaceDir: targetWorkspaceDir,
    }
  }

  return {
    exists: false,
    workspaceDir: targetWorkspaceDir,
  }
}

export async function initWorkspace(
  projectRoot: string,
  configSource?: string,
): Promise<InitWorkspaceResult> {
  const targetWorkspaceDir = join(projectRoot, workspaceDir)
  const configFile = join(targetWorkspaceDir, configFilename)
  const dataDirPath = join(targetWorkspaceDir, 'data')
  const dataSkel = join(dataDirPath, '.skeleton.yaml')

  const alreadyExists = Boolean(
    (await pathExists(targetWorkspaceDir))
    || (await pathExists(configFile))
    || (await pathExists(dataSkel)),
  )

  await ensureWorkspaceDir(projectRoot)

  // 函数作用域的 config（各分支会各自重新读取覆盖）

  // 1) 第一次初始化：写入 config + 创建全部 namespace 文件
  if (!alreadyExists) {
    await writeFile(configFile, configSource ?? defaultConfigSource)
    const { config } = await readConfigData(configFile, true)
    const targets = resolveWorkspaceDataTargets(projectRoot, config ?? emptyConfig)
    const branchLocaleCodes = (config?.locales ?? []).map((l: any) => typeof l === 'string' ? l : l.code)
    const isSingle = config?.mode === 'single' || !config?.namespaces?.length
    await Promise.all(
      targets.map(async (target: WorkspaceDataTarget) => {
        const baseDir = isSingle ? dataDirPath : target.filePath
        if (!isSingle)
          await mkdir(target.filePath, { recursive: true })
        await writeFile(join(baseDir, '.skeleton.yaml'), createDefaultDataSource(target))
        for (const code of branchLocaleCodes) {
          const lp = join(baseDir, `${code}.yaml`)
          if (!await pathExists(lp)) {
            await writeFile(lp, dump({ file: `${code}.yaml`, desc: `${code} 翻译数据`, data: {} }))
          }
        }
      }),
    )

    // 写入 data/.skeleton.yaml（命名空间索引）
    const nsList = config?.namespaces ?? emptyConfig.namespaces
    await mkdir(dataDirPath, { recursive: true })
    if (nsList.length > 1) {
      const nsIndex: Record<string, any> = {}
      for (const ns of nsList) {
        const id = nanoid(11)
        nsIndex[id] = {
          $key: ns.key,
          $desc: ns.description || '',
          $label: ns.description || ns.key,
        }
      }
      await writeFile(join(dataDirPath, '.skeleton.yaml'), dump({
        file: '.skeleton.yaml',
        desc: '命名空间索引 骨架 总体',
        namesapce: nsIndex,
      }))
    }

    return {
      created: true,
      workspaceDir: targetWorkspaceDir,
      configFile,
      dataFiles: targets.map((target: WorkspaceDataTarget) => target.filePath),
    }
  }

  // 2) 已初始化：可选覆盖 config，并补齐“配置里声明但缺失”的 namespace 文件
  if (configSource) {
    await writeFile(configFile, configSource)
    clearWorkspaceConfigCache(configFile)
  }

  const { config } = await readConfigData(configFile, await pathExists(configFile))
  const isSingle = config?.mode === 'single' || !config?.namespaces?.length
  const branchCodes = (config?.locales ?? []).map((l: any) => typeof l === 'string' ? l : l.code)
  const targets = resolveWorkspaceDataTargets(projectRoot, config ?? emptyConfig)

  const createdFiles: string[] = []
  for (const target of targets) {
    const baseDir = isSingle ? dataDirPath : target.filePath
    const skelFile = join(baseDir, '.skeleton.yaml')
    if (!await pathExists(skelFile)) {
      if (!isSingle)
        await mkdir(target.filePath, { recursive: true })
      await writeFile(skelFile, createDefaultDataSource(target))
      for (const code of branchCodes) {
        const lp = join(baseDir, `${code}.yaml`)
        if (!await pathExists(lp)) {
          await writeFile(lp, dump({ file: `${code}.yaml`, desc: `${code} 翻译数据`, data: {} }))
        }
      }
      createdFiles.push(baseDir)
    }
  }

  return {
    created: createdFiles.length > 0 || Boolean(configSource),
    workspaceDir: targetWorkspaceDir,
    configFile,
    dataFiles: targets.map((target: WorkspaceDataTarget) => target.filePath),
  }
}
