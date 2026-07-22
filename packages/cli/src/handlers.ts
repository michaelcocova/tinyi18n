import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline'
import { bold, dim, green, red, yellow } from 'kolorist'

interface LocaleConfig {
  code: string
  filename?: string
  label?: string
}

interface RawConfig {
  root?: string
  suffix?: string
  entities: Array<{ dir: string, namespaces?: string[] }>
  locales: LocaleConfig[]
}

interface IterFile {
  dirPath: string
  filePath: string
  entity: { dir: string, namespaces?: string[] }
  locale: LocaleConfig
}

function loadConfig(rootDir: string): RawConfig {
  const configPath = resolve(rootDir, 'tinyi18n.config.json')
  if (!existsSync(configPath)) {
    console.error(red(`[tinyi18n] 未找到 tinyi18n.config.json: ${configPath}`))
    process.exit(1)
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as RawConfig
  raw.root ??= '.'
  raw.suffix ??= 'src/locales'
  raw.entities ??= []
  raw.locales ??= []
  return raw
}

function* iterateFiles(rootDir: string, config: RawConfig): Generator<IterFile> {
  const root = config.root || '.'
  const suffix = config.suffix || 'src/locales'
  for (const entity of config.entities) {
    const dirPath = resolve(rootDir, root, entity.dir, suffix)
    for (const locale of config.locales) {
      const filename = locale.filename || locale.code
      yield { dirPath, filePath: join(dirPath, `${filename}.json`), entity, locale }
    }
  }
}

export function handleValidate(rootDir: string) {
  const config = loadConfig(rootDir)
  const root = config.root || '.'
  const suffix = config.suffix || 'src/locales'

  let total = 0
  let missing = 0

  console.log(bold('.\n'))

  for (let ei = 0; ei < config.entities.length; ei++) {
    const entity = config.entities[ei]
    const entityRel = join(root, entity.dir, suffix)
    const dirPath = resolve(rootDir, entityRel)
    const isLastEnt = ei === config.entities.length - 1
    const entPrefix = isLastEnt ? '└── ' : '├── '
    console.log(`${entPrefix}${bold(entityRel)}/`)

    const locales = config.locales
    for (let li = 0; li < locales.length; li++) {
      const loc = locales[li]
      const filename = loc.filename || loc.code
      const filePath = join(dirPath, `${filename}.json`)
      const exists = existsSync(filePath)
      const isLastLoc = li === locales.length - 1
      const branch = isLastEnt ? '    ' : '│   '
      const tip = isLastLoc ? '└── ' : '├── '
      const filePrefix = branch + tip
      const icon = exists ? green('✓') : red('✗')
      if (exists) {
        total++
      } else {
        total++
        missing++
      }
      console.log(`${filePrefix}${loc.code}.json ${icon}`)
    }
  }

  if (missing === 0) {
    console.log(`\n${green('✔ 所有文件都存在')}`)
  } else {
    console.log(`\n${red(`✘ 缺少 ${missing}/${total} 个文件`)}`)
  }
}

export function handleInit(rootDir: string) {
  const config = loadConfig(rootDir)
  const root = config.root || '.'
  const suffix = config.suffix || 'src/locales'
  let created = 0

  console.log(bold('.\n'))

  for (let ei = 0; ei < config.entities.length; ei++) {
    const entity = config.entities[ei]
    const entityRel = join(root, entity.dir, suffix)
    const dirPath = resolve(rootDir, entityRel)
    const isLastEnt = ei === config.entities.length - 1
    const entPrefix = isLastEnt ? '└── ' : '├── '
    console.log(`${entPrefix}${bold(entityRel)}/`)

    const locales = config.locales
    for (let li = 0; li < locales.length; li++) {
      const loc = locales[li]
      const filename = loc.filename || loc.code
      const filePath = join(dirPath, `${filename}.json`)
      const exists = existsSync(filePath)
      const isLastLoc = li === locales.length - 1
      const branch = isLastEnt ? '    ' : '│   '
      const tip = isLastLoc ? '└── ' : '├── '
      const filePrefix = branch + tip

      if (!exists) {
        mkdirSync(dirPath, { recursive: true })
        writeFileSync(filePath, '{}\n', 'utf-8')
        console.log(`${filePrefix}${loc.code}.json  ${green('✓ 已创建')}`)
        created++
      } else {
        console.log(`${filePrefix}${loc.code}.json  ${dim('∅ 已存在')}`)
      }
    }
  }

  if (created === 0) {
    console.log(`\n${green('✔ 所有文件已存在')}`)
  } else {
    console.log(`\n${green(`✔ 创建了 ${created} 个文件`)}`)
  }
}

export async function handleUpdate(rootDir: string) {
  const config = loadConfig(rootDir)
  const expected = new Set<string>()
  let created = 0

  console.log(bold('.\n'))

  for (let ei = 0; ei < config.entities.length; ei++) {
    const entity = config.entities[ei]
    const entityRel = join(config.root || '.', entity.dir, config.suffix || 'src/locales')
    const dirPath = resolve(rootDir, entityRel)
    const isLastEnt = ei === config.entities.length - 1
    const entPrefix = isLastEnt ? '└── ' : '├── '
    console.log(`${entPrefix}${bold(entityRel)}/`)

    const locales = config.locales
    for (let li = 0; li < locales.length; li++) {
      const loc = locales[li]
      const filename = loc.filename || loc.code
      const filePath = join(dirPath, `${filename}.json`)
      expected.add(filePath)
      const exists = existsSync(filePath)
      const isLastLoc = li === locales.length - 1
      const branch = isLastEnt ? '    ' : '│   '
      const tip = isLastLoc ? '└── ' : '├── '
      const filePrefix = branch + tip

      if (!exists) {
        mkdirSync(dirPath, { recursive: true })
        writeFileSync(filePath, '{}\n', 'utf-8')
        console.log(`${filePrefix}${loc.code}.json  ${green('✓ 已创建')}`)
        created++
      } else {
        console.log(`${filePrefix}${loc.code}.json  ${dim('∅ 已存在')}`)
      }
    }
  }

  // 检查多余文件
  const extra: string[] = []
  const seenDirs = new Set<string>()
  for (const { dirPath } of iterateFiles(rootDir, config)) {
    if (!existsSync(dirPath) || seenDirs.has(dirPath))
      continue
    seenDirs.add(dirPath)
    for (const f of readdirSync(dirPath)) {
      if (!f.endsWith('.json'))
        continue
      const fullPath = join(dirPath, f)
      if (!expected.has(fullPath))
        extra.push(fullPath)
    }
  }

  if (extra.length > 0) {
    console.log(`\n${yellow(`发现 ${extra.length} 个多余文件:`)}`)
    for (const f of extra) console.log(`  ${red(relative(rootDir, f))}`)

    const answer = await new Promise<string>((resolve) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      rl.question(`\n${yellow('是否删除多余文件？(y/N) ')}`, (ans) => {
        rl.close()
        resolve(ans)
      })
    })

    if (answer.toLowerCase() === 'y') {
      for (const f of extra) {
        unlinkSync(f)
        console.log(`  ${green(`✕ 已删除 ${relative(rootDir, f)}`)}`)
      }
    } else {
      console.log('跳过删除')
    }
  }

  if (created === 0 && extra.length === 0) {
    console.log(`\n${green('✔ 所有文件已是最新')}`)
  } else if (created > 0) {
    console.log(`\n${green(`✔ 创建了 ${created} 个文件`)}`)
  }
}
