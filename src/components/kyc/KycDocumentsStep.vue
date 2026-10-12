<script setup>
import { computed } from 'vue'
import '@/assets/quidly-events.css'
import KycDocumentRow from '@/components/kyc/KycDocumentRow.vue'

const props = defineProps({ state: { type: Object, required: true } })
const emit = defineEmits(['saved', 'next', 'back'])

const docs = computed(
  () => props.state.catalog.entity_types.find((t) => t.key === props.state.submission?.entity_type)?.documents ?? [],
)
const filesFor = (type) => props.state.documents.filter((d) => d.document_type === type)
const missing = computed(() => props.state.progress.missing_docs)
</script>

<template>
  <div>
    <h2 class="q-section-title">Upload documents</h2>
    <p class="q-help mb-5">PDF, JPG or PNG, up to 5MB each. Make sure every page is clear and readable.</p>

    <div class="grid gap-3">
      <KycDocumentRow v-for="d in docs" :key="d.type" :doc="d" :files="filesFor(d.type)" @changed="emit('saved', $event)" />
    </div>

    <p v-if="missing.length" class="q-help mt-4">Still needed: {{ missing.map((m) => m.label).join(', ') }}</p>

    <div class="flex justify-between mt-8">
      <v-btn class="q-btn-ghost" size="large" min-width="140" @click="emit('back')">Back</v-btn>
      <v-btn class="q-btn-primary" size="large" min-width="200" :disabled="missing.length > 0" @click="emit('next')">Continue</v-btn>
    </div>
  </div>
</template>
