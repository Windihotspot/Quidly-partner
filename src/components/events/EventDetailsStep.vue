<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import '@/assets/quidly-events.css'
import RichTextEditor from '@/components/events/RichTextEditor.vue'
import DateTimeRow from '@/components/events/DateTimeRow.vue'
import LineupEditor from '@/components/events/LineupEditor.vue'
import { useAuthStore } from '@/stores/authStore'
import { eventsService, apiError } from '@/services/eventsService'
import {
  COUNTRIES, TIMEZONES, EVENT_FORMATS, CATEGORIES_PRIMARY, CATEGORIES_MORE, MAX_CATEGORIES,
  TIME_RE, zonedToUtcISO, isoToZoned,
} from '@/lib/eventHelpers'

const props = defineProps({ bundle: { type: Object, default: null } })
const emit = defineEmits(['saved', 'next'])

const router = useRouter()
const auth = useAuthStore()
const root = ref(null)

const firstName = computed(() => (auth.partner?.contact_name || '').split(' ')[0] || 'there')
const urlPrefix = (import.meta.env.VITE_PUBLIC_EVENT_BASE_URL || 'quidly.app/e').replace(/^https?:\/\//, '') + '/'

const form = reactive({
  name: '', description: '', country: 'Nigeria', venueName: '', address: '', slug: '',
  format: null, categories: [], timezone: 'Africa/Lagos',
  startDate: null, startTime: '', startAmpm: 'AM',
  endDate: null, endTime: '', endAmpm: 'AM',
  lineups: [],
  socials: { website: '', instagram: '', x: '', facebook: '' },
})
const errors = reactive({})
const saving = ref(false)
const saveError = ref('')
const showMoreCategories = ref(false)

const isPublished = computed(() => props.bundle?.event.status === 'published')
const needsLocation = computed(() => form.format !== 'online')
const categoryList = computed(() => (showMoreCategories.value ? [...CATEGORIES_PRIMARY, ...CATEGORIES_MORE] : CATEGORIES_PRIMARY))

// ---- hydrate once per event ---------------------------------------------------
let hydratedId = null
let originalSlug = ''
watch(
  () => props.bundle,
  (b) => {
    if (!b || b.event.id === hydratedId) return
    hydratedId = b.event.id
    const e = b.event
    const tz = e.timezone || 'Africa/Lagos'
    const s = isoToZoned(e.starts_at, tz)
    const en = isoToZoned(e.ends_at, tz)
    Object.assign(form, {
      name: e.event_name ?? '', description: e.description ?? '', country: e.country || 'Nigeria',
      venueName: e.venue_name ?? '', address: e.address ?? '', slug: e.slug ?? '',
      format: e.format ?? null, categories: [...(e.categories ?? [])], timezone: tz,
      startDate: s.date, startTime: s.time, startAmpm: s.ampm,
      endDate: en.date, endTime: en.time, endAmpm: en.ampm,
      lineups: (b.lineups ?? []).map((l) => ({ title: l.title, name: l.name, image_url: l.image_url })),
      socials: { website: '', instagram: '', x: '', facebook: '', ...(e.socials ?? {}) },
    })
    originalSlug = e.slug ?? ''
  },
  { immediate: true },
)

// ---- custom URL: sanitise + debounced availability check -------------------
const slugState = reactive({ checking: false, available: null, reason: '' })
let slugTimer = null
function onSlug(v) {
  form.slug = String(v ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '')
  slugState.available = null
  slugState.reason = ''
  clearTimeout(slugTimer)
  if (!form.slug || form.slug === originalSlug) return
  if (form.slug.length < 3) {
    slugState.available = false
    slugState.reason = 'URL must be at least 3 characters'
    return
  }
  slugState.checking = true
  slugTimer = setTimeout(async () => {
    try {
      const res = await eventsService.checkSlug(form.slug, props.bundle?.event.id)
      slugState.available = res.available
      slugState.reason = res.reason || ''
    } catch {
      slugState.available = null
    } finally {
      slugState.checking = false
    }
  }, 450)
}

function toggleCategory(c) {
  const i = form.categories.indexOf(c)
  if (i !== -1) return form.categories.splice(i, 1)
  if (form.categories.length >= MAX_CATEGORIES) {
    errors.categories = `Choose up to ${MAX_CATEGORIES} categories.`
    return
  }
  delete errors.categories
  form.categories.push(c)
}

// ---- validation + save --------------------------------------------------------
function validate() {
  Object.keys(errors).forEach((k) => delete errors[k])
  if (!form.name.trim()) errors.name = 'Enter an event name.'
  if (!form.description.trim()) errors.description = 'Describe your event.'
  if (!form.format) errors.format = 'Select how your event feels.'
  if (needsLocation.value) {
    if (!form.country) errors.country = 'Select a country.'
    if (!form.venueName.trim() && !form.address.trim()) errors.location = 'Enter the venue or address.'
  }
  if (!form.categories.length) errors.categories = 'Choose at least one category.'

  for (const k of ['start', 'end']) {
    const label = k === 'start' ? 'start' : 'end'
    if (!form[`${k}Date`]) errors[k] = `Pick a ${label} date.`
    else if (!TIME_RE.test(form[`${k}Time`])) errors[k] = `Enter a ${label} time like 09:30.`
  }
  if (!errors.start && !errors.end) {
    const a = zonedToUtcISO(form.startDate, form.startTime, form.startAmpm, form.timezone)
    const b = zonedToUtcISO(form.endDate, form.endTime, form.endAmpm, form.timezone)
    if (new Date(b) <= new Date(a)) errors.end = 'End must be after the start.'
  }
  if (slugState.available === false) errors.slug = slugState.reason || 'This URL is not available.'
  return Object.keys(errors).length === 0
}

async function submit() {
  saveError.value = ''
  if (!validate()) {
    await nextTick()
    root.value?.querySelector('.q-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  saving.value = true
  try {
    const payload = {
      event_id: props.bundle?.event.id,
      event_name: form.name.trim(),
      description: form.description,
      format: form.format,
      country: needsLocation.value ? form.country : form.country || null,
      venue_name: form.venueName.trim() || null,
      address: form.address.trim() || null,
      timezone: form.timezone,
      categories: form.categories,
      starts_at: zonedToUtcISO(form.startDate, form.startTime, form.startAmpm, form.timezone),
      ends_at: zonedToUtcISO(form.endDate, form.endTime, form.endAmpm, form.timezone),
      socials: form.socials,
      lineups: form.lineups,
    }
    if (!isPublished.value && form.slug && form.slug !== originalSlug) payload.slug = form.slug

    const bundle = await eventsService.save(payload)
    emit('saved', bundle)
    emit('next', bundle)
  } catch (e) {
    saveError.value = apiError(e)
    if (e?.response?.status === 409) slugState.available = false
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div ref="root" class="max-w-4xl">
    <h1 class="q-title">Hi {{ firstName }},</h1>
    <p class="q-help mb-8">Let's start with the basics.</p>

    <!-- Event details -->
    <h2 class="q-section-title mb-3">Event details</h2>
    <span class="q-label q-req">Event name</span>
    <v-text-field
      v-model="form.name"
      placeholder="Event name"
      variant="outlined"
      density="comfortable"
      color="#2b7fff"
      counter="75"
      maxlength="75"
      :error-messages="errors.name"
      class="mb-3"
    />

    <span class="q-label q-req">Describe your event</span>
    <RichTextEditor v-model="form.description" :error="errors.description" />
    <p v-if="errors.description" class="q-error">{{ errors.description }}</p>

    <!-- Location -->
    <h2 class="q-section-title mt-10 mb-3">Event location</h2>
    <span class="q-label" :class="{ 'q-req': needsLocation }">Country</span>
    <v-select
      v-model="form.country"
      :items="COUNTRIES"
      placeholder="Select country"
      variant="outlined"
      density="comfortable"
      color="#2b7fff"
      :error-messages="errors.country"
      class="mb-3"
    />
    <span class="q-label" :class="{ 'q-req': needsLocation }">Venue name</span>
    <v-text-field v-model="form.venueName" placeholder="e.g. Eko Convention Centre" variant="outlined" density="comfortable" color="#2b7fff" hide-details class="mb-3" />
    <span class="q-label">Address</span>
    <v-text-field v-model="form.address" placeholder="Street address, city" variant="outlined" density="comfortable" color="#2b7fff" hide-details />
    <p v-if="errors.location" class="q-error">{{ errors.location }}</p>

    <!-- Custom URL -->
    <div class="mt-8">
      <span class="q-label">Use custom URL</span>
      <div class="grid" style="grid-template-columns: auto 1fr">
        <div class="url-prefix">{{ urlPrefix }}</div>
        <v-text-field
          :model-value="form.slug"
          placeholder="Special characters like &^%$_# are not allowed"
          variant="outlined"
          density="comfortable"
          color="#2b7fff"
          hide-details
          :disabled="isPublished"
          :loading="slugState.checking"
          class="url-input"
          @update:model-value="onSlug"
        />
      </div>
      <p v-if="isPublished" class="q-help mt-1">The URL can't be changed after publishing.</p>
      <p v-else-if="slugState.available === true" class="mt-1 text-sm" style="color:#1b8a3a">This URL is available.</p>
      <p v-else-if="errors.slug || slugState.available === false" class="q-error">{{ errors.slug || slugState.reason }}</p>
      <p v-else-if="!form.slug" class="q-help mt-1">Leave blank and we'll generate one from your event name.</p>
    </div>

    <!-- Format -->
    <h2 class="q-section-title mt-10 mb-1">Event format</h2>
    <span class="q-label q-req">What does your event feel like?</span>
    <v-select
      v-model="form.format"
      :items="EVENT_FORMATS"
      placeholder="Select"
      variant="outlined"
      density="comfortable"
      color="#2b7fff"
      :error-messages="errors.format"
    />

    <!-- Category -->
    <h2 class="q-section-title mt-8 mb-1">Event Category</h2>
    <span class="q-label q-req">Choose the category that best describes your event (up to {{ MAX_CATEGORIES }}).</span>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="c in categoryList"
        :key="c"
        type="button"
        class="q-chip"
        :class="{ 'q-chip--on': form.categories.includes(c) }"
        @click="toggleCategory(c)"
      >
        {{ c }}
      </button>
    </div>
    <button type="button" class="q-link mt-3 text-sm" @click="showMoreCategories = !showMoreCategories">
      {{ showMoreCategories ? 'See less' : 'See more' }}
    </button>
    <p v-if="errors.categories" class="q-error">{{ errors.categories }}</p>

    <!-- Schedule -->
    <h2 class="q-section-title mt-10 mb-1">Event schedule</h2>
    <p class="q-help mb-3">Set the frequency, date and time.</p>
    <div class="flex gap-3 mb-5">
      <button type="button" class="sched sched--on">Single Event</button>
      <button type="button" class="sched" disabled title="Coming soon">Recurring Event <span class="soon">soon</span></button>
    </div>

    <span class="q-label q-req">Choose a time zone</span>
    <v-select v-model="form.timezone" :items="TIMEZONES" variant="outlined" density="comfortable" color="#2b7fff" class="mb-3" />

    <div class="grid gap-4">
      <DateTimeRow v-model:date="form.startDate" v-model:time="form.startTime" v-model:ampm="form.startAmpm" label="Start date" :error="errors.start" />
      <DateTimeRow v-model:date="form.endDate" v-model:time="form.endTime" v-model:ampm="form.endAmpm" label="End date" :error="errors.end" />
    </div>

    <!-- Lineup -->
    <h2 class="q-section-title mt-10 mb-1">Event Lineup</h2>
    <p class="q-help mb-3">Showcase speakers, headliners, artists of your event</p>
    <LineupEditor v-model="form.lineups" />

    <!-- Social -->
    <h2 class="q-section-title mt-10 mb-3">Social Details</h2>
    <div class="grid gap-3">
      <v-text-field v-model="form.socials.website" placeholder="https://yourwebsite.url/" prepend-inner-icon="mdi-link-variant" variant="outlined" density="comfortable" color="#2b7fff" hide-details />
      <v-text-field v-model="form.socials.instagram" placeholder="Your Instagram Handle" prepend-inner-icon="mdi-instagram" variant="outlined" density="comfortable" color="#2b7fff" hide-details />
      <v-text-field v-model="form.socials.x" placeholder="Your X(Twitter) Handle" prepend-inner-icon="mdi-twitter" variant="outlined" density="comfortable" color="#2b7fff" hide-details />
      <v-text-field v-model="form.socials.facebook" placeholder="Your Facebook URL" prepend-inner-icon="mdi-facebook" variant="outlined" density="comfortable" color="#2b7fff" hide-details />
    </div>

    <p v-if="saveError" class="q-error mt-6 text-center">{{ saveError }}</p>
   <div class="flex flex-col sm:flex-row justify-center gap-4 mt-10 mb-12">
  <v-btn
    class="q-btn-ghost w-full sm:w-auto"
    size="large"
    min-width="200"
    @click="router.push('/events')"
  >
    Cancel
  </v-btn>

  <v-btn
    class="q-btn-primary w-full sm:w-auto"
    size="large"
    min-width="200"
    :loading="saving"
    @click="submit"
  >
    Continue
  </v-btn>
</div>
  </div>
</template>

<style scoped>
.url-prefix { display: flex; align-items: center; padding: 0 14px; border: 1px solid #d1d5db; border-right: 0; border-radius: 10px 0 0 10px; background: #fff; color: #2b3e50; font-size: 14px; height: 48px; }
.url-input :deep(.v-field) { border-top-left-radius: 0; border-bottom-left-radius: 0; }
.sched { padding: 10px 18px; border: 1px solid #d1d5db; border-radius: 10px; background: #fff; color: #4b5563; font-weight: 500; }
.sched--on { background: #eaf2ff; border-color: #eaf2ff; color: #2b7fff; font-weight: 600; }
.sched:disabled { opacity: .55; cursor: not-allowed; }
.soon { font-size: 10px; text-transform: uppercase; margin-left: 4px; color: #9ca3af; }
</style>
