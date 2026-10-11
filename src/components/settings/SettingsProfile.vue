<script setup>
import { reactive, ref, watch } from 'vue'
import { partnerSettingsService as api, fieldOf } from '@/services/partnerSettingsService'
import { apiError } from '@/services/eventsService'

const props = defineProps({ state: { type: Object, required: true } })
const emit = defineEmits(['saved', 'notify'])

const form = reactive({ business_name: '', contact_name: '', phone: '', website: '' })
const busy = ref(false)
const error = ref('')
const errField = ref(null)

watch(() => props.state.profile, (p) => {
  Object.assign(form, { business_name: p.business_name ?? '', contact_name: p.contact_name ?? '', phone: p.phone ?? '', website: p.website ?? '' })
}, { immediate: true })

async function save() {
  busy.value = true
  error.value = ''
  errField.value = null
  try {
    emit('saved', await api.updateProfile({ ...form }))
    emit('notify', 'Profile saved')
  } catch (e) {
    error.value = apiError(e)
    errField.value = fieldOf(e)
  } finally {
    busy.value = false
  }
}
const err = (f) => (errField.value === f ? error.value : '')
</script>

<template>
  <div>
    <h2 class="q-section-title">Business profile</h2>
    <p class="q-help mb-5">This is how your business appears to attendees. Your legal details are managed under verification.</p>

    <div class="grid sm:grid-cols-2 gap-x-4">
      <v-text-field v-model="form.business_name" label="Business name" variant="outlined" density="comfortable" color="#2b7fff" maxlength="120" :error-messages="err('business_name')" />
      <v-text-field v-model="form.contact_name" label="Contact name" variant="outlined" density="comfortable" color="#2b7fff" maxlength="120" :error-messages="err('contact_name')" />
      <v-text-field :model-value="state.profile.email" label="Email" variant="outlined" density="comfortable" disabled hint="Your sign-in email. Contact support to change it." persistent-hint />
      <v-text-field v-model="form.phone" label="Phone" variant="outlined" density="comfortable" color="#2b7fff" placeholder="08012345678" :error-messages="err('phone')" />
      <v-text-field v-model="form.website" label="Website" variant="outlined" density="comfortable" color="#2b7fff" placeholder="https://" :error-messages="err('website')" />
      <v-text-field :model-value="state.profile.country" label="Country" variant="outlined" density="comfortable" disabled />
    </div>

    <p v-if="error && !errField" class="q-error mt-1">{{ error }}</p>
    <div class="flex justify-end mt-6">
      <v-btn class="q-btn-primary" size="large" min-width="180" :loading="busy" @click="save">Save changes</v-btn>
    </div>
  </div>
</template>