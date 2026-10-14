<script setup>
import { ref, computed, watch } from 'vue'
import '@/assets/quidly-events.css'
import TicketDialog from '@/components/events/TicketDialog.vue'
import { eventsService, apiError } from '@/services/eventsService'
import { formatNaira } from '@/lib/eventHelpers'

const props = defineProps({ bundle: { type: Object, required: true } })
const emit = defineEmits(['saved', 'next'])

const pricingUrl = import.meta.env.VITE_PRICING_URL || '#'
const eventId = computed(() => props.bundle.event.id)

const rows = ref([...props.bundle.ticket_types])
const originalOrder = ref(rows.value.map((t) => t.id))
const dialog = ref(false)
const editing = ref(null)
const savingOrder = ref(false)
const deleting = ref(null) // ticket pending delete confirmation
const deleteBusy = ref(false)
const error = ref('')
const dragIndex = ref(null)

watch(() => props.bundle.ticket_types, (t) => adopt(t))
function adopt(list) {
  rows.value = [...list]
  originalOrder.value = list.map((t) => t.id)
}

const orderDirty = computed(() => rows.value.map((t) => t.id).join() !== originalOrder.value.join())

// bubble the fresh ticket list up so the wizard's bundle (and checklist) stay accurate
async function refreshBundle() {
  const b = await eventsService.get(eventId.value)
  emit('saved', b)
}
async function onTicketsSaved(list) {
  adopt(list)
  try { await refreshBundle() } catch { /* non-fatal */ }
}

function openCreate() { editing.value = null; dialog.value = true }
function openEdit(t) { editing.value = t; dialog.value = true }

// ---- drag to reorder (native DnD) -------------------------------------------
function onDrop(i) {
  if (dragIndex.value === null || dragIndex.value === i) return
  const next = [...rows.value]
  const [moved] = next.splice(dragIndex.value, 1)
  next.splice(i, 0, moved)
  rows.value = next
  dragIndex.value = null
}

async function saveOrder() {
  savingOrder.value = true
  error.value = ''
  try {
    const res = await eventsService.tickets.reorder(eventId.value, rows.value.map((t) => t.id))
    adopt(res.ticket_types)
    await refreshBundle()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    savingOrder.value = false
  }
}

async function confirmDelete() {
  deleteBusy.value = true
  error.value = ''
  try {
    const res = await eventsService.tickets.remove(eventId.value, deleting.value.id)
    deleting.value = null
    await onTicketsSaved(res.ticket_types)
  } catch (e) {
    error.value = apiError(e)
    deleting.value = null
  } finally {
    deleteBusy.value = false
  }
}

const tag = (t) => `${t.kind === 'group' ? 'Group' : 'Single'} Ticket`
const soldLabel = (t) => `${t.quantity_sold} / ${t.quantity ?? 'Unlimited'}`
const priceLabel = (t) => (t.is_free ? 'Free' : formatNaira(t.price))
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h1 class="q-title">Set up tickets</h1>
      <v-btn v-if="rows.length" variant="outlined" prepend-icon="mdi-plus" class="!normal-case" @click="openCreate">Add ticket</v-btn>
    </div>

    <p class="text-sm font-semibold mb-2" style="color:#2b7fff">Ticket details</p>
    <v-divider class="mb-5" />

    <div class="q-soft px-4 py-3 text-sm mb-6">
      We only charge a service fee on paid tickets. For more details, check our
      <a :href="pricingUrl" target="_blank" rel="noopener" class="q-link">pricing page</a>.
    </div>

    <!-- empty state -->
    <div v-if="!rows.length" class="q-soft empty">
      <i class="mdi mdi-ticket-confirmation-outline" style="font-size:54px;color:#2b7fff"></i>
      <p class="font-bold mt-3">Create your first ticket</p>
      <p class="q-help mb-4">Set up paid and free tickets so people can attend your event.</p>
      <v-btn class="q-btn-primary" prepend-icon="mdi-plus" @click="openCreate">Create ticket</v-btn>
    </div>

    <!-- list -->

