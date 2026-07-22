import { execFileSync } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { load as yamlLoad } from 'js-yaml'

const SRC_DIR = path.resolve(process.cwd(), '.tinyi18n')
const OUT_DIR = path.resolve(process.cwd(), 'packages/studio/.tinyi18n')

function typeOrder(type) {
  return type === 'namespace' || type === 'group' ? 0 : 1
}

async function main() {
  // ─── 读取配置 ──────────────────────────────
  const config = yamlLoad(await readFile(path.join(SRC_DIR, 'config.yaml'), 'utf8'))
  const locales = config.locales.map(l => l.code)

  // ─── 自动分配自增 ID ────────────────────────
  let nextId = 1
  const oldToNew = new Map()
  function getOrAssign(oldId) {
    if (!oldToNew.has(oldId))
      oldToNew.set(oldId, nextId++)
    return oldToNew.get(oldId)
  }

  const dataDir = path.join(SRC_DIR, 'data')
  const nsDirs = (await readdir(dataDir, { withFileTypes: true }))
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name)

  await mkdir(path.join(OUT_DIR, 'data'), { recursive: true })

  // ─── 逐命名空间处理 ────────────────────────
  for (const ns of nsDirs) {
    const nsSource = path.join(dataDir, ns)

    // 读取骨架
    const raw = yamlLoad(await readFile(path.join(nsSource, '.skeleton.yaml'), 'utf8'))
    const entries = Object.entries(raw.data)

    // 分配 ID（保持 YAML 顺序）
    for (const [oldId] of entries) getOrAssign(oldId)

    // 读取翻译
    const localeData = {}
    for (const locale of locales) {
      localeData[locale] = {}
      try {
        const lr = yamlLoad(await readFile(path.join(nsSource, `${locale}.yaml`), 'utf8'))
        Object.assign(localeData[locale], lr.data)
      } catch (e) {
        if (e.code !== 'ENOENT')
          throw e
      }
    }

    // 按 parent 分组，组内 group 在 message 前
    const parentOrder = []
    const parentGroups = {}
    for (const [oldId, node] of entries) {
      const p = node.$parent || ''
      if (!parentGroups[p]) {
        parentGroups[p] = []
        parentOrder.push(p)
      }
      parentGroups[p].push([oldId, node])
    }
    for (const group of Object.values(parentGroups)) {
      group.sort((a, b) => typeOrder(a[1].type) - typeOrder(b[1].type))
    }
    const parentChildren = new Map(parentOrder.map(p => [p, parentGroups[p]]))

    // 递归构建树
    function buildTree(parentOldId) {
      const children = parentChildren.get(parentOldId || '') || []
      return children.map(([oldId, node]) => {
        const newId = oldToNew.get(oldId)
        const entry = { id: newId, key: node.key }
        if (node.$label)
          entry.label = node.$label

        if (node.type === 'message') {
          // 翻译直接嵌在叶子节点
          for (const locale of locales) {
            const val = localeData[locale][oldId]
            if (val !== undefined)
              entry[locale] = val
          }
        } else {
          entry.items = buildTree(oldId)
        }
        return entry
      })
    }

    // 根节点（type: namespace）的 $parent 为 null → 被分组到 ''
    const tree = buildTree('')

    await writeFile(path.join(OUT_DIR, 'data', `${ns}.json`), `${JSON.stringify(tree, null, 2)}\n`)
    console.log(`  ✓ data/${ns}.json (${countNodes(tree)} 节点)`)
  }

  // ─── 输出 config.ts ────────────────────────
  const configTS = `// 自动生成，请勿手动修改

const config = ${JSON.stringify(config, null, 2)} as const

export default config
`

  await writeFile(path.join(OUT_DIR, 'config.ts'), configTS)
  execFileSync(path.resolve(process.cwd(), 'node_modules/.bin/prettier'), [
    '--write',
    path.join(OUT_DIR, 'config.ts'),
    '--parser',
    'typescript',
  ])
  console.log('  ✓ config.ts')
}

function countNodes(nodes) {
  let count = 0
  for (const n of nodes) {
    count++
    if (n.items)
      count += countNodes(n.items)
  }
  return count
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
