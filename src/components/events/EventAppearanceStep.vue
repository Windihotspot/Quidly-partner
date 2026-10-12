<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import '@/assets/quidly-events.css'
import ThemePickerDialog from '@/components/events/ThemePickerDialog.vue'
import { useAuthStore } from '@/stores/authStore'
import { eventsService, apiError } from '@/services/eventsService'
import { THEMES, validateImageFile } from '@/lib/eventHelpers'

const props = defineProps({ bundle: { type: Object, required: true } })
const emit = defineEmits(['saved', 'next'])

const auth = useAuthStore()
const fileInput = ref(null)
const file = ref(null)
const preview = ref(props.bundle.event.banner_url || '')
const removed = ref(false)
const theme = ref(props.bundle.event.theme || null)
const dragging = ref(false)
const themeDialog = ref(false)
const saving = ref(false)
const error = ref('')

const themeName = computed(() => THEMES.find((t) => t.id === theme.value)?.name ?? null)

watch(
  () => props.bundle.event.id,
  () => {
    preview.value = props.bundle.event.banner_url || ''
    theme.value = props.bundle.event.theme || null
    file.value = null
    removed.value = false
  },
)
onBeforeUnmount(() => { if (file.value && preview.value.startsWith('blob:')) URL.revokeObjectURL(preview.value) })

function pick(f) {
  if (!f) return
  const problem = validateImageFile(f)
  if (problem) {
    error.value = problem
    return
  }
  error.value = ''
  if (preview.value.startsWith('blob:')) URL.revokeObjectURL(preview.value)
  file.value = f
  removed.value = false
  preview.value = URL.createObjectURL(f)
}
function onInput(e) { pick(e.target.files?.[0]); e.target.value = '' }
function onDrop(e) { dragging.value = false; pick(e.dataTransfer.files?.[0]) }

function removeImage() {
  if (preview.value.startsWith('blob:')) URL.revokeObjectURL(preview.value)
  file.value = null
  preview.value = ''
  removed.value = !!props.bundle.event.banner_url
}

async function saveAndContinue() {
  error.value = ''
  const payload = { event_id: props.bundle.event.id }
  const themeChanged = (theme.value || null) !== (props.bundle.event.theme || null)
  if (themeChanged) payload.theme = theme.value
  if (!file.value && !removed.value && !themeChanged) return emit('next')

  saving.value = true
  try {
    if (file.value) payload.banner_url = await eventsService.uploadImage(file.value, auth.partner.id, props.bundle.event.id)
    else if (removed.value) payload.banner_url = null
    const bundle = await eventsService.save(payload)
    file.value = null
    emit('saved', bundle)
    emit('next')
  } catch (e) {
    error.value = apiError(e, 'Could not save your image.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="grid gap-10 md:grid-cols-2">
    <!-- Image -->
    <div>
      <h2 class="q-section-title">Image</h2>
      <p class="q-help mb-4">Upload a JPEG or PNG image like your event poster</p>
      <div class="q-info mb-4 flex items-center gap-2">
        <i class="mdi mdi-information-outline"></i> For the best look, use a portrait (4:5) or square image.
      </div>

      <div v-if="preview" class="preview">
        <img :src="preview" alt="Event image" />
        <v-btn icon="mdi-close" size="small" class="preview__x" @click="removeImage" />
      </div>
      <div
        v-else
        class="q-dropzone"
        :class="{ 'q-dropzone--active': dragging }"
        @click="fileInput.click()"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <i class="mdi mdi-image-plus text-2xl"></i>
        <span>Drag an image here or <span class="q-link">click to upload</span></span>
      </div>
      <input ref="fileInput" type="file" accept="image/jpeg,image/png" hidden @change="onInput" />
      <p class="q-help mt-2">The maximum upload file size is 2MB.</p>
      <p v-if="error" class="q-error">{{ error }}</p>

      <div class="flex gap-4 mt-10">
        <v-btn class="q-btn-ghost flex-1" size="large" @click="emit('next')">Do it later</v-btn>
        <v-btn class="q-btn-primary flex-1" size="large" :loading="saving" @click="saveAndContinue">Save and Continue</v-btn>
      </div>
    </div>

    <!-- Theme -->
    <div>
      <div class="flex items-start justify-between">
        <div>
          <h2 class="q-section-title">Theme</h2>
          <p class="q-help mb-4">Choose a layout for your event page.</p>
        </div>
        <button type="button" class="q-link text-sm" style="color:#6b7280" @click="themeDialog = true">
          <i class="mdi mdi-play-outline"></i> Preview theme
        </button>
      </div>
      <button type="button" class="theme-card" @click="themeDialog = true">
        <span class="theme-card__icon"><i class="mdi mdi-view-quilt"></i></span>
        <span class="text-left">
          <span class="block q-help">Theme</span>
          <span class="block font-bold">{{ themeName || 'Choose theme' }}</span>
        </span>
      </button>
    </div>

    <ThemePickerDialog
      v-model="themeDialog"
      :selected="theme"
      :event-name="bundle.event.event_name"
      :image-url="preview"
      @select="(id) => (theme = id)"
    />
  </div>
</template>

<style scoped>
.preview { position: relative; border-radius: 14px; overflow: hidden; max-width: 360px; background: #f3f4f6; }
.preview img { width: 100%; display: block; aspect-ratio: 4 / 5; object-fit: cover; }
.preview__x { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,.6) !important; color: #fff !important; }
.theme-card { width: 100%; display: flex; align-items: center; gap: 14px; padding: 18px 20px; background: #f4f5f7; border-radius: 14px; border: 0; cursor: pointer; }
.theme-card__icon { width: 46px; height: 46px; border-radius: 12px; background: #a5b4d4; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; }
</style>
