<script setup>
import { ref, computed } from 'vue'
import '@/assets/quidly-events.css'
import { kycService, KYC_ID_TYPES } from '@/services/kycService'
import { apiError } from '@/services/eventsService'

const props = defineProps({
  state: { type: Object, required: true },
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['saved', 'goto', 'back', 'submitted'])

const confirmed = ref(false)
const submitting = ref(false)
const error = ref('')

const sub = computed(() => props.state.submission)
const entity = computed(() => props.state.catalog.entity_types.find((t) => t.key === sub.value?.entity_type))
const isIndividual = computed(() => sub.value?.entity_type === 'individual')
const idLabel = (v) => KYC_ID_TYPES.find((t) => t.value === v)?.title ?? v

const sections = computed(() => {
  const s = sub.value
  if (!s) return []
  const dob = s.director_dob ? new Date(s.director_dob).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  return [
    {
      title: 'Account type', step: 0,
      rows: [['Type', entity.value?.label]],
    },
    {
      title: isIndividual.value ? 'Your details' : 'Business details', step: 1,
      rows: [
        [isIndividual.value ? 'Full legal name' : 'Registered name', s.legal_business_name],
        ['Display name', s.trading_name],
        ...(entity.value?.registration ? [[entity.value.registration.label, s.business_registration_number]] : []),
        ['TIN', s.tax_identification_number],
        ['Address', [s.business_address, s.business_city, s.business_state].filter(Boolean).join(', ')],
      ],
    },
    {
      title: isIndividual.value ? 'Identity' : 'Director / owner', step: 1,
      rows: [
        ...(isIndividual.value ? [] : [['Full name', s.director_full_name]]),
        ['Date of birth', dob],
        ['BVN', s.director_bvn],
        ['NIN', s.director_nin],
        ['ID', s.director_id_type ? `${idLabel(s.director_id_type)}${s.director_id_number ? ` · ${s.director_id_number}` : ''}` : null],
      ],
    },
  ]
})

const problems = computed(() => [
  ...props.state.progress.missing_fields.map((f) => ({ label: f.label, step: 1 })),
  ...props.state.progress.missing_docs.map((d) => ({ label: d.label, step: 2 })),
])
const docsByType = computed(() =>
  (entity.value?.documents ?? []).map((d) => ({ ...d, files: props.state.documents.filter((x) => x.document_type === d.type) })),
)

async function submit() {
  submitting.value = true
  error.value = ''
  try {
    emit('saved', await kycService.submit())
    emit('submitted')
  } catch (e) {
    error.value = apiError(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <h2 class="q-section-title">{{ readonly ? 'Your submission' : 'Review and submit' }}</h2>
    <p v-if="!readonly" class="q-help mb-5">Check everything is correct. You can go back to edit any section.</p>

    <div v-if="!readonly && problems.length" class="problems">
      <p class="font-semibold mb-2"><i class="mdi mdi-alert-circle-outline"></i> Before you can submit</p>
      <ul>
        <li v-for="p in problems" :key="p.label + p.step">
          {{ p.label }} <button type="button" class="q-link" @click="emit('goto', p.step)">Fix</button>
        </li>
      </ul>
    </div>

    <div v-if="sub" class="grid gap-4 mt-4">
      <div v-for="s in sections" :key="s.title" class="sec">
        <div class="flex justify-between items-center mb-2">
          <p class="font-bold">{{ s.title }}</p>
          <button v-if="!readonly" type="button" class="q-link text-sm" @click="emit('goto', s.step)">Edit</button>
        </div>
        <dl>
          <template v-for="[k, v] in s.rows" :key="k">
            <dt>{{ k }}</dt>
            <dd :class="{ 'dd--empty': !v }">{{ v || 'Not provided' }}</dd>
          </template>
        </dl>
      </div>

      <div class="sec">
        <div class="flex justify-between items-center mb-2">
          <p class="font-bold">Documents</p>
          <button v-if="!readonly" type="button" class="q-link text-sm" @click="emit('goto', 2)">Edit</button>
        </div>
        <ul class="docs">
          <li v-for="d in docsByType" :key="d.type">
            <i class="mdi" :class="d.files.length ? 'mdi-check-circle text-green-600' : 'mdi-circle-outline text-gray-400'"></i>
            <span>{{ d.label }}</span>
            <span class="q-help">{{ d.files.length ? d.files.map((f) => f.file_name).join(', ') : d.required ? 'Missing' : 'Not provided' }}</span>
          </li>
        </ul>
      </div>
    </div>

    <template v-if="!readonly">
      <v-checkbox v-model="confirmed" color="#2b7fff" hide-details class="mt-4"
        label="I confirm that the information and documents provided are accurate and belong to me or my organisation." />
      <p v-if="error" class="q-error mt-2">{{ error }}</p>
      <div class="flex justify-between mt-6">
        <v-btn class="q-btn-ghost" size="large" min-width="140" @click="emit('back')">Back</v-btn>
        <v-btn class="q-btn-primary" size="large" min-width="220" :disabled="!confirmed || problems.length > 0" :loading="submitting" @click="submit">
          Submit for review
        </v-btn>
      </div>
    </template>
  </div>
</template>

<style scoped>
.problems { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 12px; padding: 14px 18px; font-size: 14px; }
.problems ul { list-style: disc; padding-left: 20px; display: grid; gap: 4px; }
.sec { border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px 18px; background: #fff; }
dl { display: grid; grid-template-columns: 190px 1fr; gap: 6px 14px; font-size: 14px; }
dt { color: #6b7280; }
dd { color: #111827; word-break: break-word; }
.dd--empty { color: #9ca3af; }
.docs { display: grid; gap: 8px; font-size: 14px; }
.docs li { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
@media (max-width: 640px) { dl { grid-template-columns: 1fr; } dt { margin-top: 6px; } }
</style>
