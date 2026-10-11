<script setup>
import { ref } from 'vue'
import { kycService } from '@/services/kycService'
import { apiError } from '@/services/eventsService'

const props = defineProps({
  doc: { type: Object, required: true },     // { type, label, hint, required }
  files: { type: Array, default: () => [] }, // uploaded docs of this type
})
const emit = defineEmits(['changed'])

const MAX = 5 * 1024 * 1024
const OK = ['application/pdf', 'image/jpeg', 'image/png']
const input = ref(null)
const busy = ref(false)
const error = ref('')

async function onPick(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  error.value = ''
  if (!OK.includes(file.type)) return (error.value = 'Upload a PDF, JPG or PNG file.')
  if (file.size > MAX) return (error.value = 'Files must be 5MB or smaller.')
  busy.value = true
  try {
    emit('changed', await kycService.uploadDocument(file, props.doc.type))
  } catch (err) {
    error.value = apiError(err, 'Upload failed. Please try again.')
  } finally {
    busy.value = false
  }
}

async function remove(f) {
  busy.value = true
  error.value = ''
  try {
    emit('changed', await kycService.deleteDocument(f.id))
  } catch (err) {
    error.value = apiError(err)
  } finally {
    busy.value = false
  }
}

async function view(f) {
  try { await kycService.viewDocument(f.id) } catch (err) { error.value = apiError(err) }
}
</script>

<template>
  <div class="row" :class="{ 'row--done': files.length }">
    <div class="flex items-start gap-3">
      <i class="mdi row__icon" :class="files.length ? 'mdi-check-circle' : 'mdi-circle-outline'"></i>
      <div class="flex-1">
        <p class="font-semibold">{{ doc.label }} <span v-if="!doc.required" class="opt">optional</span></p>
        <p class="q-help">{{ doc.hint }}</p>

        <ul v-if="files.length" class="files">
          <li v-for="f in files" :key="f.id">
            <i class="mdi mdi-file-document-outline"></i>
            <button type="button" class="q-link name" @click="view(f)">{{ f.file_name }}</button>
            <span v-if="f.verified" class="ok">Verified</span>
            <v-btn icon="mdi-delete-outline" size="x-small" variant="text" :disabled="busy" @click="remove(f)" />
          </li>
        </ul>
        <p v-if="error" class="q-error">{{ error }}</p>
      </div>
      <v-btn variant="outlined" size="small" class="!normal-case" :loading="busy" :disabled="files.length >= 3" @click="input.click()">
        {{ files.length ? 'Add another' : 'Upload' }}
      </v-btn>
      <input ref="input" type="file" accept="application/pdf,image/jpeg,image/png" hidden @change="onPick" />
    </div>
  </div>
</template>

<style scoped>
.row { padding: 16px 18px; border: 1px solid #e5e7eb; border-radius: 14px; background: #fff; }
.row--done { border-color: #bbf7d0; background: #fcfffd; }
.row__icon { font-size: 22px; color: #9ca3af; margin-top: 1px; }
.row--done .row__icon { color: #059669; }
.opt { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; margin-left: 6px; }
.files { margin-top: 10px; display: grid; gap: 4px; }
.files li { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.name { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ok { font-size: 11px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 2px 8px; border-radius: 99px; }
</style>