<div v-else class="tbl">
  <!-- Desktop table header -->
  <div class="tbl__head hidden md:grid">
    <span></span>
    <span>Ticket name</span>
    <span>Tickets sold</span>
    <span>Ticket price</span>
    <span>Tag</span>
    <span></span>
  </div>

  <div
    v-for="(t, i) in rows"
    :key="t.id"
    class="tbl__row"
    draggable="true"
    @dragstart="dragIndex = i"
    @dragover.prevent
    @drop.prevent="onDrop(i)"
  >
    <!-- Drag handle -->
    <i
      class="mdi mdi-drag-horizontal-variant drag"
      title="Drag to reorder"
    ></i>

    <!-- Ticket name -->
    <div class="ticket-name">
      <span class="font-medium">{{ t.name }}</span>

      <!-- Mobile details -->
      <div class="ticket-mobile-details md:hidden">
        <div class="ticket-detail">
          <span class="ticket-detail__label">Tickets sold</span>
          <span>{{ soldLabel(t) }}</span>
        </div>

        <div class="ticket-detail">
          <span class="ticket-detail__label">Ticket price</span>
          <span>{{ priceLabel(t) }}</span>
        </div>

        <div class="ticket-tags">
          <span class="tag">{{ tag(t) }}</span>
          <span v-if="t.invite_only" class="tag tag--alt">
            Invite-only
          </span>
        </div>
      </div>
    </div>

    <!-- Desktop-only columns -->
    <span class="hidden md:block">{{ soldLabel(t) }}</span>
    <span class="hidden md:block">{{ priceLabel(t) }}</span>

    <span class="hidden md:flex gap-2 flex-wrap">
      <span class="tag">{{ tag(t) }}</span>
      <span v-if="t.invite_only" class="tag tag--alt">
        Invite-only
      </span>
    </span>

    <!-- Actions -->
    <div class="ticket-actions">
      <v-menu>
        <template #activator="{ props: m }">
          <v-btn
            icon="mdi-dots-vertical"
            variant="text"
            size="small"
            v-bind="m"
          />
        </template>

        <v-list density="compact" class="!rounded-xl">
          <v-list-item @click="openEdit(t)">
            Edit
          </v-list-item>

          <v-list-item
            class="!text-[#dc2626]"
            :disabled="t.quantity_sold > 0"
            @click="deleting = t"
          >
            Delete
          </v-list-item>
        </v-list>
      </v-menu>
    </div>
  </div>
</div>


    <p v-if="error" class="q-error mt-3 text-center">{{ error }}</p>

    <div v-if="rows.length" class="flex justify-center my-8">
      <v-btn class="q-btn-primary" size="large" min-width="260" :disabled="!orderDirty" :loading="savingOrder" @click="saveOrder">
        Save changes
      </v-btn>
    </div>

    <div class="flex justify-center gap-4 mt-10 mb-12">
      <v-btn class="q-btn-ghost" size="large" min-width="180" @click="emit('next')">Do it later</v-btn>
      <v-btn class="q-btn-primary" size="large" min-width="180" :disabled="!rows.length || orderDirty" @click="emit('next')">Continue</v-btn>
    </div>

    <TicketDialog v-model="dialog" :event-id="eventId" :ticket="editing" @saved="onTicketsSaved" />

    <v-dialog :model-value="!!deleting" max-width="400" @update:model-value="(v) => { if (!v) deleting = null }">
      <v-card class="!rounded-xl pa-2">
        <v-card-title class="text-lg font-semibold">Delete ticket?</v-card-title>
        <v-card-text>“{{ deleting?.name }}” will be removed from this event.</v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn class="q-btn-ghost" @click="deleting = null">Cancel</v-btn>
          <v-btn color="#dc2626" variant="flat" class="text-none" :loading="deleteBusy" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.empty { display: flex; flex-direction: column; align-items: center; padding: 56px 16px; text-align: center; }
/* Desktop table */
.tbl {
  width: 100%;
  min-width: 0;
}

.tbl__head,
.tbl__row {
  display: grid;
  grid-template-columns: 28px minmax(140px, 1.5fr)
    minmax(100px, 1fr) minmax(100px, 1fr)
    minmax(130px, 1.2fr) 40px;
  align-items: center;
  gap: 12px;
}

.tbl__head {
  padding: 14px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  border-bottom: 1px solid #e5e7eb;
}

.tbl__row {
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
}

.ticket-name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ticket-actions {
  display: flex;
  justify-content: flex-end;
}

.ticket-mobile-details {
  display: none;
}

/* Mobile ticket cards */
@media (max-width: 767px) {
  .tbl__row {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 36px;
    gap: 10px;
    align-items: start;
    padding: 16px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    margin-bottom: 12px;
    background: #fff;
  }

  .ticket-name {
    min-width: 0;
    padding-top: 5px;
  }

  .ticket-mobile-details {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 14px;
  }

  .ticket-detail {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    font-size: 13px;
  }

  .ticket-detail__label {
    color: #64748b;
    flex-shrink: 0;
  }

  .ticket-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ticket-actions {
    grid-column: 3;
    grid-row: 1;
  }

  .drag {
    padding-top: 5px;
  }

  .tbl__head {
    display: none;
  }
}
.tbl__row { min-height: 60px; border-top: 1px solid #e5e7eb; font-size: 14px; }
.tbl__row[draggable='true'] { cursor: grab; }
.drag { color: #9ca3af; font-size: 22px; }
.tag { background: #eaf2ff; color: #2b7fff; font-weight: 600; font-size: 12px; padding: 4px 10px; border-radius: 8px; }
.tag--alt { background: #fff3e0; color: #b45309; }
</style>
