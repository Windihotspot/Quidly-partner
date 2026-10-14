
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/services/supabase'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/Auth/Register.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/events/:slug',
      name: 'public-event',
      component: () => import('@/views/public/EventPublicPage.vue'),
      props: true,
      meta: { public: true },
    },
    {
      path: '/docs',
      name: 'docs',
      component: () => import('@/views/Documentation.vue'),
      meta: { public: true },
    },
    {
      path: '/widget',
      name: 'widget',
      component: () => import('@/views/Widget.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/kyc',
      name: 'kyc',
      component: () => import('@/views/Kyc.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardOverview.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/api-keys',
      name: 'api-keys',
      component: () => import('@/views/ApiKeys.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/events',
      name: 'events',
      component: () => import('@/views/Events.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/events/new',
      name: 'event-new',
      component: () => import('@/views/events/EventWizard.vue'),
      props: { step: 'details' },
      meta: { requiresAuth: true },
    },
    {
      path: '/events/:id/:step(details|appearance|tickets|publish)',
      name: 'event-edit',
      component: () => import('@/views/events/EventWizard.vue'),
      props: true,
    
    },
    {
      path: '/webhooks',
      name: 'webhooks',
      component: () => import('@/views/WebhooksPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settlements',
      name: 'settlements',
      component: () => import('@/views/SettlementsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/settings/PartnersettingsPage.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

// Restore/check the Supabase session before protecting routes.
let sessionChecked = false

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!sessionChecked) {
    try {
      await auth.fetchSession()
    } catch (error) {
      console.error('Failed to restore authentication session:', error)
    } finally {
      sessionChecked = true
    }
  }

  // Check Supabase's current session, not just cached partner data.
  const { data: { session } } = await supabase.auth.getSession()

  if (!session && auth.partner) {
    auth.partner = null
    localStorage.removeItem('quidly_partner_session')
  }

  const isAuthenticated = Boolean(session && auth.partner)

  // Protect every route marked as requiring authentication.
  if (to.meta.requiresAuth && !isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  // Keep authenticated users out of login and registration.
  if (to.meta.guestOnly && isAuthenticated) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
