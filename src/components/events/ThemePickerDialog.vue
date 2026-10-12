<script setup>
import { ref, watch, computed } from 'vue'
import { THEMES } from '@/lib/eventHelpers'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  selected: { type: String, default: null },
  eventName: { type: String, default: 'Your event' },
  imageUrl: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'select'])

const picked = ref(props.selected || 'classic')
watch(() => props.modelValue, (open) => { if (open) picked.value = props.selected || 'classic' })

const theme = computed(() => THEMES.find((t) => t.id === picked.value) ?? THEMES[0])

function choose() {
  emit('select', picked.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="860" @update:model-value="(v) => emit('update:modelValue', v)">
    <v-card class="!rounded-xl">
      <v-card-title class="d-flex align-center justify-space-between pa-4">
        <span class="text-lg font-semibold">Choose a theme</span>
        <v-btn icon="mdi-close" size="small" variant="text" @click="emit('update:modelValue', false)" />
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-5">
        <div class="grid gap-5" style="grid-template-columns: 260px 1fr">
          <div class="grid gap-2 content-start">
            <button
              v-for="t in THEMES"
              :key="t.id"
              type="button"
              class="theme-opt"
              :class="{ 'theme-opt--on': picked === t.id }"
              @click="picked = t.id"
            >
              <span class="swatch" :style="{ background: t.bg, borderColor: t.accent }"><i :style="{ background: t.accent }"></i></span>
              <span class="text-left">
                <span class="block font-semibold text-sm">{{ t.name }}</span>
                <span class="block q-help">{{ t.description }}</span>
              </span>
            </button>
          </div>

          <div class="preview" :style="{ background: theme.bg, color: theme.text }">
            <div class="preview__img" :style="imageUrl ? { backgroundImage: `url(${imageUrl})` } : { background: theme.accent + '33' }">
              <i v-if="!imageUrl" class="mdi mdi-image-outline" :style="{ color: theme.accent }"></i>
            </div>
            <div class="preview__body">
              <p class="font-bold text-xl">{{ eventName || 'Your event' }}</p>
              <p class="text-sm opacity-70 mt-1">Saturday, 10th October · Lagos</p>
              <div class="preview__btn" :style="{ background: theme.accent, color: theme.bg }">Get tickets</div>
            </div>
          </div>
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 gap-3">
        <v-spacer />
        <v-btn class="q-btn-ghost" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn class="q-btn-primary" @click="choose">Use {{ theme.name }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.theme-opt { display: flex; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; cursor: pointer; }
.theme-opt--on { border-color: #2b7fff; background: #eef5ff; }
.swatch { width: 38px; height: 38px; border-radius: 10px; border: 2px solid; display: inline-flex; align-items: flex-end; justify-content: flex-end; padding: 5px; flex-shrink: 0; }
.swatch i { width: 14px; height: 14px; border-radius: 4px; display: block; }
.preview { border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; min-height: 320px; }
.preview__img { height: 170px; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-size: 44px; }
.preview__body { padding: 18px 20px; }
.preview__btn { display: inline-block; margin-top: 14px; padding: 9px 18px; border-radius: 10px; font-weight: 600; font-size: 14px; }
</style>
