<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import '@/assets/quidly-events.css'
import MainLayout from '@/layouts/MainLayout.vue'
import { useEventsStore } from '@/stores/eventsStore'
import { apiError, apiDetails } from '@/services/eventsService'
import { formatNaira, formatShortDate, absoluteUrl } from '@/lib/eventHelpers'

const router = useRouter()
const store = useEventsStore()
const snackbar = ref({ show: false, text: '' })
const confirmDelete = ref(null)
const deleting = ref(false)
const busyId = ref(null)

const statusStyles = {
  published: { bg: '#e8f5e9', color: '#1b8a3a' },
  draft: { bg: '#fff3e0', color: '#b45309' },
  cancelled: { bg: '#fee2e2', color: '#b91c1c' },
  completed: { bg: '#e5e7eb', color: '#374151' },
}

onMounted(() => store.fetchEvents())

const notify = (text) => (snackbar.value = { show: true, text })

function createEvent() { router.push({ name: 'event-new' }) }
function edit(e) { router.push({ name: 'event-edit', params: { id: e.id, step: 'details' } }) }

function ticketsSummary(event) {
  const types = event.ticket_types ?? []
  const sold = types.reduce((s, t) => s + t.quantity_sold, 0)
  const unlimited = types.some((t) => t.quantity === null)
  const cap = types.reduce((s, t) => s + (t.quantity ?? 0), 0)
  return `${sold} / ${unlimited ? '∞' : cap}`
}
const chipLabel = (t) =>
  `${t.name} · ${t.is_free ? 'Free' : formatNaira(t.price)} · ${t.quantity_sold}/${t.quantity ?? '∞'} sold`

function venueLine(e) {
  const where = e.format === 'online' ? 'Online' : e.location || 'No venue yet'
  return `${where} · ${formatShortDate(e.starts_at)}`
}

async function copyLink(event) {
  await navigator.clipboard.writeText(absoluteUrl(event.event_url))
  notify('Event link copied.')
}

async function togglePublish(event) {
  busyId.value = event.id
  try {
    if (event.status === 'published') {
      await store.unpublish(event.id)
      notify(`${event.event_name} is now a draft.`)
    } else {
      await store.publish(event.id)
      notify(`${event.event_name} is live.`)
    }
  } catch (e) {
    if (e?.response?.status === 422 && Array.isArray(apiDetails(e))) {
      notify('Finish the remaining steps to publish.')
      router.push({ name: 'event-edit', params: { id: event.id, step: 'publish' } })
    } else {
      notify(apiError(e))
    }
  } finally {
    busyId.value = null
  }
}

async function doDelete() {
  deleting.value = true
  try {
    await store.removeDraft(confirmDelete.value.id)
    notify(`${confirmDelete.value.event_name} deleted.`)
  } catch (e) {
    notify(apiError(e))
  } finally {
    deleting.value = false
    confirmDelete.value = null
  }
}
</script>

<template>
  <MainLayout title="Events" subtitle="Create events and manage the ticket types partners can sell.">
    <div class="flex justify-end m-6">
      <v-btn class="create-btn" prepend-icon="mdi-plus" @click="createEvent">Create event</v-btn>
    </div>

    <div v-if="store.loading" class="py-16 text-center"><v-progress-circular indeterminate color="#2b7fff" /></div>
    <p v-else-if="store.error" class="text-center q-error py-12">{{ store.error }}</p>

    <div v-else class="grid gap-4 m-4">
      <div v-for="event in store.events" :key="event.id" class="event-card">
        <div class="flex items-center gap-4">
          <span class="icon-badge" style="background: #fff3e0">
            <img v-if="event.banner_url" :src="event.banner_url" alt="" class="thumb" />
            <i v-else class="mdi mdi-calendar-outline" style="color: #b45309"></i>
          </span>

          <div>
            <div class="flex items-center gap-3">
              <p class="font-display text-xl font-semibold event-name">{{ event.event_name }}</p>
              <span class="status-pill" :style="{ background: statusStyles[event.status]?.bg, color: statusStyles[event.status]?.color }">
                {{ event.status }}
              </span>
            </div>
            <p class="text-sm event-meta mt-1">{{ venueLine(event) }}</p>
            <div class="flex gap-2 mt-3 flex-wrap">
              <span v-for="tt in event.ticket_types" :key="tt.id" class="ticket-chip">{{ chipLabel(tt) }}</span>
              <span v-if="!event.ticket_types?.length" class="ticket-chip">No tickets created for this event yet</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-6">
          <div class="text-right">
            <p class="font-display text-lg font-bold event-name">{{ ticketsSummary(event) }}</p>
            <p class="text-[11px] event-meta font-mono uppercase">tickets sold</p>
          </div>
          <v-menu>
            <template #activator="{ props }">
              <v-btn icon="mdi-dots-vertical" variant="text" :loading="busyId === event.id" v-bind="props" />
            </template>
            <v-list density="compact" class="!rounded-xl">
              <v-list-item @click="edit(event)">Edit</v-list-item>
              <v-list-item v-if="event.status === 'published'" @click="copyLink(event)">Copy link</v-list-item>
              <v-list-item
                v-if="['draft', 'published'].includes(event.status)"
                class="!text-[#2b7fff]"
                @click="togglePublish(event)"
              >
                {{ event.status === 'published' ? 'Unpublish' : 'Publish' }}
              </v-list-item>
              <v-list-item v-if="event.status === 'draft'" class="!text-[#dc2626]" @click="confirmDelete = event">Delete</v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>

      <p v-if="!store.events.length" class="text-center event-meta text-sm py-12">No events yet — create your first one.</p>
    </div>

    <v-dialog :model-value="!!confirmDelete" max-width="400" @update:model-value="(v) => { if (!v) confirmDelete = null }">
      <v-card class="!rounded-xl pa-2">
        <v-card-title class="text-lg font-semibold">Delete draft?</v-card-title>
        <v-card-text>“{{ confirmDelete?.event_name }}” and its tickets will be permanently deleted.</v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn class="q-btn-ghost" @click="confirmDelete = null">Cancel</v-btn>
          <v-btn color="#dc2626" variant="flat" class="text-none" :loading="deleting" @click="doDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" timeout="2800">{{ snackbar.text }}</v-snackbar>
  </MainLayout>
</template>

<style scoped>
.v-btn { text-transform: none; }
.create-btn { background: #2b7fff !important; color: #fff !important; border-radius: 12px !important; font-weight: 600; }
.event-card { background: #fff; border-radius: 18px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); padding: 24px; display: flex; align-items: center; justify-content: space-between; transition: box-shadow 0.2s ease; }
.event-card:hover { box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06); }
.icon-badge { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px; overflow: hidden; }
.thumb { width: 100%; height: 100%; object-fit: cover; }
.event-name { color: #2b3e50; }
.event-meta { color: #6b7280; }
.status-pill { font-size: 11px; padding: 2px 10px; border-radius: 999px; font-weight: 600; text-transform: capitalize; }
.ticket-chip { font-family: monospace; font-size: 11px; color: white; background: #629ffa; padding: 4px 10px; border-radius: 8px; }
</style>
