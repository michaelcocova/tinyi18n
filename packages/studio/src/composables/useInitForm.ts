import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'

export function useInitForm() {
  const namespaceSchema = z.object({
    // single 模式下可以不填写 namespace；multi 模式会在最外层 superRefine 里做校验
    key: z.string().optional().default(''),
    description: z.string().optional(),
  })

  const localeSchema = z.object({
    code: z.string().min(1, '语言代码不能为空'),
    filename: z.string().optional(),
  })

  const entrySchema = z
    .object({
      dir: z.string(),
      paths: z.array(z.string()),
    })
    .superRefine((entry, ctx) => {
      const dirEmpty = entry.dir.trim() === ''
      const pathsEmpty = entry.paths.length === 0

      // 两者都为空，视为空记录，忽略校验
      if (dirEmpty && pathsEmpty) {
        return
      }

      if (dirEmpty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dir'],
          message: '目录不能为空',
        })
      }

      if (pathsEmpty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paths'],
          message: '至少需要一个路径',
        })
      }
    })

  const schema = toTypedSchema(
    z.object({
      filename: z.string().min(1, '数据文件名前缀不能为空').default('.data'),

      mode: z.enum(['single', 'multi']).default('multi'),

      namespaces: z
        .array(namespaceSchema)
        .default([]),

      locales: z
        .array(localeSchema)
        .min(1, '至少需要一个语言')
        .default([
          {
            code: 'zh-CN',
            filename: 'zh-CN.yaml',
          },
          {
            code: 'en',
            filename: 'en.yaml',
          },
        ])
        .superRefine((locales, ctx) => {
          const codes = new Set<string>()

          locales.forEach((locale, index) => {
            if (codes.has(locale.code)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [index, 'code'],
                message: '语言代码不能重复',
              })
            }

            codes.add(locale.code)
          })
        }),

      entries: z
        .array(entrySchema)
        .default([])
        .superRefine((entries, ctx) => {
          const dirs = new Set<string>()

          entries.forEach((entry, index) => {
            // 忽略空记录
            if (entry.dir.trim() === '' && entry.paths.length === 0) {
              return
            }

            if (dirs.has(entry.dir)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [index, 'dir'],
                message: '目录不能重复',
              })
            }

            dirs.add(entry.dir)
          })
        }),
    }).superRefine((values, ctx) => {
      // single 模式下不需要用户配置 namespace；multi 模式才要求至少 1 个
      if (values.mode !== 'multi') {
        return
      }

      if (values.namespaces.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['namespaces'],
          message: '至少需要一个命名空间',
        })
        return
      }

      const keys = new Set<string>()
      values.namespaces.forEach((namespace, index) => {
        const key = String(namespace.key ?? '').trim()
        if (!key) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['namespaces', index, 'key'],
            message: '命名空间 key 不能为空',
          })
          return
        }
        if (keys.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['namespaces', index, 'key'],
            message: '命名空间 key 不能重复',
          })
          return
        }
        keys.add(key)
      })
    }),
  )

  const form = useForm({
    validationSchema: schema,
    validateOnMount: true,
    initialValues: {
      filename: '.data',
      mode: 'multi',
      namespaces: [
        { key: 'sso', description: '单点登录' },
        { key: 'shared', description: '共享模块' },
      ],
      locales: [
        { code: 'zh-CN', filename: 'zh-CN.yaml' },
        { code: 'en', filename: 'en.yaml' },
      ],
      entries: [
        {
          dir: '',
          paths: [],
        },
      ],
    },
  })

  return form
}
