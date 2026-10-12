<script setup>
import { reactive, ref, computed, watch } from 'vue'
import '@/assets/quidly-events.css'
import { kycService, KYC_ID_TYPES } from '@/services/kycService'
import { apiError, apiDetails } from '@/services/eventsService'

const props = defineProps({ state: { type: Object, required: true } })
const emit = defineEmits(['saved', 'next', 'back'])

const KEYS = ['legal_business_name', 'trading_name', 'business_registration_number', 'tax_identification_number',
  'business_address', 'business_city', 'business_state', 'director_full_name', 'director_dob',
  'director_nin', 'director_bvn', 'director_id_type', 'director_id_number']

const form = reactive(Object.fromEntries(KEYS.map((k) => [k, ''])))
const fieldErrors = reactive({})
const saving = ref(false)
const error = ref('')

const entity = computed(() => props.state.catalog.entity_types.find((t) => t.key === props.state.submission?.entity_type))
const isIndividual = computed(() => entity.value?.key === 'individual')
const personLabel = computed(() => ({
  business_name: 'Proprietor / partner',
  limited_company: 'Director',
  incorporated_trustees: 'Trustee',
}[entity.value?.key] ?? 'You'))
const maxDob = new Date(Date.now() - 18 * 365.25 * 864e5).toISOString().slice(0, 10)

// Saved identifiers come back masked (e.g. *******6789): show them read-only until the user chooses to change them
const isMasked = (v) => /^\*+[A-Za-z0-9]{4}$/.test(v ?? '')
const idNumberHidden = computed(() => form.director_id_type === 'nin')

let hydratedFor = null
watch(
  () => props.state.submission,
  (s) => {
    if (!s || s.id === hydratedFor) return
    hydratedFor = s.id
    for (const k of KEYS) form[k] = s[k] ?? ''
  },
  { immediate: true },
)

function validate() {
  Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k])
  const need = (k, msg) => { if (!String(form[k] ?? '').trim()) fieldErrors[k] = msg }
  need('legal_business_name', isIndividual.value ? 'Enter your full legal name' : 'Enter the registered business name')
  if (entity.value?.registration) need('business_registration_number', `Enter your ${entity.value.registration.label}`)
  if (entity.value?.tin === 'required') need('tax_identification_number', 'Enter your TIN')
  need('business_address', 'Enter an address')
  need('business_city', 'Enter a city')
  need('business_state', 'Select a state')
  if (!isIndividual.value) need('director_full_name', `Enter the ${personLabel.value.toLowerCase()}'s full name`)
  need('director_dob', 'Enter a date of birth')
  for (const [k, l] of [['director_bvn', 'BVN'], ['director_nin', 'NIN']]) {
    const v = String(form[k] ?? '').trim()
    if (!v) fieldErrors[k] = `Enter your ${l}`
    else if (!isMasked(v) && !/^\d{11}$/.test(v)) fieldErrors[k] = `${l} must be exactly 11 digits`
  }
  need('director_id_type', 'Select an ID type')
  if (!idNumberHidden.value) need('director_id_number', 'Enter your ID number')
  return Object.keys(fieldErrors).length === 0
}

