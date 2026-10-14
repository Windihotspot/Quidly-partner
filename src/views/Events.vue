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
  completed: { bg: '#e5e7eb', color: '#374151' }
}

onMounted(() => store.fetchEvents())

const notify = (text) => (snackbar.value = { show: true, text })

function createEvent() {
  router.push({ name: 'event-new' })
}
function edit(e) {
  router.push({ name: 'event-edit', params: { id: e.id, step: 'details' } })
}

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
  <MainLayout
    title="Events"
    subtitle="Create events and manage the ticket types partners can sell."
  >
    <div class="flex justify-end m-6">
      <v-btn class="create-btn" prepend-icon="mdi-plus" @click="createEvent">Create event</v-btn>
    </div>

    <div v-if="store.loading" class="py-16 text-center">
      <v-progress-circular indeterminate color="#2b7fff" />
    </div>
    <p v-else-if="store.error" class="text-center q-error py-12">{{ store.error }}</p>

    <div v-else class="grid gap-4 m-4">
      <div v-for="event in store.events" :key="event.id" class="event-card">
        <!-- Left: event information -->
        <div class="event-card-info">
          <span class="icon-badge" style="background: #fff3e0">
            <img v-if="event.banner_url" :src="event.banner_url" alt="" class="thumb" />
            <i v-else class="mdi mdi-calendar-outline" style="color: #b45309"></i>
          </span>

          <div class="event-details">
            <div class="event-heading">
              <p class="font-display text-xl font-semibold event-name">
                {{ event.event_name }}
              </p>

              <span
                class="status-pill"
                :style="{
                  background: statusStyles[event.status]?.bg,
                  color: statusStyles[event.status]?.color
                }"
              >
                {{ event.status }}
              </span>
            </div>

            <p class="text-sm event-meta mt-1">
              {{ venueLine(event) }}
            </p>

            <div v-if="event.event_url" class="event-url-row">
              <a
                :href="absoluteUrl(event.event_url)"
                target="_blank"
                rel="noopener noreferrer"
                class="event-url"
                :title="absoluteUrl(event.event_url)"
              >
                <i class="mdi mdi-link-variant"></i>
                <span>{{ absoluteUrl(event.event_url) }}</span>
              </a>

              <button
                type="button"
                class="copy-url-btn"
                title="Copy event URL"
                aria-label="Copy event URL"
                @click.stop="copyLink(event)"
              >
                <i class="mdi mdi-content-copy"></i>
              </button>
            </div>

            <div class="flex gap-2 mt-3 flex-wrap">
              <span v-for="tt in event.ticket_types" :key="tt.id" class="ticket-chip">
                {{ chipLabel(tt) }}
              </span>

              <span v-if="!event.ticket_types?.length" class="ticket-chip">
                No tickets created for this event yet
              </span>
            </div>
          </div>
        </div>

        <!-- Right: ticket summary and action menu -->
        <div class="event-card-actions">
          <div class="text-right ticket-summary">
            <p class="font-display text-lg font-bold event-name">
              {{ ticketsSummary(event) }}
            </p>
            <p class="text-[11px] event-meta font-mono uppercase">tickets sold</p>
          </div>

          <v-menu>
            <template #activator="{ props }">
              <v-btn
                icon="mdi-dots-vertical"
                variant="text"
                :loading="busyId === event.id"
                v-bind="props"
              />
            </template>

            <v-list density="compact" class="!rounded-xl">
              <v-list-item @click="edit(event)">Edit</v-list-item>
              <v-list-item v-if="event.status === 'published'" @click="copyLink(event)">
                Copy link
              </v-list-item>
              <v-list-item
                v-if="['draft', 'published'].includes(event.status)"
                class="!text-[#2b7fff]"
                @click="togglePublish(event)"
              >
                {{ event.status === 'published' ? 'Unpublish' : 'Publish' }}
              </v-list-item>
              <v-list-item
                v-if="event.status === 'draft'"
                class="!text-[#dc2626]"
                @click="confirmDelete = event"
              >
                Delete
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>

      <p v-if="!store.events.length" class="text-center event-meta text-sm py-12">
        No events yet — create your first one.
      </p>
    </div>

    <v-dialog
      :model-value="!!confirmDelete"
      max-width="400"
      @update:model-value="
        (v) => {
          if (!v) confirmDelete = null
        }
      "
    >
      <v-card class="!rounded-xl pa-2">
        <v-card-title class="text-lg font-semibold">Delete draft?</v-card-title>
        <v-card-text
          >“{{ confirmDelete?.event_name }}” and its tickets will be permanently
          deleted.</v-card-text
        >
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn class="q-btn-ghost" @click="confirmDelete = null">Cancel</v-btn>
          <v-btn
            color="#dc2626"
            variant="flat"
            class="text-none"
            :loading="deleting"
            @click="doDelete"
            >Delete</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" timeout="2800">{{ snackbar.text }}</v-snackbar>
  </MainLayout>
