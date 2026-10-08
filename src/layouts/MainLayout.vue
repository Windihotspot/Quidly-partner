<script setup>
import { ref, onMounted, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashSidebar from './DashSidebar.vue'
import DashNavBar from './DashNavBar.vue'
import { useDisplay } from 'vuetify'

const { mdAndUp } = useDisplay()
const route = useRoute()
const router = useRouter()

const drawer = ref(false)
const supportOpen = ref(false)

onMounted(() => {
  drawer.value = mdAndUp.value
})

watchEffect(() => {
  drawer.value = mdAndUp.value
})

const toggleSupport = () => {
  supportOpen.value = !supportOpen.value
}

const closeSupport = () => {
  supportOpen.value = false
}

const toggleDrawer = () => {
  drawer.value = !drawer.value
}
</script>

<template>
  <v-app>
    <v-app-bar app elevation="0" class="px-3">
      <!-- Menu button: mobile/tablet only, toggles the drawer -->
      <v-app-bar-nav-icon
        class="d-flex d-md-none"
        @click="toggleDrawer"
      />

      <DashNavBar />
    </v-app-bar>

    <!-- Sidebar drawer: permanent on desktop, toggleable overlay on mobile/tablet -->
    <v-navigation-drawer
      left
      :permanent="$vuetify.display.mdAndUp"
      app
      :temporary="$vuetify.display.mdAndDown"
      v-model="drawer"
      expand-on-hover
      class="side-bar hidden md:block"
    >
      <DashSidebar v-model:drawer="drawer" />
    </v-navigation-drawer>

    <v-main class="mt-4 page-wrapper bg-plue-50">
      <v-container fluid class="page-wrapper bg-blue-50">
        <slot />
      </v-container>
    </v-main>

    <!-- Backdrop to close menu when clicking outside -->
    <div v-if="supportOpen" class="support-backdrop" @click="closeSupport" />

   
  </v-app>
</template>

<style scoped>
:deep(.v-application),


.side-bar {
  overflow: hidden !important;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
}

.side-bar :deep(.v-navigation-drawer__content) {
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.side-bar.v-navigation-drawer {
  background: transparent !important;
  border: none !important;
}

/* FAB container */
.support-fab-wrap {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  z-index: 9999;
}

.support-menu {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.support-option {
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  padding: 8px 14px 8px 8px;
  font-size: 13px;
  font-weight: 500;
  color: #1a1a2e;
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.support-option:hover {
  transform: translateX(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
}

.option-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}
.option-wa {
  background: #25d366;
}
.option-mail {
  background: linear-gradient(135deg, #7c3aed, #ec4899);
}

.support-btn {
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #7c3aed, #ec4899);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 25px rgba(124, 58, 237, 0.35);
  border: none;
  cursor: pointer;
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.support-btn:hover {
  transform: scale(1.08);
  opacity: 0.95;
}
.support-btn:active {
  transform: scale(0.96);
}
.support-btn.open {
  transform: rotate(45deg);
}

.support-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.fab-menu-enter-active,
.fab-menu-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fab-menu-enter-from,
.fab-menu-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>