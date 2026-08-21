<template>
  <div class="dash-sidebar">
    <ul class="dash-menu">
      <!-- Main Menu Items -->
      <li
        v-for="item in menuItems"
        :key="item.nav"
        :class="{ active: isActive(item) }"
        @click="navigateTo(item)"
      >
        <span class="icon-badge">
          <i :class="item.icon"></i>
        </span>
        {{ item.label }}
      </li>

      <!-- Account & Support Items -->
      <template v-for="item in accountItems" :key="item.nav">
        <li
          :class="{ active: isActive(item), 'support-open': item.nav === 'support' && supportOpen }"
          @click="navigateTo(item)"
        >
          <span class="icon-badge">
            <i :class="item.icon"></i>
          </span>
          {{ item.label }}
          <i
            v-if="item.nav === 'support'"
            class="mdi mdi-chevron-down support-chevron"
            :class="{ rotated: supportOpen }"
          ></i>
        </li>

        <!-- Support Submenu -->
        <transition name="submenu">
          <div v-if="item.nav === 'support' && supportOpen" class="support-submenu">
            <a
              href="https://wa.me/+2348132822731"
              target="_blank"
              rel="noopener"
              class="submenu-item"
            >
              <span class="submenu-icon wa-icon">
                <i class="mdi mdi-whatsapp"></i>
              </span>
              WhatsApp
            </a>
            <a href="mailto:support@quidly.ng?subject=Support Request" class="submenu-item">
              <span class="submenu-icon mail-icon">
                <i class="mdi mdi-email-outline"></i>
              </span>
              Email
            </a>
          </div>
        </transition>
      </template>

      <!-- Divider -->
      <div class="menu-divider"></div>

      <!-- Sign Out -->
      <li class="sign-out-item" @click="signOut">
        <span class="icon-badge">
          <i class="mdi mdi-logout-variant"></i>
        </span>
        Sign Out
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {useAuthStore} from "@/stores/authStore"

const authStore = useAuthStore()

const route = useRoute()
const router = useRouter()

const supportOpen = ref(false)

// Menu configuration
const menuItems = [
  {
    nav: 'overview',
    label: 'Dashboard',
    icon: 'mdi mdi-view-dashboard-outline',
    to: '/dashboard',
    bg: '#e3f2fd'
  },
   {
    nav: 'events',
    label: 'Events',
    icon: 'mdi mdi-calendar-outline',
    to: '/events',
    bg: '#fff3e0'
  },
  {
    nav: 'api-keys',
    label: 'API Keys',
    icon: 'mdi mdi-key-outline',
    to: '/api-keys',
    bg: '#f0e6ff'
  },
 
  {
    nav: 'webhooks',
    label: 'Webhooks',
    icon: 'mdi mdi-webhook',
    to: '/webhooks',
    bg: '#e8f5e9'
  },
  {
    nav: 'settlements',
    label: 'Settlements',
    icon: 'mdi mdi-bank-transfer',
    to: '/settlements',
    bg: '#fce4ec'
  },
  {
  nav: 'kyc',
  label: 'Kyc',
  icon: 'mdi mdi-account-check',
  to: '/kyc',
  bg: '#fce4ec'
},
  {
    nav: 'settings',
    label: 'Settings',
    icon: 'mdi mdi-cog-outline',
    to: '/settings',
    bg: '#f5f5f5'
  },
  {
    nav: 'docs',
    label: 'Documentation',
    icon: 'mdi mdi-book-open-page-variant-outline',
    to: '/docs',
    bg: '#f5f5f5'
  }
]

const accountItems = [
  {
    nav: 'support',
    label: 'Support',
    icon: 'mdi mdi-help-circle-outline',
    bg: '#e1f5ff'
  }
]

// Check if current route matches menu item
const isActive = (item: any) => {
  if (item.to) {
    return route.path === item.to || route.path.startsWith(item.to + '/')
  }
  return false
}

// Navigate to route or toggle submenu
const navigateTo = (item: any) => {
  if (item.nav === 'support') {
    supportOpen.value = !supportOpen.value
    return
  }
  if (item.to) {
    router.push(item.to)
  }
}

// Sign out handler
const signOut = async () => {
  authStore.logout
    router.push('/')

}
</script>

<style scoped>
.dash-sidebar {
  width: 260px;
  padding: 12px 18px 18px;
  background: #fff;
  border-radius: 18px;
  max-height: 100vh;
  overflow-y: auto;
}

.dash-menu {
  list-style: none;
  padding: 0;
  margin: 0;
}

.dash-menu li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.dash-menu li:hover:not(.active) {
  background: #f8f9fa;
  color: #2b3e50;
}

/* Active State */
.dash-menu li.active {
  background: #e3f0ff;
  color: #2b7fff;
  font-weight: 600;
}

.dash-menu li.active .icon-badge {
}

.dash-menu li.active .icon-badge i {
  color: #2b7fff;
}

/* Icon Badge */
.icon-badge {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
  line-height: 1;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.icon-badge i {
  color: #2b7fff;
  transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Support Chevron */
.support-chevron {
  margin-left: auto;
  font-size: 18px;
  color: #9ca3af;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.support-chevron.rotated {
  transform: rotate(180deg);
}

.dash-menu li.support-open .support-chevron {
  color: #2b7fff;
}

/* Support Submenu */
.support-submenu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 4px 0 12px 20px;
  padding: 8px 12px;
  padding-left: 14px;
  border-left: 2px solid #e0e7ff;
  background: #f8f9ff;
  border-radius: 10px;
  overflow: hidden;
}

.submenu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: #5f6368;
  text-decoration: none;
  transition: all 0.2s ease;
}

.submenu-item:hover {
  background: #eff6ff;
  color: #2b7fff;
}

.submenu-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.wa-icon {
  background: #25d366;
}

.wa-icon:hover {
  background: #1fa857;
}

.mail-icon {
  background: #2b7fff;
}

.mail-icon:hover {
  opacity: 0.9;
}

/* Menu Divider */
.menu-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 8px 0 8px -18px;
  width: calc(100% + 36px);
}

/* Sign Out Item */
.sign-out-item {
  color: #dc2626;
}

.sign-out-item:hover {
  background: #fef2f2;
  color: #b91c1c;
}

.sign-out-item .icon-badge i {
  color: #dc2626;
}

.sign-out-item.active {
  background: #fee2e2;
  color: #dc2626;
}

.sign-out-item.active .icon-badge {
  background: #fecaca !important;
}

/* Transitions */
.submenu-enter-active,
.submenu-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.submenu-enter-from,
.submenu-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Scrollbar Styling */
.dash-sidebar::-webkit-scrollbar {
  width: 6px;
}

.dash-sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.dash-sidebar::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.dash-sidebar::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>