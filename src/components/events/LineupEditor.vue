<script setup>
import { ref, reactive } from 'vue'
import { LINEUP_TITLES, validateImageFile } from '@/lib/eventHelpers'
import { eventsService, apiError } from '@/services/eventsService'
import { useAuthStore } from '@/stores/authStore'

const props = defineProps({
  modelValue: { type: Array, default: () => [] }, // [{ title, name, image_url }]
})
const emit = defineEmits(['update:modelValue'])

const auth = useAuthStore()
const title = ref(null)
const dialog = ref(false)
const saving = ref(false)
const error = ref('')
const entry = reactive({ name: '', file: null, preview: '' })

function openAdd() {
  entry.name = ''
  entry.file = null
  entry.preview = ''
  error.value = ''
  dialog.value = true
}

function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const problem = validateImageFile(file)
  if (problem) {
    error.value = problem
    return
  }
  error.value = ''
  entry.file = file
  entry.preview = URL.createObjectURL(file)
}

async function addEntry() {
  if (!entry.name.trim()) {
    error.value = 'Enter a name.'
    return
  }
  saving.value = true
  try {
    const image_url = entry.file ? await eventsService.uploadImage(entry.file, auth.partner.id, 'lineup') : null
    emit('update:modelValue', [...props.modelValue, { title: title.value, name: entry.name.trim(), image_url }])
    dialog.value = false
  } catch (e) {
    error.value = apiError(e, 'Could not upload the image.')
  } finally {
    saving.value = false
  }
}

function remove(i) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}
</script>

<template>
  <div>
    <span class="q-label">Lineup Title</span>
    <v-select
      v-model="title"
      :items="LINEUP_TITLES"
      placeholder="Kindly select a lineup title"
      variant="outlined"
      density="comfortable"
      color="#2b7fff"
      hide-details
      class="mb-4"
    />

    <div v-if="modelValue.length" class="grid gap-2 mb-4">
      <div v-for="(l, i) in modelValue" :key="i" class="lineup-row">
        <img v-if="l.image_url" :src="l.image_url" class="lineup-avatar" alt="" />
        <span v-else class="lineup-avatar lineup-avatar--blank">{{ l.name.charAt(0).toUpperCase() }}</span>
        <div class="flex-1">
          <p class="font-semibold text-sm">{{ l.name }}</p>
          <p class="q-help">{{ l.title }}</p>
        </div>
        <v-btn icon="mdi-close" size="small" variant="text" @click="remove(i)" />
      </div>
    </div>

    <button type="button" class="lineup-add" :disabled="!title" @click="openAdd">
      <i class="mdi mdi-plus-box-multiple-outline"></i>
      {{ title ? `Add ${title.toLowerCase()}` : 'Add lineup' }}
    </button>
    <p v-if="!title" class="q-help mt-1">Select a lineup title first.</p>

    <v-dialog v-model="dialog" max-width="420">
      <v-card class="!rounded-xl">
        <v-card-title class="text-lg font-semibold">Add to {{ title }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="entry.name"
            label="Name"
            variant="outlined"
            density="comfortable"
            color="#2b7fff"
            counter="100"
            maxlength="100"
          />
          <span class="q-label">Photo (optional, JPEG or PNG, max 2MB)</span>
          <label class="lineup-upload">
            <img v-if="entry.preview" :src="entry.preview" alt="" class="lineup-avatar" />
            <i v-else class="mdi mdi-image-plus-outline text-xl"></i>
            <span>{{ entry.file ? entry.file.name : 'Click to upload' }}</span>
            <input type="file" accept="image/jpeg,image/png" hidden @change="onFile" />
          </label>
          <p v-if="error" class="q-error">{{ error }}</p>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn class="q-btn-ghost" @click="dialog = false">Cancel</v-btn>
          <v-btn class="q-btn-primary" :loading="saving" @click="addEntry">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.lineup-add { width: 100%; border: 1.5px dashed #c7d2e0; border-radius: 12px; padding: 16px; color: #2b7fff; font-weight: 600; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
.lineup-add:disabled { color: #9ca3af; cursor: not-allowed; }
.lineup-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; }
.lineup-avatar { width: 40px; height: 40px; border-radius: 999px; object-fit: cover; flex-shrink: 0; }
.lineup-avatar--blank { background: #eaf2ff; color: #2b7fff; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
.lineup-upload { display: flex; align-items: center; gap: 10px; border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 12px; cursor: pointer; color: #4b5563; font-size: 14px; }
</style>
