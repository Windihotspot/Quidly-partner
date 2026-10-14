<script setup>
import { ref, watch, computed } from 'vue'
import { THEMES } from '@/lib/eventHelpers'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  selected: { type: String, default: null },
  eventName: { type: String, default: 'Your event' },
  imageUrl: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'select'])

const picked = ref(props.selected || 'classic')
watch(
  () => props.modelValue,
  (open) => {
    if (open) picked.value = props.selected || 'classic'
  }
)

const theme = computed(() => THEMES.find((t) => t.id === picked.value) ?? THEMES[0])

function choose() {
  emit('select', picked.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="860"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <v-card class="!rounded-xl">
      <v-card-title class="d-flex align-center justify-space-between pa-4">
        <span class="text-lg font-semibold">Choose a theme</span>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>
      <v-divider />
      <v-card-text class="theme-dialog-content">
        <div class="theme-layout">
          <!-- Theme options -->
          <div class="theme-options">
            <button
              v-for="t in THEMES"
              :key="t.id"
              type="button"
              class="theme-opt"
              :class="{ 'theme-opt--on': picked === t.id }"
              @click="picked = t.id"
            >
              <span class="swatch" :style="{ background: t.bg, borderColor: t.accent }">
                <i :style="{ background: t.accent }"></i>
              </span>

              <span class="theme-opt__text">
                <span class="block font-semibold text-sm">
                  {{ t.name }}
                </span>
                <span class="block q-help">
                  {{ t.description }}
                </span>
              </span>

              <i v-if="picked === t.id" class="mdi mdi-check-circle theme-opt__check"></i>
            </button>
          </div>

          <!-- Theme preview -->
          <div class="preview" :style="{ background: theme.bg, color: theme.text }">
            <div
              class="preview__img"
              :style="
                imageUrl
                  ? { backgroundImage: `url(${imageUrl})` }
                  : { background: theme.accent + '33' }
              "
            >
              <i
                v-if="!imageUrl"
                class="mdi mdi-image-outline"
                :style="{ color: theme.accent }"
              ></i>
            </div>

            <div class="preview__body">
              <p class="preview__title">
                {{ eventName || 'Your event' }}
              </p>

              <p class="preview__date">Saturday, 10th October · Lagos</p>

              <div class="preview__btn" :style="{ background: theme.accent, color: theme.bg }">
                Get tickets
              </div>
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
.theme-dialog-content {
  padding: 20px !important;
  overflow-x: hidden;
}

.theme-layout {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
  width: 100%;
  min-width: 0;
}

.theme-options {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.theme-opt {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, background 0.2s;
}

.theme-opt--on {
  border-color: #2b7fff;
  background: #eef5ff;
}

.theme-opt__text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.theme-opt__check {
  flex-shrink: 0;
  color: #2b7fff;
  font-size: 20px;
}

.swatch {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 2px solid;
  display: inline-flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 5px;
  flex-shrink: 0;
}

.swatch i {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  display: block;
}

.preview {
  width: 100%;
  min-width: 0;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview__img {
  width: 100%;
  height: 170px;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44px;
}

.preview__body {
  padding: 18px 20px;
  overflow-wrap: anywhere;
}

.preview__title {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.preview__date {
  margin-top: 6px;
  font-size: 14px;
  opacity: 0.7;
}

.preview__btn {
  display: inline-block;
  margin-top: 14px;
  padding: 9px 18px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
}

/* Tablet and mobile */
@media (max-width: 700px) {
  .theme-dialog-content {
    padding: 14px !important;
  }

  .theme-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }

  .theme-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .theme-opt {
    gap: 8px;
    padding: 10px;
    align-items: flex-start;
  }

  .swatch {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    padding: 4px;
  }

  .swatch i {
    width: 11px;
    height: 11px;
  }

  .theme-opt__check {
    font-size: 16px;
  }

  .preview__img {
    height: 160px;
  }

  .preview__body {
    padding: 16px;
  }

  .preview__title {
    font-size: 18px;
  }
}

/* Small phones */
@media (max-width: 400px) {
  .theme-options {
    grid-template-columns: minmax(0, 1fr);
  }

  .theme-opt {
    align-items: center;
  }

  .preview__img {
    height: 135px;
  }
}

</style>
