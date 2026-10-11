<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '@/assets/quidly-events.css'
import PayoutAccountDialog from '@/components/events/PayoutAccountDialog.vue'
import { eventsService, apiError } from '@/services/eventsService'
import { formatLongDate, formatTimeRange, absoluteUrl } from '@/lib/eventHelpers'

const props = defineProps({ bundle: { type: Object, required: true } })
const emit = defineEmits(['saved', 'goto'])

const router = useRouter()
const payoutOpen = ref(false)
const publishing = ref(false)
const error = ref('')
const liveDialog = ref(false)
const copied = ref(false)

const event = computed(() => props.bundle.event)
const todo = computed(() => props.bundle.checklist.filter((i) => !i.done))
const isPublished = computed(() => event.value.status === 'published')
const link = computed(() => absoluteUrl(props.bundle.event_url))
const location = computed(() =>
  event.value.format === 'online'
    ? 'Online'
    : [event.value.venue_name, event.value.address, event.value.country].filter(Boolean).join(', '),
)

function act(item) {
  if (item.key === 'payout') payoutOpen.value = true
  else if (item.key === 'details') emit('goto', 'details')
  else if (item.key === 'tickets') emit('goto', 'tickets')
}

async function refresh() {
  emit('saved', await eventsService.get(event.value.id))
}

async function publish() {
  publishing.value = true
  error.value = ''
  try {
    emit('saved', await eventsService.publish(event.value.id))
    liveDialog.value = true
  } catch (e) {
    error.value = apiError(e)
    try { await refresh() } catch { /* ignore */ }
  } finally {
    publishing.value = false
  }
}

async function unpublish() {
  publishing.value = true
  error.value = ''
  try {
    emit('saved', await eventsService.unpublish(event.value.id))
  } catch (e) {
    error.value = apiError(e)
  } finally {
    publishing.value = false
  }
}

async function copy() {
  await navigator.clipboard.writeText(link.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1800)
}
</script>

<template>
  <div>
    <h1 class="q-title mb-6">{{ isPublished ? 'Your event is live' : 'Publish your event' }}</h1>

    <div class="summary">
      <div class="summary__img">
        <img v-if="event.banner_url" :src="event.banner_url" alt="" />
        <i v-else class="mdi mdi-image-outline"></i>
      </div>
      <div class="summary__body">
        <h2 class="text-2xl font-bold mb-4">{{ event.event_name }}</h2>
        <p class="row"><i class="mdi mdi-calendar-outline"></i>{{ formatLongDate(event.starts_at, event.timezone) }}</p>
        <p class="row"><i class="mdi mdi-clock-outline"></i>{{ formatTimeRange(event.starts_at, event.ends_at, event.timezone) }}</p>
        <p class="row"><i class="mdi mdi-map-marker-outline"></i>{{ location || 'Location not set' }}</p>
        <p v-if="link" class="row"><i class="mdi mdi-link-variant"></i><a :href="link" target="_blank" rel="noopener" class="q-link">{{ link }}</a></p>
      </div>
    </div>

    <div v-if="todo.length" class="q-soft pa-5 mt-6">
      <p class="text-sm flex items-center gap-2 mb-3"><i class="mdi mdi-information-outline"></i>Things to do before you publish your event</p>
      <ul class="todo">
        <li v-for="i in todo" :key="i.key">
          <button v-if="['payout', 'details', 'tickets'].includes(i.key)" type="button" class="q-link" style="color:#2b7fff" @click="act(i)">{{ i.label }}</button>
          <span v-else style="color:#2b7fff">{{ i.label }}</span>
        </li>
      </ul>
    </div>

    <p v-if="error" class="q-error mt-4 text-center">{{ error }}</p>

    <div class="flex justify-center gap-4 mt-8 mb-12">
      <v-btn class="q-btn-ghost" size="large" min-width="200" @click="router.push('/events')">Save</v-btn>
      <v-btn v-if="!isPublished" class="q-btn-primary" size="large" min-width="200" :disabled="!bundle.can_publish" :loading="publishing" @click="publish">Publish</v-btn>
      <v-btn v-else variant="outlined" size="large" min-width="200" class="!normal-case" :loading="publishing" @click="unpublish">Unpublish</v-btn>
    </div>

    <PayoutAccountDialog v-model="payoutOpen" @saved="refresh" />

    <v-dialog v-model="liveDialog" max-width="460">
      <v-card class="!rounded-xl text-center pa-6">
        <i class="mdi mdi-party-popper" style="font-size:48px;color:#2b7fff"></i>
        <h3 class="text-xl font-bold mt-2">Your event is live!</h3>
        <p class="q-help mb-4">Share this link so people can get their tickets.</p>
        <div class="linkbox">{{ link }}</div>
        <div class="flex gap-3 mt-5">
          <v-btn class="q-btn-ghost flex-1" @click="copy">{{ copied ? 'Copied!' : 'Copy link' }}</v-btn>
          <v-btn class="q-btn-primary flex-1" @click="router.push('/events')">Done</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.summary { display: flex; background: #f8f9fa; border-radius: 18px; overflow: hidden; }
.summary__img { width: 300px; min-height: 300px; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 56px; color: #9ca3af; flex-shrink: 0; }
.summary__img img { width: 100%; height: 100%; object-fit: cover; }
.summary__body { padding: 36px 40px; }
.row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; font-size: 14px; color: #1f2937; }
.row i { font-size: 20px; }
.todo { list-style: disc; padding-left: 22px; color: #2b7fff; display: grid; gap: 8px; font-size: 14px; }
.linkbox { background: #f3f4f6; border-radius: 10px; padding: 12px; font-family: monospace; font-size: 13px; word-break: break-all; }
@media (max-width: 720px) { .summary { flex-direction: column; } .summary__img { width: 100%; min-height: 220px; } }
</style>
