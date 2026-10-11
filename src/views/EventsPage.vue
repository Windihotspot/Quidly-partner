<script setup>
import { ref, reactive, computed } from 'vue'
import { mockEvents, formatNaira, simulateDelay } from '@/lib/mockData'
import MainLayout from '@/layouts/MainLayout.vue'

const events = ref(JSON.parse(JSON.stringify(mockEvents)))
const dialog = ref(false)
const saving = ref(false)
const datePickerOpen = ref(false)
const snackbar = ref({ show: false, text: '' })

// Status pill styling, lifted from the sidebar's pastel icon-badge palette
const statusStyles = {
  published: { bg: '#e8f5e9', color: '#1b8a3a' },
  draft: { bg: '#fff3e0', color: '#b45309' },
}

const form = reactive({
  name: '',
  venue: '',
  date: null,        // Date object from v-date-picker
  time: '',           // HH:mm from time field
  ticketName: '',
  ticketPrice: null,
  ticketCapacity: null,
})

const formattedDate = computed(() =>
  form.date
    ? new Date(form.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
)

function resetForm() {
  Object.assign(form, {
    name: '', venue: '', date: null, time: '',
    ticketName: '', ticketPrice: null, ticketCapacity: null,
  })
}

function openCreate() {
  resetForm()
  dialog.value = true
}

function combineDateTime(date, time) {
  const d = new Date(date)
  if (time) {
    const [hh, mm] = time.split(':').map(Number)
    d.setHours(hh, mm, 0, 0)
  }
  return d.toISOString()
}

async function handleCreate() {
  if (!form.name || !form.venue || !form.date) return
  saving.value = true
  await simulateDelay(1000)
  events.value.unshift({
    id: `evt_${Date.now()}`,
    name: form.name,
    venue: form.venue,
    date: combineDateTime(form.date, form.time),
    status: 'draft',
    ticketTypes: form.ticketName
      ? [{ id: `tt_${Date.now()}`, name: form.ticketName, price: Number(form.ticketPrice) || 0, capacity: Number(form.ticketCapacity) || 0, sold: 0 }]
      : [],
  })
  saving.value = false
  dialog.value = false
  snackbar.value = { show: true, text: 'Event created as draft.' }
}

async function togglePublish(event) {
  event.status = event.status === 'published' ? 'draft' : 'published'
  snackbar.value = { show: true, text: `${event.name} is now ${event.status}.` }
}

async function deleteEvent(event) {
  events.value = events.value.filter((e) => e.id !== event.id)
  snackbar.value = { show: true, text: `${event.name} deleted.` }
}

function ticketsSummary(event) {
  const sold = event.ticketTypes.reduce((sum, t) => sum + t.sold, 0)
  const capacity = event.ticketTypes.reduce((sum, t) => sum + t.capacity, 0)
  return `${sold} / ${capacity}`
}
</script>

<template>
  <MainLayout title="Events" subtitle="Create events and manage the ticket types partners can sell.">
    <div class="flex justify-end m-6">
      <v-btn class="create-btn" prepend-icon="mdi-plus" @click="openCreate">Create event</v-btn>
    </div>

    <div class="grid gap-4 m-4">
      <div v-for="event in events" :key="event.id" class="event-card">
        <div class="flex items-center gap-4">
          <span class="icon-badge" style="background: #fff3e0">
            <i class="mdi mdi-calendar-outline" style="color: #b45309"></i>
          </span>

          <div>
            <div class="flex items-center gap-3">
              <p class="font-display text-xl font-semibold event-name">{{ event.name }}</p>
              <span
                class="status-pill"
                :style="{ background: statusStyles[event.status].bg, color: statusStyles[event.status].color }"
              >
                {{ event.status }}
              </span>
            </div>
            <p class="text-sm event-meta mt-1">{{ event.venue }} · {{ new Date(event.date).toLocaleDateString() }}</p>
            <div class="flex gap-2 mt-3 flex-wrap">
              <span v-for="tt in event.ticketTypes" :key="tt.id" class="ticket-chip">
                {{ tt.name }} · {{ formatNaira(tt.price) }} · {{ tt.sold }}/{{ tt.capacity }} sold
              </span>
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
              <v-btn icon="mdi-dots-vertical" variant="text" v-bind="props" />
            </template>
            <v-list density="compact" class="!rounded-xl">
              <v-list-item class="!text-[#2b7fff]" @click="togglePublish(event)">
                {{ event.status === 'published' ? 'Unpublish' : 'Publish' }}
              </v-list-item>
              <v-list-item class="!text-[#dc2626]" @click="deleteEvent(event)">Delete</v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>

      <p v-if="!events.length" class="text-center event-meta text-sm py-12">No events yet — create your first one.</p>
    </div>

    <v-dialog v-model="dialog" max-width="480">
      <v-card class="!rounded-xl">
        <v-card-title class="font-display text-xl">Create event</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="Event name" variant="outlined" density="comfortable" color="#2b7fff" class="mb-1" />
          <v-text-field v-model="form.venue" label="Venue" variant="outlined" density="comfortable" color="#2b7fff" class="mb-1" />

          <div class="grid grid-cols-2 gap-3 mb-1">
            <v-menu v-model="datePickerOpen" :close-on-content-click="false" location="bottom start">
              <template #activator="{ props }">
                <v-text-field
                  v-bind="props"
                  :model-value="formattedDate"
                  label="Event date"
                  readonly
                  variant="outlined"
                  density="comfortable"
                  color="#2b7fff"
                  prepend-inner-icon="mdi-calendar-outline"
                />
              </template>
              <v-date-picker
                v-model="form.date"
                color="#2b7fff"
                show-adjacent-months
                @update:model-value="datePickerOpen = false"
              />
            </v-menu>

            <v-text-field
              v-model="form.time"
              label="Time"
              type="time"
              variant="outlined"
              density="comfortable"
              color="#2b7fff"
              prepend-inner-icon="mdi-clock-outline"
            />
          </div>

          <v-divider class="my-3" />
          <p class="text-xs font-mono uppercase tracking-widest event-meta mb-2">First ticket type (optional)</p>
          <v-text-field v-model="form.ticketName" label="Ticket name" variant="outlined" density="comfortable" color="#2b7fff" class="mb-1" />
          <div class="grid grid-cols-2 gap-3">
            <v-text-field v-model="form.ticketPrice" label="Price (₦)" type="number" variant="outlined" density="comfortable" color="#2b7fff" />
            <v-text-field v-model="form.ticketCapacity" label="Capacity" type="number" variant="outlined" density="comfortable" color="#2b7fff" />
          </div>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn class="save-btn" :loading="saving" @click="handleCreate">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" timeout="2200">{{ snackbar.text }}</v-snackbar>
  </MainLayout>
</template>

<style scoped>
.v-btn{
  text-transform: none;
}
.create-btn {
  background: #2b7fff !important;
  color: #fff !important;
  border-radius: 12px !important;
  font-weight: 600;
}

.save-btn {
  background: #2b7fff !important;
  color: #fff !important;
  border-radius: 10px !important;
}

.event-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: box-shadow 0.2s ease;
}

.event-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.icon-badge {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
}

.event-name {
  color: #2b3e50;
}

.event-meta {
  color: #6b7280;
}

.status-pill {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 600;
  text-transform: capitalize;
}

.ticket-chip {
  font-family: monospace;
  font-size: 11px;
  color: #4b5563;
  background: #f8f9fa;
  padding: 4px 10px;
  border-radius: 8px;
}
</style>