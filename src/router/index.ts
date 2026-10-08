import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
  path: '/register',
  name: 'register',
  component: () => import('@/views/Auth/Register.vue'),
},
{
  path: '/',
  name: 'login',
  component: () => import('@/views/Login.vue'),
},
{
  path: '/docs',
  name: 'docs',
  component: () => import('@/views/Documentation.vue'),
  meta: { guestOnly: true }
},
{
  path: '/widget',
  name: 'widget',
  component: () => import('@/views/Widget.vue'),
   meta: { requiresAuth: true }
},
{
  path: '/kyc',
  name: 'kyc',
  component: () => import('@/views/Kyc.vue'),
   meta: { requiresAuth: true }
},
{ path: '/dashboard', name: 'dashboard', component: () => import('@/views/DashboardOverview.vue'), meta: { requiresAuth: true } },
{ path: '/api-keys', name: 'api-keys', component: () => import('@/views/ApiKeys.vue'), meta: { requiresAuth: true } },
{ path: '/events', name: 'events', component: () => import('@/views/EventsPage.vue'), meta: { requiresAuth: true } },
{ path: '/webhooks', name: 'webhooks', component: () => import('@/views/WebhooksPage.vue'), meta: { requiresAuth: true } },
{ path: '/settlements', name: 'settlements', component: () => import('@/views/SettlementsPage.vue'), meta: { requiresAuth: true } },
{ path: '/settings', name: 'settings', component: () => import('@/views/Settings.vue'), meta: { requiresAuth: true } },
    
  ]
})

// router.beforeEach((to, from, next) => {
//   const auth = useAuthStore()
//   if (to.meta.requiresAuth && !auth.isAuthenticated) return next({ name: 'login' })
//   if (to.meta.guestOnly && auth.isAuthenticated) return next({ name: 'dashboard' })
//   next()
// })

export default router
