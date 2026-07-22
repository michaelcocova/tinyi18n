import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createError, defineEventHandler, readBody } from 'nitro/h3'
import { getProjectRoot } from '../../utils/project-root.ts'

function readLocales(root: string): Map<string, string> {
  const configPath = path.resolve(root, 'tinyi18n.config.json')
  if (!existsSync(configPath))
    return new Map()
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
    if (Array.isArray(raw))
      return new Map()
    const codeToFile = new Map<string, string>()
    for (const loc of raw.locales || []) {
      codeToFile.set(loc.code, loc.filename || loc.code)
    }
    return codeToFile
  }
  catch {
    return new Map()
  }
}

function sortKeys(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const key of Object.keys(obj).sort()) {
    const val = obj[key]
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = sortKeys(val)
    }
    else {
      result[key] = val
    }
  }
  return result
}

export default defineEventHandler(async (event) => {
  const root = getProjectRoot()
  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }

  const codeToFile = readLocales(root)

  for (const [dir, localeMap] of Object.entries(body as any)) {
    if (!localeMap || typeof localeMap !== 'object')
      continue
    for (const [code, data] of Object.entries(localeMap as any)) {
      if (!data || typeof data !== 'object')
        continue
      const dirPath = path.resolve(root, dir)
      if (!existsSync(dirPath))
        mkdirSync(dirPath, { recursive: true })
      const filename = codeToFile.get(code) || code
      writeFileSync(
        path.join(dirPath, `${filename}.json`),
        `${JSON.stringify(sortKeys(data), null, 2)}\n`,
        'utf-8',
      )
    }
  }

  return { ok: true }
})
