/**
 * 控制加载状态
 */
export function useLoading() {
  // 定义一个响应式变量，用于记录加载次数
  const count = ref(0)

  // 定义一个计算属性，用于判断是否处于加载状态
  const loading = computed({
    // 获取加载状态，如果加载次数大于0，则返回true，否则返回false
    get: () => count.value > 0,
    // 设置加载状态，如果传入的值为true，则加载次数加1，否则如果加载次数大于0，则加载次数减1
    set: (value) => {
      if (value) {
        count.value++
      }
      else if (count.value > 0) {
        count.value--
      }
    },
  })

  // 返回计算属性
  return loading
}