</template>


<style scoped>
.v-btn {
  text-transform: none;
}

.create-btn {
  background: #2b7fff !important;
  color: #fff !important;
  border-radius: 12px !important;
  font-weight: 600;
}

/* Event card */
.event-card {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  transition: box-shadow 0.2s ease;
}

.event-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

/* Event information */
.event-card-info {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex: 1 1 auto;
  min-width: 0;
}

.event-details {
  flex: 1 1 auto;
  min-width: 0;
}

.event-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
}

.event-name {
  color: #2b3e50;
  overflow-wrap: anywhere;
  word-break: normal;
}

.event-heading .event-name {
  min-width: 0;
  margin: 0;
}

.event-meta {
  color: #6b7280;
  overflow-wrap: anywhere;
}

/* Event thumbnail */
.icon-badge {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
  overflow: hidden;
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Status */
.status-pill {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 600;
  text-transform: capitalize;
  white-space: nowrap;
}

/* Ticket chips */
.ticket-chip {
  display: inline-block;
  max-width: 100%;
  box-sizing: border-box;
  font-family: monospace;
  font-size: 11px;
  color: white;
  background: #1a72f7;
  padding: 4px 10px;
  border-radius: 8px;
  overflow-wrap: anywhere;
  white-space: normal;
  line-height: 1.5;
}

/* Event URL */
.event-url-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  min-width: 0;
  max-width: 100%;
}

.event-url {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
  color: #2b7fff;
  font-size: 12px;
  text-decoration: none;
}

.event-url:hover {
  text-decoration: underline;
}

.event-url > i {
  flex-shrink: 0;
}

.event-url > span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-url-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.copy-url-btn:hover {
  background: #eff6ff;
  color: #2b7fff;
}

.copy-url-btn i {
  font-size: 16px;
}

/* Ticket summary and actions */
.event-card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex: 0 0 auto;
  min-width: 0;
}

.ticket-summary {
  text-align: right;
  white-space: nowrap;
}

.ticket-summary p {
  margin: 0;
}

/* Tablet and mobile */
@media (max-width: 600px) {
  .event-card {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 16px;
  }

  .event-card-info {
    width: 100%;
    gap: 12px;
  }

  .event-details {
    width: 100%;
  }

  .icon-badge {
    width: 40px;
    height: 40px;
  }

  .event-heading {
    align-items: flex-start;
    gap: 6px 8px;
  }

  .event-heading .event-name {
    font-size: 16px;
    line-height: 1.4;
  }

  .event-meta {
    font-size: 12px;
    line-height: 1.5;
  }

  .event-card-actions {
    width: 100%;
    box-sizing: border-box;
    justify-content: space-between;
    padding-top: 12px;
    border-top: 1px solid #f1f5f9;
  }

  .ticket-summary {
    text-align: left;
  }

  .ticket-summary .event-name {
    font-size: 17px;
  }

  .event-url-row {
    width: 100%;
  }

  .event-url {
    max-width: 100%;
  }

  .ticket-chip {
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }
}

/* Very narrow phones */
@media (max-width: 380px) {
  .event-card {
    padding: 12px;
    gap: 12px;
  }

  .event-card-info {
    gap: 10px;
  }

  .icon-badge {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .event-heading .event-name {
    font-size: 15px;
  }

  .status-pill {
    font-size: 10px;
    padding: 3px 8px;
  }

  .ticket-chip {
    font-size: 10px;
    padding: 4px 8px;
  }
}
</style>

