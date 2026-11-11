import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import LandingPage from '@/views/public/LandingPage.vue'
import { supabase } from '@/services/supabase'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingPage,
      meta: { guestOnly: true }
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/Auth/Register.vue'),
      meta: { guestOnly: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { guestOnly: true }
    },
    {
      path: '/events/:slug',
      name: 'public-event',
      component: () => import('@/views/public/EventPublicPage.vue'),
      props: true,
      meta: { public: true }
    },
    {
      path: '/not-found',
      name: 'not-found',
      component: () => import('@/views/NotFound.vue'),
      props: true,
      meta: { public: true }
    },
    {
      path: '/docs',
      name: 'docs',
      component: () => import('@/views/Documentation.vue'),
      meta: { public: true }
    },

    // Partner routes
    {
      path: '/widget',
      name: 'widget',
      component: () => import('@/views/Widget.vue'),
      meta: { requiresAuth: true, requiresPartner: true }
    },
    {
      path: '/kyc',
      name: 'kyc',
      component: () => import('@/views/Kyc.vue'),
      meta: { requiresAuth: true, requiresPartner: true }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardOverview.vue'),
      meta: { requiresAuth: true, requiresPartner: true }
    },
    {
      path: '/api-keys',
      name: 'api-keys',
      component: () => import('@/views/ApiKeys.vue'),
      meta: { requiresAuth: true, requiresPartner: true }
    },
    {
      path: '/events',
      name: 'events',
      component: () => import('@/views/Events.vue'),
      meta: { requiresAuth: true, requiresPartner: true }
    },
    {
      path: '/events/new',
      name: 'event-new',
      component: () => import('@/views/events/EventWizard.vue'),
      props: { step: 'details' },
      meta: { requiresAuth: true, requiresPartner: true }
    },
    {
      path: '/events/:id/:step(details|appearance|tickets|publish)',
      name: 'event-edit',
      component: () => import('@/views/events/EventWizard.vue'),
      props: true,
      meta: { requiresAuth: true, requiresPartner: true }
    },
    {
      path: '/webhooks',
      name: 'webhooks',
      component: () => import('@/views/WebhooksPage.vue'),
      meta: { requiresAuth: true, requiresPartner: true }
    },
    {
      path: '/settlements',
      name: 'settlements',
      component: () => import('@/views/SettlementsPage.vue'),
      meta: { requiresAuth: true, requiresPartner: true }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/settings/PartnersettingsPage.vue'),
      meta: { requiresAuth: true, requiresPartner: true }
    },
    {
      path: '/orders',
      name: 'orders',
      component: () => import('@/views/orders/Orders.vue'),
      meta: { requiresAuth: true, requiresPartner: true }
    },

    // Platform Super Admin
    {
      path: '/admin',
      name: 'admin-dashboard',
      component: () => import('@/views/admin/AdminDashboardPage.vue'),
      meta: {
        requiresAuth: true,
        requiresSuperAdmin: true
      }
    },
    {
      path: '/admin/partners',
      name: 'admin-partners',
      component: () => import('@/views/admin/AdminPartnersPage.vue'),
      meta: { requiresAuth: true, superAdmin: true }
    },
    {
      path: '/admin/kyc',
      name: 'admin-kyc',
      component: () => import('@/views/admin/AdminKycPage.vue'),
      meta: { requiresAuth: true, superAdmin: true }
    },
    {
      path: '/admin/transactions',
      name: 'admin-transactions',
      component: () => import('@/views/admin/AdminTransactionsPage.vue'),
      meta: { requiresAuth: true, superAdmin: true }
    },
    {
  path: '/admin/events',
  name: 'admin-events',
  component: () => import('@/views/admin/AdminEventsPage.vue'),
  meta: { requiresAuth: true, superAdmin: true },
},
  ]
})

// Restore authentication before navigating.
let sessionChecked = false

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Restore the session once before route evaluation.
  if (!sessionChecked) {
    await auth.fetchSession()
    sessionChecked = true
  }

  // Check the actual Supabase session.
  const {
    data: { session },
    error
  } = await supabase.auth.getSession()
  if (error || !session) {
    auth.user = null
    auth.partner = null
    auth.isSuperAdmin = false

    localStorage.removeItem('quidly_partner_session')

    if (to.meta.requiresAuth || to.meta.guestOnly) {
      if (to.name !== 'login') {
        return {
          name: 'login',
          query: { redirect: to.fullPath }
        }
      }
    }

    return true
  }

  // Authentication is based on the Supabase user,
  // NOT the existence of a partner profile.
  const isAuthenticated = !!auth.user
  const isSuperAdmin = auth.isSuperAdmin
  const hasPartner = !!auth.partner

  // Require authentication.
  if (to.meta.requiresAuth && !isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath }
    }
  }

  // Super Admin-only routes.
  if (to.meta.requiresSuperAdmin && !isSuperAdmin) {
    return hasPartner ? { name: 'dashboard' } : { name: 'login' }
  }

  // Partner-only routes.
  if (to.meta.requiresPartner && !hasPartner) {
    return isSuperAdmin ? { name: 'admin-dashboard' } : { name: 'login' }
  }

  // Redirect authenticated users away from guest pages.
  if (to.meta.guestOnly && isAuthenticated) {
    return isSuperAdmin ? { name: 'admin-dashboard' } : { name: 'dashboard' }
  }

  return true
})

export default router
