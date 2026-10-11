<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import '@/assets/quidly-events.css'
import MainLayout from '@/layouts/MainLayout.vue'
import EventDetailsStep from '@/components/events/EventDetailsStep.vue'
import EventAppearanceStep from '@/components/events/EventAppearanceStep.vue'
import EventTicketsStep from '@/components/events/EventTicketsStep.vue'
import EventPublishStep from '@/components/events/EventPublishStep.vue'
import { eventsService, apiError } from '@/services/eventsService'

const props = defineProps({
  id: { type: String, default: null },
  step: { type: String, default: 'details' }, // details | appearance | tickets | publish
})

const router = useRouter()
const STEPS = [
  { key: 'details', label: 'Details' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'tickets', label: 'Tickets' },
]
const ORDER = ['details', 'appearance', 'tickets', 'publish']

const bundle = ref(null)
const loading = ref(false)
const error = ref('')

// "publish" is the review screen after the last step, so every stepper item shows complete
const currentIndex = computed(() => ORDER.indexOf(props.step))
const isDone = (i) => i < currentIndex.value
const isActive = (i) => i === currentIndex.value

async function load() {
  error.value = ''
  if (!props.id) {
    bundle.value = null
    return
  }
  if (bundle.value?.event.id === props.id) return // already have it (just created)
  loading.value = true
  try {
    bundle.value = await eventsService.get(props.id)
  } catch (e) {
    error.value = apiError(e, 'Could not load this event.')
  } finally {
    loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })

// Steps past "details" need an event to exist
watch(
  () => [props.step, props.id],
  ([step, id]) => {
    if (step !== 'details' && !id) router.replace({ name: 'event-new' })
  },
  { immediate: true },
)

function go(step, id = bundle.value?.event.id) {
  router.push({ name: 'event-edit', params: { id, step } })
}
function next(b) {
  const id = b?.event?.id ?? bundle.value?.event.id
  go(ORDER[Math.min(currentIndex.value + 1, ORDER.length - 1)], id)
}
function back() {
  if (currentIndex.value <= 0) return router.push('/events')
  go(ORDER[currentIndex.value - 1])
}
function jump(i) {
  if (bundle.value && i <= currentIndex.value) go(STEPS[i].key)
}
</script>

<template>
  <MainLayout title="Events" subtitle="Create your event and set up tickets.">
    <button type="button" class="back m-4" @click="back"><i class="mdi mdi-chevron-left"></i> Back</button>

    <!-- stepper -->
    <div class="stepper m-4">
      <template v-for="(s, i) in STEPS" :key="s.key">
        <button type="button" class="step" :class="{ 'step--on': isActive(i) || isDone(i) }" @click="jump(i)">
          <i class="mdi" :class="isDone(i) || isActive(i) ? 'mdi-check-circle' : 'mdi-circle-outline'"></i>
          <span>{{ s.label }}</span>
        </button>
        <span v-if="i < STEPS.length - 1" class="line" :class="{ 'line--on': isDone(i) }"></span>
      </template>
    </div>

    <div v-if="loading" class="py-24 text-center"><v-progress-circular indeterminate color="#2b7fff" /></div>
    <div v-else-if="error" class="py-16 text-center">
      <p class="q-error mb-4">{{ error }}</p>
      <v-btn class="q-btn-ghost" @click="router.push('/events')">Back to events</v-btn>
    </div>

    <template v-else>
      <div class="m-4">
        <EventDetailsStep v-if="step === 'details'" :bundle="bundle" @saved="bundle = $event" @next="next" />
      <EventAppearanceStep v-else-if="step === 'appearance' && bundle" :bundle="bundle" @saved="bundle = $event" @next="next" />
      <EventTicketsStep v-else-if="step === 'tickets' && bundle" :bundle="bundle" @saved="bundle = $event" @next="next" />
      <EventPublishStep v-else-if="step === 'publish' && bundle" :bundle="bundle" @saved="bundle = $event" @goto="go" />
      </div>
      
    </template>
  </MainLayout>
</template>

<style scoped>
.back { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; color: #374151; margin-bottom: 28px; background: none; border: 0; cursor: pointer; }
.stepper { display: flex; align-items: center; gap: 12px; margin-bottom: 36px; }
.step { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; color: #6b7280; background: none; border: 0; cursor: pointer; white-space: nowrap; }
.step i { font-size: 18px; }
.step--on { color: #2b7fff; }
.line { flex: 1; height: 1px; background: #d1d5db; }
.line--on { background: #2b7fff; }
</style>