async function save() {
  error.value = ''
  if (!validate()) return
  saving.value = true
  try {
    const payload = { ...form }
    if (isIndividual.value) { delete payload.director_full_name; delete payload.business_registration_number }
    emit('saved', await kycService.save(payload))
    emit('next')
  } catch (e) {
    const field = apiDetails(e)?.field
    if (field) fieldErrors[field] = apiError(e)
    else error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

const common = { variant: 'outlined', density: 'comfortable', color: '#2b7fff' }
</script>

<template>
  <div>
    <h2 class="q-section-title">{{ isIndividual ? 'Your details' : 'Business details' }}</h2>
    <p class="q-help mb-5">
      {{ isIndividual ? 'Use your name exactly as it appears on your government ID.' : 'Enter these exactly as they appear on your CAC documents.' }}
    </p>

    <div class="grid gap-4 md:grid-cols-2">
      <v-text-field v-model="form.legal_business_name" v-bind="common" :label="isIndividual ? 'Full legal name *' : 'Registered business name *'" :error-messages="fieldErrors.legal_business_name" class="md:col-span-2" />
      <v-text-field v-model="form.trading_name" v-bind="common" :label="isIndividual ? 'Name shown to attendees (optional)' : 'Trading name (optional)'" hint="What attendees see on your events" persistent-hint :error-messages="fieldErrors.trading_name" class="md:col-span-2" />

      <template v-if="entity && !isIndividual">
        <v-text-field v-model="form.business_registration_number" v-bind="common" :label="`${entity.registration.label} *`" :prefix="entity.registration.prefix" :error-messages="fieldErrors.business_registration_number" />
        <v-text-field v-model="form.tax_identification_number" v-bind="common" :label="entity.tin === 'required' ? 'Tax ID (TIN) *' : 'Tax ID (TIN), optional'" hint="From FIRS or your state revenue service" persistent-hint :error-messages="fieldErrors.tax_identification_number" />
      </template>

      <v-textarea v-model="form.business_address" v-bind="common" :label="isIndividual ? 'Residential address *' : 'Business address *'" rows="2" auto-grow :error-messages="fieldErrors.business_address" class="md:col-span-2" />
      <v-text-field v-model="form.business_city" v-bind="common" label="City / town *" :error-messages="fieldErrors.business_city" />
      <v-select v-model="form.business_state" v-bind="common" :items="state.catalog.states" label="State *" :error-messages="fieldErrors.business_state" />
    </div>

    <h2 class="q-section-title mt-10">{{ isIndividual ? 'Identity' : `${personLabel} details` }}</h2>
    <p class="q-help mb-5">We verify identity with your BVN and NIN. They are stored securely and only shown partially after you save.</p>

    <div class="grid gap-4 md:grid-cols-2">
      <v-text-field v-if="!isIndividual" v-model="form.director_full_name" v-bind="common" :label="`${personLabel}'s full name *`" :error-messages="fieldErrors.director_full_name" class="md:col-span-2" />
      <v-text-field v-model="form.director_dob" v-bind="common" type="date" :max="maxDob" label="Date of birth *" :error-messages="fieldErrors.director_dob" />
      <div class="hidden md:block"></div>

      <v-text-field v-model="form.director_bvn" v-bind="common" label="BVN *" inputmode="numeric" maxlength="11" :readonly="isMasked(form.director_bvn)" hint="Dial *565*0# on your registered phone to get it" persistent-hint :error-messages="fieldErrors.director_bvn">
        <template #append-inner><button v-if="isMasked(form.director_bvn)" type="button" class="q-link text-sm" @click="form.director_bvn = ''">Change</button></template>
      </v-text-field>
      <v-text-field v-model="form.director_nin" v-bind="common" label="NIN *" inputmode="numeric" maxlength="11" :readonly="isMasked(form.director_nin)" hint="Dial *346# to get your NIN" persistent-hint :error-messages="fieldErrors.director_nin">
        <template #append-inner><button v-if="isMasked(form.director_nin)" type="button" class="q-link text-sm" @click="form.director_nin = ''">Change</button></template>
      </v-text-field>

      <v-select v-model="form.director_id_type" v-bind="common" :items="KYC_ID_TYPES" label="ID you will upload *" :error-messages="fieldErrors.director_id_type" />
      <v-text-field v-if="!idNumberHidden" v-model="form.director_id_number" v-bind="common" label="ID number *" :readonly="isMasked(form.director_id_number)" :error-messages="fieldErrors.director_id_number">
        <template #append-inner><button v-if="isMasked(form.director_id_number)" type="button" class="q-link text-sm" @click="form.director_id_number = ''">Change</button></template>
      </v-text-field>
      <p v-else class="q-help self-center">We'll use your NIN as the ID number.</p>
    </div>

    <p v-if="error" class="q-error mt-4">{{ error }}</p>
    <div class="flex justify-between mt-8">
      <v-btn class="q-btn-ghost" size="large" min-width="140" @click="emit('back')">Back</v-btn>
      <v-btn class="q-btn-primary" size="large" min-width="200" :loading="saving" @click="save">Save and continue</v-btn>
    </div>
  </div>
</template>
