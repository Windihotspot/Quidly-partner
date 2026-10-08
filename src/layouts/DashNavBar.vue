<template>
  <header class="w-full bg-white border-b border-gray-100 px-6 py-4 flex items-center">
    <!-- LEFT SPACER (keeps nav truly centered) -->
    <div class="flex-1"></div>

    <!-- CENTER NAV -->
    <!-- <nav class="hidden md:flex items-center gap-8 justify-center flex-1">
      <button
        v-for="item in navItems"
        :key="item.name"
        @click="router.push(item.route)"
        class="text-sm font-semibold transition relative"
        :class="isActive(item) ? 'text-[#5C2ECD]' : 'text-[#6e67a0] hover:text-[#5C2ECD]'"
      >
        {{ item.label }}

        <span
          v-if="isActive(item)"
          class="absolute -bottom-2 left-0 right-0 h-[2px] bg-gradient-to-r from-[#5C2ECD] to-[#ED017F] rounded-full"
        />
      </button>
    </nav> -->

    <!-- RIGHT USER SECTION -->
    <div class="flex justify-end items-center flex-1 gap-3">
      <!-- SUPPORT (mobile only) -->
      <div class="sm:hidden">
        <button
          ref="supportBtnRef"
          class="w-9 h-9 rounded-full bg-[#2b7fff] text-white flex items-center justify-center shadow-sm"
          :class="{ 'rotate-45': supportOpen }"
          style="transition: transform 0.2s ease"
          @click.stop="toggleSupport"
          aria-label="Contact support"
        >
          <v-icon size="16">{{ supportOpen ? 'mdi-close' : 'mdi-chat-processing' }}</v-icon>
        </button>
      </div>

      <router-link to="/profile" class="flex">
        <div class="flex items-center gap-3 cursor-pointer transition">
          <!-- <div class="text-right leading-tight hidden sm:block">
            <div class="text-sm font-semibold text-[#1a1535]">
              {{ fullName }}
            </div>
            <div class="text-[11px] text-[#6e67a0]">Premium Member</div>
          </div> -->

          <div
            class="w-9 h-9 rounded-full bg-[#2b7fff] text-white flex items-center justify-center font-bold text-xs"
          >
            {{ initials }}
          </div>
        </div>
      </router-link>
    </div>
  </header>

  <!-- TELEPORTED SUPPORT DROPDOWN — escapes header's stacking context entirely -->
  <Teleport to="body">
    <div v-if="supportOpen" class="support-nav-backdrop sm:hidden" @click="closeSupport" />

    <transition name="fab-menu">
      <div
        v-if="supportOpen"
        class="support-menu-dropdown sm:hidden"
        :style="dropdownStyle"
      >
        <a
          href="https://wa.me/+2348132822731"
          target="_blank"
          rel="noopener"
          class="support-option"
          @click="closeSupport"
        >
          <span class="option-icon option-wa">
            <v-icon size="16">mdi-whatsapp</v-icon>
          </span>
          WhatsApp
        </a>

        <a
          href="mailto:support@quidly.ng?subject=Support Request"
          class="support-option"
          @click="closeSupport"
        >
          <span class="option-icon option-mail">
            <v-icon size="16">mdi-email-outline</v-icon>
          </span>
          Email support
        </a>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'


const props = defineProps({
  drawer: Boolean
})

const emit = defineEmits(['update:drawer'])

const toggleDrawer = () => {
  emit('update:drawer', !props.drawer)
}

const showMenu = ref(false)
const router = useRouter()
const route = useRoute()

const navItems = [
  { name: 'dashboard', label: 'Dashboard', route: '/dashboard' },
  { name: 'loan', label: 'Apply for Loan', route: '/loan' },
  { name: 'repayments', label: 'Repayments', route: '/repayment' }
]
const isActive = (item) => {
  return route.path.startsWith(item.route)
}
const goHome = () => {
  router.push('/dashboard')
}


const initials = ref('U')
const handleLogout = async () => {
  router.push('/')
}

// SUPPORT DROPDOWN (mobile) — teleported, positioned via button's viewport rect
const supportOpen = ref(false)
const supportBtnRef = ref(null)
const dropdownStyle = ref({})

const toggleSupport = async () => {
  supportOpen.value = !supportOpen.value

  if (supportOpen.value) {
    await nextTick()
    const rect = supportBtnRef.value.getBoundingClientRect()
    dropdownStyle.value = {
      top: `${rect.bottom + 8}px`,
      right: `${window.innerWidth - rect.right}px`
    }
  }
}
const closeSupport = () => {
  supportOpen.value = false
}
</script>

<style scoped>
.support-menu-dropdown {
  position: fixed;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100000;
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
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.support-option:hover {
  transform: translateX(-2px);
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

.support-nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
}

.fab-menu-enter-active,
.fab-menu-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fab-menu-enter-from,
.fab-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>