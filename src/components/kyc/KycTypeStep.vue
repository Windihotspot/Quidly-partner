<script setup>
import { ref, computed } from 'vue'
import '@/assets/quidly-events.css'
import { kycService, KYC_ENTITY_ICONS } from '@/services/kycService'
import { apiError } from '@/services/eventsService'

const props = defineProps({ state: { type: Object, required: true } })
const emit = defineEmits(['saved', 'next'])

const current = computed(() => props.state.submission?.entity_type ?? null)
const selected = ref(current.value)
const saving = ref(false)
const error = ref('')

const types = computed(() => props.state.catalog.entity_types)
const chosen = computed(() => types.value.find((t) => t.key === selected.value) ?? null)
const willPruneDocs = computed(() => current.value && selected.value !== current.value && props.state.documents.length > 0)

async function next() {
  if (!selected.value) return
  if (selected.value === current.value) return emit('next')
  saving.value = true
  error.value = ''
  try {
    emit('saved', await kycService.save({ entity_type: selected.value }))
    emit('next')
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <h2 class="q-section-title">What best describes you?</h2>
    <p class="q-help mb-5">Registered or not, you can sell tickets on Quidly. The documents we ask for depend on your choice.</p>

    <div class="grid gap-4 md:grid-cols-2">
      <button v-for="t in types" :key="t.key" type="button" class="card" :class="{ 'card--on': selected === t.key }" @click="selected = t.key">
        <i class="mdi card__icon" :class="KYC_ENTITY_ICONS[t.key]"></i>
        <span class="text-left">
          <span class="block font-bold">{{ t.label }}</span>
          <span class="block q-help">{{ t.description }}</span>
        </span>
      </button>
    </div>

    <div v-if="chosen" class="need q-soft">
      <p class="font-semibold mb-2">What you'll need</p>
      <ul>
        <li v-if="chosen.registration"><i class="mdi mdi-check"></i>{{ chosen.registration.label }}</li>
        <li v-if="chosen.tin !== 'none'"><i class="mdi mdi-check"></i>Tax Identification Number (TIN){{ chosen.tin === 'optional' ? ' (optional)' : '' }}</li>
        <li><i class="mdi mdi-check"></i>BVN, NIN and date of birth of {{ chosen.key === 'individual' ? 'you' : 'a director, owner or trustee' }}</li>
        <li v-for="d in chosen.documents" :key="d.type">
          <i class="mdi mdi-check"></i>{{ d.label }}<span v-if="!d.required" class="q-help"> (optional)</span>
        </li>
      </ul>
    </div>

    <p v-if="willPruneDocs" class="warn">Changing your account type removes any uploaded documents that are no longer needed.</p>
    <p v-if="error" class="q-error">{{ error }}</p>

    <div class="flex justify-end mt-8">
      <v-btn class="q-btn-primary" size="large" min-width="200" :disabled="!selected" :loading="saving" @click="next">Continue</v-btn>
    </div>
  </div>
</template>

<style scoped>
.card { display: flex; gap: 14px; align-items: flex-start; padding: 18px; border: 1.5px solid #e5e7eb; border-radius: 14px; background: #fff; cursor: pointer; transition: all .15s ease; }
.card:hover { border-color: #93c5fd; }
.card--on { border-color: #2b7fff; background: #f5f9ff; }
.card__icon { font-size: 30px; color: #2b7fff; }
.need { margin-top: 22px; padding: 18px 20px; font-size: 14px; }
.need ul { display: grid; gap: 6px; }
.need li i { color: #059669; margin-right: 8px; }
.warn { margin-top: 12px; font-size: 13px; color: #b45309; }
</style>
