
<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    goHome()
  }
}
</script>

<template>
  <main class="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6 py-12 relative overflow-hidden">

    <!-- Background decorations -->
    <div class="absolute -top-32 -right-32 w-96 h-96 bg-green-100/60 rounded-full blur-3xl"></div>
    <div class="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl"></div>

    <div class="relative z-10 w-full max-w-xl text-center">

      <!-- Brand -->
      

      <!-- Illustration -->
      <div class="relative mb-8">
        <div class="text-[130px] sm:text-[170px] font-black leading-none tracking-tighter text-[#15803D]/10 select-none">
          404
        </div>

        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white shadow-xl shadow-green-900/10 border border-green-100 flex items-center justify-center -rotate-6">
            <svg
              class="w-12 h-12 sm:w-14 sm:h-14 text-[#15803D]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="9"/>
              <path d="M8 12h8M12 8v8"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="space-y-4">
        <span class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-[#15803D] text-xs font-bold uppercase tracking-widest">
          <span class="w-2 h-2 rounded-full bg-[#15803D]"></span>
          Page not found
        </span>

        <h1 class="text-3xl sm:text-4xl font-extrabold text-[#1F2937] tracking-tight">
          Looks like you missed something!
        </h1>

        <p class="text-gray-500 text-base sm:text-lg leading-relaxed max-w-md mx-auto">
          The page you're looking for doesn't exist, may have been moved,
          or is temporarily unavailable. Don't worry, let's get you back on track.
        </p>
      </div>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row items-center justify-center gap-3 mt-9">
        <button
          @click="goHome"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white font-semibold text-sm shadow-lg shadow-green-900/20 transition-all duration-200 hover:-translate-y-0.5"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m3 10 9-7 9 7"/>
            <path d="M5 9v11h14V9M9 20v-7h6v7"/>
          </svg>
          Back to Homepage
        </button>

        <button
          @click="goBack"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white border border-gray-200 hover:border-green-300 text-gray-700 font-semibold text-sm transition-all duration-200"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Go Back
        </button>
      </div>

      <!-- Footer -->
      <div class="mt-16 pt-6 border-t border-gray-200/80">
        <p class="text-sm text-gray-400">
          © {{ new Date().getFullYear() }} Quidly partners. All rights reserved.
        </p>
       
      </div>

    </div>
  </main>
</template>
