<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import DOMPurify from 'dompurify'
import PublicTicketPicker from '@/components/public/PublicTicketPicker.vue'
import { publicEventService } from '@/services/publicEventService'
import { apiError } from '@/services/eventsService'
import { THEMES, formatLongDate, formatTimeRange } from '@/lib/eventHelpers'

const props = defineProps({ slug: { type: String, required: true } })
const route = useRoute()

const data = ref(null)
const loading = ref(true)
const notFound = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  notFound.value = false
  error.value = ''
  try {
    data.value = await publicEventService.getEvent(props.slug)
    document.title = `${data.value.event.event_name} · Quidly`
  } catch (e) {
    if (e?.response?.status === 404) notFound.value = true
    else error.value = apiError(e, 'Could not load this event.')
  } finally {
    loading.value = false
  }
}
watch(() => props.slug, load, { immediate: true })

const event = computed(() => data.value?.event)
const theme = computed(() => THEMES.find((t) => t.id === event.value?.theme) ?? THEMES[0])
const dark = computed(() => theme.value.id === 'midnight')
const cssVars = computed(() => ({
  '--bg': theme.value.bg,
  '--text': theme.value.text,
  '--accent': theme.value.accent,
  '--card': dark.value ? '#111c33' : '#ffffff',
  '--line': dark.value ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.1)',
  '--muted': dark.value ? 'rgba(248,250,252,.65)' : '#6b7280'
}))

// Server sanitises on save; sanitise again at render as defence in depth
const description = computed(() => DOMPurify.sanitize(event.value?.description ?? ''))

const isOnline = computed(() => event.value?.format === 'online')
const place = computed(() =>
  [event.value?.venue_name, event.value?.address, event.value?.country].filter(Boolean).join(', ')
)
const mapsUrl = computed(
  () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.value)}`
)

const lineupGroups = computed(() => {
  const groups = new Map()
  for (const l of data.value?.lineups ?? [])
    groups.set(l.title, [...(groups.get(l.title) ?? []), l])
  return [...groups].map(([title, people]) => ({ title, people }))
})

const socials = computed(() => {
  const s = event.value?.socials ?? {}
  return [
    s.website && { icon: 'mdi-web', label: 'Website', href: s.website },
    s.instagram && {
      icon: 'mdi-instagram',
      label: 'Instagram',
      href: `https://instagram.com/${s.instagram}`
    },
    s.x && { icon: 'mdi-twitter', label: 'X', href: `https://x.com/${s.x}` },
    s.facebook && { icon: 'mdi-facebook', label: 'Facebook', href: s.facebook }
  ].filter(Boolean)
})

// Gateways redirect back with ?reference=... (or ?trxref=...)
const returnedRef = computed(() => route.query.reference || route.query.trxref || null)
</script>

