import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { getWebConfig } from '../web-config.ts'

const routes: readonly RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/WorkspacePage.vue'),
  },
  {
    path: '/translations',
    name: 'translations',
    component: () => import('../views/WorkspacePage.vue'),
    meta: { title: '翻译工作台' },
  },
  // {
  //   path: "/quality",
  //   name: "quality",
  //   component: () => import('../views/QualityPage.vue'),
  //   meta: { title: "质量检查", scroll: true },
  // },
  // {
  //   path: "/refactor",
  //   name: "refactor",
  //   component: () => import('../views/WorkspacePage.vue'),
  //   meta: { title: "重构中心" },
  // },
  // {
  //   path: "/settings",
  //   name: "settings",
  //   component: () => import('../views/WorkspacePage.vue'),
  //   meta: { title: "项目配置" },
  // },
]

const router = createRouter({
  history: createWebHistory(getWebConfig().routeBase),
  routes,
})

export default router
