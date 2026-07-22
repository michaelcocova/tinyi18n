import { isPlainObject } from 'lodash-es'

export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  const stack: Array<[Record<string, any>, Record<string, any>]> = []

  for (const source of sources) {
    if (!isPlainObject(source))
      continue
    stack.push([target as Record<string, any>, source as Record<string, any>])

    while (stack.length) {
      const [dst, src] = stack.pop()!

      for (const key in src) {
        if (!Object.hasOwn(src, key))
          continue

        const srcValue = src[key]
        const dstValue = dst[key]

        if (isPlainObject(srcValue) && isPlainObject(dstValue)) {
          stack.push([dstValue, srcValue])
        }
        else if (srcValue !== undefined) {
          dst[key] = srcValue
        }
      }
    }
  }

  return target
}