<template>
  <div class="page" :style="cssVars">
    <div v-if="loading" class="center"><v-progress-circular indeterminate color="#2b7fff" /></div>

    <div v-else-if="notFound" class="center">
      <h1 class="big">Event not found</h1>
      <p class="muted">This link may be wrong, or the event isn't published.</p>
    </div>

    <div v-else-if="error" class="center">
      <p class="err">{{ error }}</p>
      <button type="button" class="retry" @click="load">Try again</button>
    </div>

    <main v-else-if="event" class="wrap">
      <div v-if="returnedRef" class="banner">
        <i class="mdi mdi-check-circle-outline"></i>
        Thanks! We've received your payment. Reference <code>{{ returnedRef }}</code
        >. Your tickets are being confirmed.
      </div>

      <section class="hero">
        <div class="poster">
          <img v-if="event.banner_url" :src="event.banner_url" :alt="event.event_name" />
          <i v-else class="mdi mdi-image-outline"></i>
        </div>

        <div class="hero__info">
          <p v-if="event.categories?.length" class="cats">
            {{ event.categories.slice(0, 3).join(' · ') }}
          </p>
          <h1 class="title">{{ event.event_name }}</h1>
          <p v-if="data.organizer.business_name" class="muted">
            By {{ data.organizer.business_name }}
          </p>

          <p class="row">
            <i class="mdi mdi-calendar-outline"></i
            >{{ formatLongDate(event.starts_at, event.timezone) }}
          </p>
          <p class="row">
            <i class="mdi mdi-clock-outline"></i
            >{{ formatTimeRange(event.starts_at, event.ends_at, event.timezone) }}
          </p>
          <p class="row">
            <i :class="isOnline ? 'mdi mdi-video-outline' : 'mdi mdi-map-marker-outline'"></i>
            <span v-if="isOnline">Online event</span>
            <a v-else-if="place" :href="mapsUrl" target="_blank" rel="noopener">{{ place }}</a>
            <span v-else>Location to be announced</span>
          </p>

          <div v-if="socials.length" class="socials">
            <a
              v-for="s in socials"
              :key="s.label"
              :href="s.href"
              target="_blank"
              rel="noopener"
              :title="s.label"
              ><i class="mdi" :class="s.icon"></i
            ></a>
          </div>
        </div>
      </section>

      <section class="cols">
        <div class="left">
          <div v-if="description" class="about">
            <h2>About this event</h2>
            <div class="rich" v-html="description"></div>
          </div>

          <div v-for="g in lineupGroups" :key="g.title" class="lineup">
            <h2>{{ g.title }}</h2>
            <div class="people">
              <div v-for="p in g.people" :key="p.id" class="person">
                <img v-if="p.image_url" :src="p.image_url" :alt="p.name" />
                <span v-else class="avatar">{{ p.name.charAt(0).toUpperCase() }}</span>
                <span>{{ p.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <aside class="right">
          <PublicTicketPicker
            :event-id="event.id"
            :slug="slug"
            :tickets="data.tickets"
            :ended="event.ended"
          />
        </aside>
      </section>

      <footer class="foot">
        <span>Powered by</span>
        <img src="@/assets/quidly-logo.png" alt="Quidly" />
      </footer>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg, #fff);
  color: var(--text, #111827);
}
.center {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: 24px;
}
.big {
  font-size: 26px;
  font-weight: 800;
}
.muted {
  color: var(--muted);
  font-size: 14px;
}
.err {
  color: #dc2626;
}
.retry {
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.wrap {
  max-width: 1080px;
  margin: 0 auto;
  padding: 28px 20px 40px;
}
.banner {
  background: #ecfdf5;
  color: #065f46;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  margin-bottom: 22px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.banner code {
  font-family: monospace;
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: 6px;
}

/* Hero: stacked, banner centered, info underneath */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
  margin-bottom: 48px;
}

.poster {
  width: 100%;
  max-width: 640px;
  aspect-ratio: 4 / 5; /* try 16 / 9 for landscape banners */
  border-radius: 20px;
  overflow: hidden;
  background: var(--card);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56px;
  color: var(--muted);
}

.poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero__info {
  width: 100%;
  max-width: 640px;
  min-width: 0;
}

.cats {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 8px;
}
.title {
  font-size: 38px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 6px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  font-size: 15px;
}
.row i {
  font-size: 20px;
  color: var(--accent);
}
.row a {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--line);
}
.socials {
  display: flex;
  gap: 10px;
  margin-top: 22px;
}
.socials a {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  font-size: 18px;
}
.socials a:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.cols {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 36px;
  align-items: start;
}
.right {
  position: sticky;
  top: 20px;
}
h2 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 12px;
}
.about,
.lineup {
  margin-bottom: 32px;
}
.rich {
  font-size: 15px;
  line-height: 1.7;
}
.rich :deep(h2),
.rich :deep(h3) {
  font-weight: 700;
  margin: 16px 0 6px;
}
.rich :deep(ul) {
  list-style: disc;
  padding-left: 22px;
}
.rich :deep(ol) {
  list-style: decimal;
  padding-left: 22px;
}
.rich :deep(blockquote) {
  border-left: 3px solid var(--line);
  padding-left: 14px;
  color: var(--muted);
}
.rich :deep(a) {
  color: var(--accent);
  text-decoration: underline;
}
.rich :deep(p) {
  margin-bottom: 10px;
}
.people {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}
.person {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 96px;
  text-align: center;
  font-size: 13px;
}
.person img,
.avatar {
  width: 72px;
  height: 72px;
  border-radius: 999px;
  object-fit: cover;
}
.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card);
  border: 1px solid var(--line);
  font-weight: 700;
  font-size: 22px;
  color: var(--accent);
}
.foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 48px;
  font-size: 12px;
  color: var(--muted);
}

.foot img {
  display: block;
  width: 80px;
  height: auto;
  object-fit: contain;
}

@media (max-width: 860px) {
  .hero {
    gap: 28px;
    margin-bottom: 36px;
  }
  .poster {
    max-width: 100%;
  }
  .title {
    font-size: 30px;
  }
  .cols {
    grid-template-columns: 1fr;
  }
  .right {
    position: static;
    order: -1;
  }
}
</style>
