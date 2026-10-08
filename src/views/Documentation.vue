<template>
  <v-app class="font-sans">
    <!-- ============ TOP BAR ============ -->
    <v-app-bar flat height="64" color="white" class="border-gray-200 px-4 mx-auto flex justify-center align-center text-center">
      <div class="flex items-center gap-1 mr-6">
        <span class="text-[22px] font-extrabold tracking-tight text-slate-900">quidly partner</span>
        <span class="text-[11px] font-semibold text-blue-600 self-start mt-0.5">docs</span>
      </div>

      
    </v-app-bar>

    <!-- ============ SECTION TABS ============ -->
    <div class="bg-white border-b border-gray-200 sticky top-0 z-10" style="top:64px">
      <v-container class="max-w-[1400px]">
        <v-tabs v-model="activeTab" color="#2563EB" density="comfortable" class="text-sm">
          <v-tab v-for="t in tabs" :key="t.value" :value="t.value" class="normal-case font-medium">
            {{ t.label }}
          </v-tab>
        </v-tabs>
      </v-container>
    </div>

    <!-- ============ MAIN LAYOUT ============ -->
    <v-main class="bg-[#F7F8FA]">
      <v-container class="max-w-[1400px] py-8">
        <v-row>
          <!-- SIDEBAR -->
          <v-col cols="12" md="3">
            <div class="sidebar-scroll pr-2">
              <div v-for="group in currentGroups" :key="group.title" class="mb-6">
                <p class="text-[11px] font-bold tracking-wider text-gray-400 px-2 mb-1">{{ group.title }}</p>
                <v-list density="compact" nav bg-color="transparent" class="py-0">
                  <v-list-item
                    v-for="item in filterItems(group.items)"
                    :key="item.key"
                    :active="selectedKey === item.key"
                    active-color="#2563EB"
                    rounded="lg"
                    class="text-sm mb-0.5"
                    @click="select(item.key)"
                  >
                    <div class="flex items-center justify-between w-full">
                      <span :class="selectedKey === item.key ? 'text-blue-700 font-medium' : 'text-gray-700'">{{ item.label }}</span>
                      <v-chip v-if="item.method" :color="methodColor(item.method)" size="x-small" variant="flat" class="text-[10px] font-bold ml-2">
                        {{ item.method }}
                      </v-chip>
                    </div>
                  </v-list-item>
                </v-list>
              </div>
            </div>
          </v-col>

          <!-- MAIN CONTENT -->
          <v-col cols="12" :md="doc.type === 'endpoint' ? 6 : 9">
            <!-- LANDING -->
            <div v-if="doc.type === 'landing'">
              <div class="text-center py-8">
                <h1 class="text-4xl font-extrabold text-slate-900 mb-3">{{ doc.title }}</h1>
                <p class="text-gray-500 max-w-xl mx-auto mb-6">{{ doc.subtitle }}</p>
                <v-text-field
                  v-model="landingSearch"
                  variant="solo"
                  flat
                  bg-color="white"
                  hide-details
                  prepend-inner-icon="mdi-magnify"
                  placeholder="Initialize a transaction, verify a ticket, set up webhooks…"
                  class="max-w-xl mx-auto rounded-xl shadow-sm"
                />
                <div class="flex flex-wrap justify-center gap-2 mt-5">
                  <v-chip
                    v-for="f in landingFilters"
                    :key="f"
                    :color="landingFilter === f ? '#2563EB' : undefined"
                    :variant="landingFilter === f ? 'flat' : 'outlined'"
                    :class="landingFilter === f ? 'text-white' : 'text-gray-600'"
                    class="cursor-pointer font-medium"
                    @click="landingFilter = f"
                  >
                    {{ f }}
                  </v-chip>
                </div>
              </div>

              <v-row>
                <v-col v-for="card in filteredQuickLinks" :key="card.title" cols="12" sm="6" md="4">
                  <v-card
                    flat
                    class="pa-4 border border-gray-200 rounded-xl p-4 h-full hover:border-blue-400 hover:shadow-sm transition cursor-pointer"
                    @click="goTo(card.tab, card.key)"
                  >
                    <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                      <v-icon size="18" color="#2563EB">{{ card.icon }}</v-icon>
                    </div>
                    <p class="text-[11px] font-bold tracking-wide text-gray-400 mb-1">{{ card.eyebrow }}</p>
                    <p class="font-semibold text-slate-900 text-sm mb-1">{{ card.title }}</p>
                    <p class="text-xs text-gray-400">{{ card.tag }}</p>
                  </v-card>
                </v-col>
              </v-row>
            </div>

            <!-- GUIDE / PROSE DOC -->
            <div v-else-if="doc.type === 'doc'">
              <p v-if="doc.eyebrow" class="text-blue-600 text-sm font-medium mb-1">{{ doc.eyebrow }}</p>
              <h1 class="text-3xl font-extrabold text-slate-900 mb-3">{{ doc.title }}</h1>
              <p class="text-gray-500 leading-relaxed mb-5">{{ doc.description }}</p>

              <div v-if="doc.tip" class="flex gap-3 bg-[#F3FBEF] border-l-4 border-lime-500 rounded-r-lg p-4 mb-6">
                <v-icon color="#65A30D" size="20">mdi-lightbulb-outline</v-icon>
                <p class="text-sm text-gray-700"><span class="font-semibold">Tip </span>{{ doc.tip }}</p>
              </div>

              <div v-for="(section, i) in doc.sections" :key="i" class="mb-8">
                <h2 class="text-xl font-bold text-slate-900 mb-3">{{ section.heading }}</h2>
                <p v-for="(p, pi) in section.paragraphs" :key="pi" class="text-gray-600 leading-relaxed mb-3 text-[15px]">{{ p }}</p>

                <ul v-if="section.bullets" class="list-disc list-inside space-y-1.5 text-gray-600 text-[15px] mb-3">
                  <li v-for="(b, bi) in section.bullets" :key="bi">{{ b }}</li>
                </ul>

                <div v-if="section.table" class="border border-gray-200 rounded-xl overflow-hidden mb-2">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-blue-50 text-left">
                        <th v-for="h in section.table.headers" :key="h" class="px-4 py-2.5 font-semibold text-slate-700">{{ h }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, ri) in section.table.rows" :key="ri" class="border-t border-gray-100">
                        <td v-for="(cell, ci) in row" :key="ci" class="px-4 py-2.5 text-gray-600 align-top">
                          <code v-if="ci === 0" class="bg-gray-100 text-slate-700 px-1.5 py-0.5 rounded text-[13px]">{{ cell }}</code>
                          <span v-else>{{ cell }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div v-if="section.cards" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                  <v-card v-for="c in section.cards" :key="c.title" flat class="border border-gray-200 rounded-xl p-4">
                    <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                      <v-icon size="18" color="#2563EB">{{ c.icon }}</v-icon>
                    </div>
                    <p class="font-semibold text-slate-900 text-sm mb-1">{{ c.title }}</p>
                    <p class="text-xs text-gray-500 leading-relaxed">{{ c.body }}</p>
                  </v-card>
                </div>
              </div>
            </div>

            <!-- ENDPOINT DOC -->
            <div v-else-if="doc.type === 'endpoint'">
              <p class="text-blue-600 text-sm font-medium mb-1">{{ doc.eyebrow }}</p>
              <h1 class="text-3xl font-extrabold text-slate-900 mb-3">{{ doc.title }}</h1>

              <div class="flex items-center gap-2 mb-4">
                <v-chip :color="methodColor(doc.method)" variant="flat" size="small" class="font-bold text-[11px]">{{ doc.method }}</v-chip>
                <code class="bg-gray-100 text-slate-700 px-2.5 py-1 rounded-md text-sm">{{ doc.path }}</code>
              </div>

              <p class="text-gray-500 leading-relaxed mb-6 text-[15px]">{{ doc.description }}</p>

              <div v-if="doc.tip" class="flex gap-3 bg-[#F3FBEF] border-l-4 border-lime-500 rounded-r-lg p-4 mb-6">
                <v-icon color="#65A30D" size="20">mdi-lightbulb-outline</v-icon>
                <p class="text-sm text-gray-700">{{ doc.tip }}</p>
              </div>

              <!-- headers table -->
              <div v-if="doc.headers?.length" class="mb-8">
                <h2 class="text-xl font-bold text-slate-900 mb-3">Headers</h2>
                <div class="border border-gray-200 rounded-xl overflow-hidden">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-blue-50 text-left">
                        <th class="px-4 py-2.5 font-semibold text-slate-700">Header</th>
                        <th class="px-4 py-2.5 font-semibold text-slate-700">Required</th>
                        <th class="px-4 py-2.5 font-semibold text-slate-700">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="h in doc.headers" :key="h.name" class="border-t border-gray-100">
                        <td class="px-4 py-2.5"><code class="bg-gray-100 px-1.5 py-0.5 rounded text-[13px]">{{ h.name }}</code></td>
                        <td class="px-4 py-2.5 text-gray-600">{{ h.required ? 'Yes' : 'No' }}</td>
                        <td class="px-4 py-2.5 text-gray-600">{{ h.description }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- body / query params -->
              <div v-if="doc.params?.length" class="mb-8">
                <h2 class="text-xl font-bold text-slate-900 mb-3">{{ doc.paramLabel || 'Body parameters' }}</h2>
                <div class="border border-gray-200 rounded-xl overflow-hidden">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-blue-50 text-left">
                        <th class="px-4 py-2.5 font-semibold text-slate-700">Parameter</th>
                        <th class="px-4 py-2.5 font-semibold text-slate-700">Type</th>
                        <th class="px-4 py-2.5 font-semibold text-slate-700">Required</th>
                        <th class="px-4 py-2.5 font-semibold text-slate-700">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="p in doc.params" :key="p.name" class="border-t border-gray-100">
                        <td class="px-4 py-2.5"><code class="bg-gray-100 px-1.5 py-0.5 rounded text-[13px]">{{ p.name }}</code></td>
                        <td class="px-4 py-2.5 text-gray-500">{{ p.type }}</td>
                        <td class="px-4 py-2.5 text-gray-600">{{ p.required ? 'Yes' : 'No' }}</td>
                        <td class="px-4 py-2.5 text-gray-600">{{ p.description }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div v-if="doc.note" class="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6">
                {{ doc.note }}
              </div>
            </div>

            <!-- CHANGELOG -->
            <div v-else-if="doc.type === 'changelog'">
              <h1 class="text-3xl font-extrabold text-slate-900 mb-6">Changelog</h1>
              <div class="relative pl-6 border-l-2 border-gray-200 space-y-8">
                <div v-for="entry in changelogEntries" :key="entry.date" class="relative">
                  <span class="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-blue-600 border-2 border-white"></span>
                  <p class="text-xs font-semibold text-gray-400 mb-1">{{ entry.date }}</p>
                  <p class="font-bold text-slate-900 mb-2">{{ entry.title }}</p>
                  <ul class="space-y-1.5">
                    <li v-for="(c, ci) in entry.changes" :key="ci" class="flex items-start gap-2 text-sm text-gray-600">
                      <v-chip :color="changeColor(c.type)" size="x-small" variant="flat" class="text-[10px] font-bold mt-0.5">{{ c.type }}</v-chip>
                      <span>{{ c.text }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </v-col>

          <!-- CODE / ON-THIS-PAGE RAIL -->
          <v-col v-if="doc.type === 'endpoint'" cols="12" md="3">
            <div class="sticky top-[110px] space-y-4">
              <v-card flat class="rounded-xl overflow-hidden border border-gray-800" color="#1E1E2E">
                <v-tabs v-model="codeLang" color="white" density="compact" class="bg-[#151521] px-2" slider-color="#2563EB">
                  <v-tab value="curl" class="normal-case text-xs" style="min-width:0">cURL</v-tab>
                  <v-tab value="node" class="normal-case text-xs" style="min-width:0">Node.js</v-tab>
                  <v-tab value="python" class="normal-case text-xs" style="min-width:0">Python</v-tab>
                  <v-spacer />
                  <v-btn icon variant="text" size="x-small" class="text-gray-400" @click="copy(codeText)">
                    <v-icon size="16">{{ copied ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
                  </v-btn>
                </v-tabs>
                <pre class="text-[12px] leading-relaxed p-4 overflow-x-auto text-gray-200 m-0"><code>{{ codeText }}</code></pre>
              </v-card>

              <v-card flat class="rounded-xl overflow-hidden border border-gray-200">
                <div class="bg-blue-50 px-4 py-2.5 text-[13px] font-mono text-blue-700 border-b border-gray-200">
                  {{ doc.method }} {{ doc.path }}
                </div>
                <pre class="text-[12px] leading-relaxed p-4 overflow-x-auto bg-[#1E1E2E] text-gray-200 m-0"><code>{{ responseText }}</code></pre>
              </v-card>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'

/* ============================================================
   TOP-LEVEL NAV
============================================================ */
const tabs = [
  { label: 'Get Started', value: 'get-started' },
  { label: 'API Reference', value: 'api-reference' },
  { label: 'Guides', value: 'guides' },
  { label: 'Changelog', value: 'changelog' },
]

const activeTab = ref('get-started')
const search = ref('')
const landingSearch = ref('')
const landingFilter = ref('All')
const codeLang = ref('curl')
const copied = ref(false)

const landingFilters = ['All', 'Get set up', 'Partners & KYC', 'Events', 'Tickets & check-in', 'Payments', 'Webhooks']

/* ============================================================
   SIDEBAR GROUPS PER TAB
============================================================ */
const getStartedGroups = [
  { title: 'OVERVIEW', items: [{ key: 'gs-landing', label: 'What do you want to do?' }] },
  {
    title: 'GETTING STARTED',
    items: [
      { key: 'gs-create-account', label: 'Create a partner account' },
      { key: 'gs-quickstart', label: 'Quickstart' },
      { key: 'gs-environments', label: 'Sandbox & live environments' },
      { key: 'gs-authentication', label: 'Authentication' },
      { key: 'gs-sandbox', label: 'Sandbox test data' },
    ],
  },
  { title: 'COMPLIANCE', items: [{ key: 'gs-kyc-overview', label: 'Complete KYC (compliance)' }] },
]

const apiReferenceGroups = [
  { title: 'OVERVIEW', items: [{ key: 'api-intro', label: 'Introduction' }] },
  {
    title: 'CORE CONCEPTS',
    items: [
      { key: 'cc-errors', label: 'Errors & status codes' },
      { key: 'cc-webhooks', label: 'Webhooks & signatures' },
      { key: 'cc-kyc-statuses', label: 'KYC & verification statuses' },
      { key: 'cc-settlement', label: 'Wallet & settlement' },
      { key: 'cc-glossary', label: 'Glossary' },
    ],
  },
  {
    title: 'PARTNERS',
    items: [
      { key: 'partners-register', label: 'Register a partner', method: 'POST' },
      { key: 'partners-get', label: 'Get partner profile', method: 'GET' },
      { key: 'partners-update', label: 'Update partner profile', method: 'PATCH' },
    ],
  },
  {
    title: 'KYC & COMPLIANCE',
    items: [
      { key: 'kyc-submit', label: 'Submit KYC application', method: 'POST' },
      { key: 'kyc-upload-doc', label: 'Upload KYC document', method: 'POST' },
      { key: 'kyc-status', label: 'Get KYC status', method: 'GET' },
    ],
  },
  {
    title: 'BANK ACCOUNTS',
    items: [
      { key: 'bank-add', label: 'Add settlement account', method: 'POST' },
      { key: 'bank-verify', label: 'Verify account (name enquiry)', method: 'POST' },
    ],
  },
  {
    title: 'API KEYS',
    items: [
      { key: 'apikeys-create', label: 'Generate API key', method: 'POST' },
      { key: 'apikeys-revoke', label: 'Revoke API key', method: 'DELETE' },
    ],
  },
  {
    title: 'EVENTS',
    items: [
      { key: 'events-create', label: 'Create an event', method: 'POST' },
      { key: 'events-list', label: 'List events', method: 'GET' },
      { key: 'events-get', label: 'Get an event', method: 'GET' },
      { key: 'events-update', label: 'Update an event', method: 'PATCH' },
      { key: 'events-cancel', label: 'Cancel an event', method: 'POST' },
    ],
  },
  {
    title: 'TICKETS & CHECK-IN',
    items: [
      { key: 'tickets-list-by-event', label: 'List tickets for an event', method: 'GET' },
      { key: 'tickets-get', label: 'Get a ticket', method: 'GET' },
      { key: 'tickets-checkin', label: 'Check in a ticket', method: 'POST' },
    ],
  },
  {
    title: 'TRANSACTIONS & PAYMENTS',
    items: [
      { key: 'txn-initialize', label: 'Initialize a transaction', method: 'POST' },
      { key: 'txn-verify', label: 'Verify a transaction', method: 'GET' },
      { key: 'txn-get', label: 'Get a transaction', method: 'GET' },
      { key: 'txn-list', label: 'List transactions', method: 'GET' },
    ],
  },
  {
    title: 'WEBHOOKS',
    items: [
      { key: 'webhooks-events', label: 'Event types & payloads' },
      { key: 'webhooks-retry', label: 'Delivery & retries' },
    ],
  },
]

const guidesGroups = [
  {
    title: 'INTEGRATION GUIDES',
    items: [
      { key: 'guide-track1', label: 'Connect an existing event platform' },
      { key: 'guide-track2', label: 'Launch a ticketing platform on Quidly' },
      { key: 'guide-golive', label: 'Go-live checklist' },
    ],
  },
]

const changelogGroups = []

const tabConfig = {
  'get-started': { groups: getStartedGroups, default: 'gs-landing' },
  'api-reference': { groups: apiReferenceGroups, default: 'api-intro' },
  guides: { groups: guidesGroups, default: 'guide-track1' },
  changelog: { groups: changelogGroups, default: 'changelog-page' },
}

const currentGroups = computed(() => tabConfig[activeTab.value].groups)

const selectedKey = ref(tabConfig['get-started'].default)

function select(key) {
  selectedKey.value = key
  codeLang.value = 'curl'
}

function switchTab(tabValue) {
  activeTab.value = tabValue
  selectedKey.value = tabConfig[tabValue].default
}

function goTo(tabValue, key) {
  activeTab.value = tabValue
  selectedKey.value = key
}

// keep tab in sync when user clicks a v-tab directly
import { watch } from 'vue'
watch(activeTab, (val) => {
  selectedKey.value = tabConfig[val].default
})

function filterItems(items) {
  if (!search.value.trim()) return items
  const q = search.value.toLowerCase()
  return items.filter((i) => i.label.toLowerCase().includes(q))
}

/* ============================================================
   LANDING PAGE QUICK LINKS
============================================================ */
const quickLinks = [
  { eyebrow: 'GET SET UP', title: 'Create a partner account', icon: 'mdi-flash', tag: 'Getting started', tab: 'get-started', key: 'gs-create-account' },
  { eyebrow: 'GET SET UP', title: 'Complete KYC (compliance)', icon: 'mdi-shield-check-outline', tag: 'Partners & KYC', tab: 'get-started', key: 'gs-kyc-overview' },
  { eyebrow: 'GET SET UP', title: 'Generate live API keys', icon: 'mdi-key-variant', tag: 'Get set up', tab: 'api-reference', key: 'apikeys-create' },
  { eyebrow: 'PARTNERS & KYC', title: 'Register a partner', icon: 'mdi-account-plus-outline', tag: 'Partners & KYC', tab: 'api-reference', key: 'partners-register' },
  { eyebrow: 'PARTNERS & KYC', title: 'Add a settlement bank account', icon: 'mdi-bank-outline', tag: 'Partners & KYC', tab: 'api-reference', key: 'bank-add' },
  { eyebrow: 'EVENTS', title: 'Create an event', icon: 'mdi-calendar-plus', tag: 'Events', tab: 'api-reference', key: 'events-create' },
  { eyebrow: 'PAYMENTS', title: 'Initialize a ticket transaction', icon: 'mdi-credit-card-outline', tag: 'Payments', tab: 'api-reference', key: 'txn-initialize' },
  { eyebrow: 'PAYMENTS', title: 'Verify a transaction', icon: 'mdi-check-decagram-outline', tag: 'Payments', tab: 'api-reference', key: 'txn-verify' },
  { eyebrow: 'TICKETS & CHECK-IN', title: 'Check in a ticket at the gate', icon: 'mdi-qrcode-scan', tag: 'Tickets & check-in', tab: 'api-reference', key: 'tickets-checkin' },
  { eyebrow: 'WEBHOOKS', title: 'Listen for ticket.issued events', icon: 'mdi-webhook', tag: 'Webhooks', tab: 'api-reference', key: 'webhooks-events' },
  { eyebrow: 'GUIDES', title: 'Connect an existing event platform', icon: 'mdi-swap-horizontal', tag: 'Get set up', tab: 'guides', key: 'guide-track1' },
  { eyebrow: 'GUIDES', title: 'Launch a ticketing platform on Quidly', icon: 'mdi-ticket-confirmation-outline', tag: 'Get set up', tab: 'guides', key: 'guide-track2' },
]

const filteredQuickLinks = computed(() => {
  if (landingFilter.value === 'All') return quickLinks
  return quickLinks.filter((c) => c.tag === landingFilter.value)
})

/* ============================================================
   METHOD / CHANGE COLORS
============================================================ */
function methodColor(method) {
  return { GET: '#2563EB', POST: '#16A34A', PATCH: '#D97706', DELETE: '#DC2626' }[method] || '#2563EB'
}
function changeColor(type) {
  return { Added: 'green', Changed: 'orange', Fixed: 'blue', Deprecated: 'red' }[type] || 'grey'
}

/* ============================================================
   DOC CONTENT
============================================================ */
const docs = reactive({
  /* ---------- GET STARTED ---------- */
  'gs-landing': { type: 'landing', title: 'What do you want to do?', subtitle: 'Find the task you need across the partner dashboard and the API — start typing, or browse by category.' },

  'gs-create-account': {
    type: 'doc',
    eyebrow: 'Getting started',
    title: 'Create a partner account',
    description: 'Every organizer or platform that sells tickets through Quidly starts as a partner. Register once, then use the same account for sandbox testing and, after KYC approval, live payments.',
    tip: 'You can register with just a business name and email — bank details and KYC documents can be added afterwards from the dashboard.',
    sections: [
      {
        heading: 'What you need',
        bullets: [
          'A business (or individual organizer) name and a contact email',
          'A valid Nigerian bank account for settlement, added later',
          'CAC certificate or valid ID for KYC review',
        ],
      },
      {
        heading: 'What happens next',
        paragraphs: [
          'New accounts start in sandbox with a status of pending. You can create test events and simulate transactions immediately — no review required for sandbox.',
          'Once you submit KYC and it is approved, your account status moves to active and your live API keys are unlocked.',
        ],
      },
    ],
  },

  'gs-quickstart': {
    type: 'doc',
    eyebrow: 'Getting started',
    title: 'Quickstart',
    description: 'Go from a new partner account to your first confirmed ticket in under ten minutes using sandbox data.',
    sections: [
      {
        heading: '1. Grab your sandbox keys',
        paragraphs: ['Every partner account ships with a sandbox environment by default. Copy your Secret Key and AppId from Settings → API Keys.'],
        table: { headers: ['Header', 'Example'], rows: [['Authorization', 'quidly_test_sk_4f7d…'], ['AppId', 'app_2b19c8']] },
      },
      {
        heading: '2. Create a test event',
        paragraphs: ['Call Create an event with a ticket_price and total_capacity. Sandbox events behave exactly like live ones but never touch real money.'],
      },
      {
        heading: '3. Initialize a transaction',
        paragraphs: ['Pass the event_id, a customer_name, customer_email and amount to Initialize a transaction. Use a sandbox test card at checkout to simulate a completed payment.'],
      },
      {
        heading: '4. Confirm the ticket',
        paragraphs: ['Once the transaction status flips to completed, Quidly generates a QR ticket automatically and fires a ticket.issued webhook to your webhook_url.'],
      },
    ],
  },

  'gs-environments': {
    type: 'doc',
    eyebrow: 'Getting started',
    title: 'Sandbox & live environments',
    description: 'Every partner gets two isolated environments that share the same account but never share data.',
    sections: [
      {
        heading: 'Base URLs',
        table: {
          headers: ['Environment', 'Base URL', 'Notes'],
          rows: [
            ['sandbox', 'https://sandbox-api.quidly.com/v1', 'Test cards only, unlimited resets'],
            ['live', 'https://api.quidly.com/v1', 'Requires kyc_status = approved'],
          ],
        },
      },
      {
        heading: 'Switching environments',
        paragraphs: [
          'Environment is determined entirely by which key you send — test keys are prefixed quidly_test_sk_, live keys quidly_live_sk_. There is no separate flag to toggle.',
        ],
      },
    ],
  },

  'gs-authentication': {
    type: 'doc',
    eyebrow: 'Getting started',
    title: 'Authentication',
    description: 'Every request to the Quidly API is authenticated with two headers taken from your partner dashboard.',
    sections: [
      {
        heading: 'Required headers',
        table: {
          headers: ['Header', 'Required', 'Description'],
          rows: [
            ['Authorization', 'Yes', 'Your secret key, sent as-is — not Bearer <key>'],
            ['AppId', 'Yes', 'The App ID shown next to your key on the dashboard'],
            ['Content-Type', 'For POST/PATCH', 'application/json'],
          ],
        },
      },
      {
        heading: 'Scopes',
        paragraphs: ['Each key carries scopes such as widget:create_transaction, events:read or tickets:validate. Check-in devices should use a scoped key limited to tickets:validate.'],
      },
    ],
  },

  'gs-sandbox': {
    type: 'doc',
    eyebrow: 'Getting started',
    title: 'Sandbox test data',
    description: 'Use these fixtures to exercise every path — successful payments, declines, and bank verification — without touching a real bank.',
    sections: [
      {
        heading: 'Test cards',
        table: {
          headers: ['Card number', 'CVV / PIN', 'Result'],
          rows: [
            ['4084 0840 8408 4081', '408 / 1111', 'completed'],
            ['5060 6666 6666 6666', '123 / 1234', 'failed — insufficient_funds'],
            ['5061 0000 0000 0007', '000 / 0000', 'processing → completed after OTP 123456'],
          ],
        },
      },
      {
        heading: 'Test bank account',
        paragraphs: ['Use bank_code 058 (GTBank) with account_number 0000000000 to receive an automatic is_verified: true response from the name-enquiry endpoint.'],
      },
    ],
  },

  'gs-kyc-overview': {
    type: 'doc',
    eyebrow: 'Compliance',
    title: 'Complete KYC (compliance)',
    description: 'Live payouts require an approved KYC submission tied to your partner account. Sandbox is unaffected.',
    sections: [
      {
        heading: 'Documents to prepare',
        bullets: [
          'CAC certificate (registered businesses) or valid government ID (solo organizers)',
          'Proof of address dated within the last 3 months',
          'Director\u2019s NIN, passport, driver\u2019s licence or voter\u2019s card',
          'Bank statement or tax clearance certificate (optional, speeds up review)',
        ],
      },
      {
        heading: 'Review timeline',
        paragraphs: ['Most submissions are reviewed within 2 business days. If anything is missing, kyc_status moves to resubmission_required with a rejection_reason you can read from Get KYC status.'],
      },
    ],
  },

  /* ---------- API REFERENCE — CORE CONCEPTS ---------- */
  'api-intro': {
    type: 'doc',
    eyebrow: 'Get started',
    title: 'Quidly Partner API reference',
    description: 'Sell and validate event tickets across Africa — through a REST API, a drop-in payment widget, or a fully hosted checkout page. This reference covers every endpoint and the concepts you need to go live.',
    tip: 'New here? Jump to the Quickstart — create a partner account, grab your keys, and confirm your first ticket in a few minutes.',
    sections: [
      {
        heading: 'Ways to integrate',
        paragraphs: ['Pick the approach that fits your product. Most partners combine the REST API for events and tickets with the payment widget for checkout.'],
        cards: [
          { icon: 'mdi-code-braces', title: 'REST API', body: 'Call any endpoint directly from your server — events, tickets, transactions, webhooks and more.' },
          { icon: 'mdi-widgets-outline', title: 'Payment Widget SDK', body: 'Drop the Quidly checkout widget into your web or mobile app with a few lines of code.' },
          { icon: 'mdi-link-variant', title: 'Hosted checkout page', body: 'Redirect customers to a Quidly-hosted event page and ticket checkout — no frontend required.' },
        ],
      },
    ],
  },

  'cc-errors': {
    type: 'doc',
    eyebrow: 'Core concepts',
    title: 'Errors & status codes',
    description: 'Quidly uses conventional HTTP status codes. Codes in the 2xx range indicate success, 4xx codes indicate a problem with the request, and 5xx codes indicate an error on our side.',
    sections: [
      {
        heading: 'HTTP status codes',
        table: {
          headers: ['Code', 'Meaning'],
          rows: [
            ['200', 'OK — the request succeeded'],
            ['201', 'Created — a resource such as an event or ticket was created'],
            ['400', 'Bad request — a required field is missing or malformed'],
            ['401', 'Unauthorized — the Authorization or AppId header is missing or invalid'],
            ['403', 'Forbidden — your KYC status or key scope does not allow this action'],
            ['404', 'Not found — the resource does not exist in this environment'],
            ['409', 'Conflict — e.g. a ticket has already been checked in'],
            ['422', 'Unprocessable — the request is well-formed but fails validation'],
            ['429', 'Too many requests — you have exceeded your rate limit'],
            ['500', 'Something went wrong on Quidly\u2019s side'],
          ],
        },
      },
      {
        heading: 'Error shape',
        paragraphs: ['Every error response follows the same envelope so you can handle failures consistently across endpoints.'],
        table: {
          headers: ['Field', 'Description'],
          rows: [
            ['error.code', 'Machine-readable code, e.g. ticket_already_used'],
            ['error.message', 'Human-readable explanation'],
            ['error.field', 'The offending field, when applicable'],
          ],
        },
      },
    ],
  },

  'cc-webhooks': {
    type: 'doc',
    eyebrow: 'Core concepts',
    title: 'Webhooks & signatures',
    description: 'Quidly notifies your webhook_url whenever a transaction or ticket changes state, so your platform never has to poll.',
    sections: [
      {
        heading: 'Delivery',
        paragraphs: [
          'Each event is recorded with a delivery_status of pending, delivered or failed. Failed deliveries are retried with exponential backoff up to 8 times over 24 hours, tracked in retry_count and next_retry_at.',
        ],
      },
      {
        heading: 'Verifying signatures',
        paragraphs: ['Every webhook request carries an X-Quidly-Signature header — an HMAC-SHA256 hex digest of the raw request body, signed with your webhook secret. Recompute it and compare before trusting the payload.'],
      },
    ],
  },

  'cc-kyc-statuses': {
    type: 'doc',
    eyebrow: 'Core concepts',
    title: 'KYC & verification statuses',
    description: 'A partner\u2019s kyc_status controls whether live payouts are enabled, independent of the sandbox environment.',
    sections: [
      {
        heading: 'Status values',
        table: {
          headers: ['Status', 'Meaning'],
          rows: [
            ['not_started', 'No KYC submission has been created yet'],
            ['submitted', 'Documents received, waiting to enter review'],
            ['under_review', 'A compliance reviewer is actively checking the submission'],
            ['resubmission_required', 'Something needs to be corrected — see rejection_reason'],
            ['approved', 'Live payouts and live API keys are enabled'],
            ['rejected', 'The submission was declined'],
            ['suspended', 'Previously approved, now paused pending investigation'],
          ],
        },
      },
    ],
  },

  'cc-settlement': {
    type: 'doc',
    eyebrow: 'Core concepts',
    title: 'Wallet & settlement',
    description: 'Ticket revenue collected through Quidly settles to your verified bank account on a rolling schedule.',
    sections: [
      {
        heading: 'How settlement works',
        bullets: [
          'Completed transactions are swept nightly, minus the Quidly platform commission',
          'Payouts land in the partner_bank_accounts record marked is_active: true',
          'Refunds are deducted from the next settlement batch, or reversed directly if funds have not yet paid out',
        ],
      },
    ],
  },

  'cc-glossary': {
    type: 'doc',
    eyebrow: 'Core concepts',
    title: 'Glossary',
    description: 'Terms used consistently across the dashboard and the API.',
    sections: [
      {
        heading: 'Terms',
        table: {
          headers: ['Term', 'Definition'],
          rows: [
            ['Partner', 'A registered organizer or platform selling tickets through Quidly'],
            ['Event', 'A single ticketed occasion created by a partner'],
            ['Transaction', 'One payment attempt by a customer for one or more tickets'],
            ['Ticket', 'A QR-coded record generated once a transaction completes'],
            ['Check-in', 'The act of scanning a ticket\u2019s QR code at the venue to mark it used'],
          ],
        },
      },
    ],
  },

  /* ---------- PARTNERS ---------- */
  'partners-register': {
    type: 'endpoint',
    eyebrow: 'Partners',
    method: 'POST',
    path: '/partners',
    title: 'Register a partner',
    description: 'Create a new partner (organizer) account. The account starts in sandbox with status pending and kyc_status not_started.',
    headers: [
      { name: 'Authorization', required: true, description: 'Your platform secret key, sent as-is' },
      { name: 'Content-Type', required: true, description: 'application/json' },
    ],
    params: [
      { name: 'business_name', type: 'string', required: true, description: 'Legal or trading name of the organizer', example: 'Lagos Live Concerts Ltd' },
      { name: 'contact_name', type: 'string', required: true, description: 'Primary contact person', example: 'Amara Chukwu' },
      { name: 'email', type: 'string', required: true, description: 'Unique contact email, used for login', example: 'amara@lagosliveconcerts.com' },
      { name: 'phone', type: 'string', required: false, description: 'Contact phone number', example: '+2348012345678' },
      { name: 'business_type', type: 'string', required: false, description: 'e.g. Limited Liability Company, Sole Proprietor', example: 'Limited Liability Company' },
      { name: 'country', type: 'string', required: false, description: 'ISO-2 country code, defaults to NG', example: 'NG' },
    ],
    response: {
      id: '8f14e45f-ceea-467e-bd6f-1ec5d5a4c3a2',
      business_name: 'Lagos Live Concerts Ltd',
      contact_name: 'Amara Chukwu',
      email: 'amara@lagosliveconcerts.com',
      role: 'partner',
      status: 'pending',
      kyc_status: 'not_started',
      country: 'NG',
      created_at: '2026-08-11T09:14:02Z',
    },
  },

  'partners-get': {
    type: 'endpoint',
    eyebrow: 'Partners',
    method: 'GET',
    path: '/partners/{id}',
    title: 'Get partner profile',
    description: 'Retrieve a partner\u2019s profile, including current account and KYC status.',
    headers: [
      { name: 'Authorization', required: true, description: 'Your secret key' },
      { name: 'AppId', required: true, description: 'Your App ID' },
    ],
    params: [{ name: 'id', type: 'uuid', required: true, description: 'Partner ID, taken from the URL path', example: '8f14e45f-ceea-467e-bd6f-1ec5d5a4c3a2' }],
    paramLabel: 'Path parameters',
    response: {
      id: '8f14e45f-ceea-467e-bd6f-1ec5d5a4c3a2',
      business_name: 'Lagos Live Concerts Ltd',
      status: 'active',
      kyc_status: 'approved',
      kyc_approved_at: '2026-06-02T11:00:00Z',
      webhook_url: 'https://api.lagosliveconcerts.com/webhooks/quidly',
    },
  },

  'partners-update': {
    type: 'endpoint',
    eyebrow: 'Partners',
    method: 'PATCH',
    path: '/partners/{id}',
    title: 'Update partner profile',
    description: 'Update mutable partner fields such as webhook_url, phone, or website. Business identity fields require a new KYC submission to change.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [
      { name: 'webhook_url', type: 'string', required: false, description: 'Endpoint that receives transaction and ticket events', example: 'https://api.lagosliveconcerts.com/webhooks/quidly' },
      { name: 'phone', type: 'string', required: false, description: 'Updated contact phone number', example: '+2348012345678' },
      { name: 'website', type: 'string', required: false, description: 'Public website URL', example: 'https://lagosliveconcerts.com' },
    ],
    response: { id: '8f14e45f-ceea-467e-bd6f-1ec5d5a4c3a2', webhook_url: 'https://api.lagosliveconcerts.com/webhooks/quidly', updated_at: '2026-08-15T10:02:11Z' },
  },

  /* ---------- KYC ---------- */
  'kyc-submit': {
    type: 'endpoint',
    eyebrow: 'KYC & compliance',
    method: 'POST',
    path: '/partners/{id}/kyc',
    title: 'Submit KYC application',
    description: 'Start (or resubmit) a compliance review for a partner. Each call creates a new record in the submission history with an incrementing submission_number.',
    tip: 'Attach supporting documents separately with Upload KYC document, referencing the returned kyc_submission_id.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [
      { name: 'legal_business_name', type: 'string', required: true, description: 'Name as it appears on the CAC certificate', example: 'Lagos Live Concerts Ltd' },
      { name: 'business_registration_number', type: 'string', required: false, description: 'CAC registration number', example: 'RC-1487233' },
      { name: 'business_address', type: 'string', required: true, description: 'Registered business address', example: '14 Adeola Odeku Street, Victoria Island, Lagos' },
      { name: 'director_full_name', type: 'string', required: true, description: 'Full name of a company director', example: 'Amara Chukwu' },
      { name: 'director_id_type', type: 'string', required: true, description: 'nin, passport, drivers_license or voters_card', example: 'nin' },
      { name: 'director_id_number', type: 'string', required: true, description: 'ID number matching director_id_type', example: '12345678901' },
    ],
    response: { id: 'b6a0f2e1-4a3c-4f1a-9d2e-7c1a2b3c4d5e', partner_id: '8f14e45f-ceea-467e-bd6f-1ec5d5a4c3a2', submission_number: 1, status: 'submitted', created_at: '2026-08-11T09:20:00Z' },
  },

  'kyc-upload-doc': {
    type: 'endpoint',
    eyebrow: 'KYC & compliance',
    method: 'POST',
    path: '/kyc/submissions/{kyc_submission_id}/documents',
    title: 'Upload KYC document',
    description: 'Attach a supporting document (CAC certificate, valid ID, proof of address, and so on) to a KYC submission.',
    headers: [
      { name: 'Authorization', required: true, description: 'Your secret key' },
      { name: 'Content-Type', required: true, description: 'multipart/form-data' },
    ],
    params: [
      { name: 'document_type', type: 'string', required: true, description: 'cac_certificate, valid_id, proof_of_address, bank_statement, tax_clearance, memorandum_of_association or other', example: 'cac_certificate' },
      { name: 'file', type: 'file', required: true, description: 'PDF, JPG or PNG, up to 10MB', example: 'cac_certificate.pdf' },
    ],
    response: { id: 'f1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6a7b', document_type: 'cac_certificate', file_name: 'cac_certificate.pdf', verified: false, uploaded_at: '2026-08-11T09:22:41Z' },
  },

  'kyc-status': {
    type: 'endpoint',
    eyebrow: 'KYC & compliance',
    method: 'GET',
    path: '/partners/{id}/kyc',
    title: 'Get KYC status',
    description: 'Retrieve the latest KYC submission for a partner, including any rejection reason and the full status history.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [{ name: 'id', type: 'uuid', required: true, description: 'Partner ID', example: '8f14e45f-ceea-467e-bd6f-1ec5d5a4c3a2' }],
    paramLabel: 'Path parameters',
    response: {
      kyc_status: 'under_review',
      latest_submission: { submission_number: 2, status: 'under_review', legal_business_name: 'Lagos Live Concerts Ltd' },
      history: [
        { from_status: 'not_started', to_status: 'submitted', created_at: '2026-05-28T08:00:00Z' },
        { from_status: 'submitted', to_status: 'resubmission_required', reason: 'Proof of address expired', created_at: '2026-05-30T14:00:00Z' },
        { from_status: 'resubmission_required', to_status: 'under_review', created_at: '2026-08-11T09:20:00Z' },
      ],
    },
  },

  /* ---------- BANK ACCOUNTS ---------- */
  'bank-add': {
    type: 'endpoint',
    eyebrow: 'Bank accounts',
    method: 'POST',
    path: '/partners/{id}/bank-accounts',
    title: 'Add settlement account',
    description: 'Register the bank account that receives ticket revenue settlements for this partner.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [
      { name: 'bank_name', type: 'string', required: true, description: 'Bank name', example: 'Guaranty Trust Bank' },
      { name: 'bank_code', type: 'string', required: true, description: 'NIBSS bank code', example: '058' },
      { name: 'account_number', type: 'string', required: true, description: '10-digit NUBAN account number', example: '0123456789' },
    ],
    response: { id: 'a7c1e2d3-4b5f-6a7b-8c9d-0e1f2a3b4c5d', bank_name: 'Guaranty Trust Bank', account_number: '0123456789', account_name: 'LAGOS LIVE CONCERTS LTD', is_verified: false, is_active: true },
  },

  'bank-verify': {
    type: 'endpoint',
    eyebrow: 'Bank accounts',
    method: 'POST',
    path: '/bank-accounts/{id}/verify',
    title: 'Verify account (name enquiry)',
    description: 'Run a real-time name enquiry against the bank account to confirm it resolves to the partner\u2019s registered name before enabling settlement.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [{ name: 'id', type: 'uuid', required: true, description: 'Bank account ID', example: 'a7c1e2d3-4b5f-6a7b-8c9d-0e1f2a3b4c5d' }],
    paramLabel: 'Path parameters',
    response: { is_verified: true, verification_method: 'name_enquiry', account_name: 'LAGOS LIVE CONCERTS LTD', verified_at: '2026-08-11T09:30:12Z' },
  },

  /* ---------- API KEYS ---------- */
  'apikeys-create': {
    type: 'endpoint',
    eyebrow: 'API keys',
    method: 'POST',
    path: '/partners/{id}/api-keys',
    title: 'Generate API key',
    description: 'Create a new secret key for the sandbox or live environment. The full key is only ever shown once — store it securely.',
    tip: 'Scope check-in devices to tickets:validate only, so a lost device cannot create transactions.',
    headers: [{ name: 'Authorization', required: true, description: 'A key with keys:manage scope' }],
    params: [
      { name: 'environment', type: 'string', required: true, description: 'test or live — live requires kyc_status = approved', example: 'live' },
      { name: 'scopes', type: 'array', required: false, description: 'Defaults to widget:create_transaction', example: ['widget:create_transaction', 'events:read', 'tickets:validate'] },
    ],
    response: { id: '3d2c1b0a-9f8e-7d6c-5b4a-3c2d1e0f9a8b', key_prefix: 'quidly_live_sk_4f7d', environment: 'live', status: 'active', scopes: ['widget:create_transaction', 'events:read'], created_at: '2026-08-11T09:35:00Z' },
  },

  'apikeys-revoke': {
    type: 'endpoint',
    eyebrow: 'API keys',
    method: 'DELETE',
    path: '/api-keys/{id}',
    title: 'Revoke API key',
    description: 'Immediately revoke a key. In-flight requests already authenticated with it will still complete, but new requests are rejected with 401.',
    headers: [{ name: 'Authorization', required: true, description: 'A key with keys:manage scope' }],
    params: [
      { name: 'id', type: 'uuid', required: true, description: 'API key ID', example: '3d2c1b0a-9f8e-7d6c-5b4a-3c2d1e0f9a8b' },
      { name: 'revoked_reason', type: 'string', required: false, description: 'Freeform note for your own audit trail', example: 'Device decommissioned' },
    ],
    paramLabel: 'Path & body parameters',
    response: { id: '3d2c1b0a-9f8e-7d6c-5b4a-3c2d1e0f9a8b', status: 'revoked', revoked_at: '2026-08-16T12:00:00Z' },
  },

  /* ---------- EVENTS ---------- */
  'events-create': {
    type: 'endpoint',
    eyebrow: 'Events',
    method: 'POST',
    path: '/events',
    title: 'Create an event',
    description: 'Create a new ticketed event under your partner account.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [
      { name: 'event_name', type: 'string', required: true, description: 'Public event name', example: 'Afrobeats Unplugged: Lagos Edition' },
      { name: 'event_date', type: 'datetime', required: true, description: 'Start date and time, ISO 8601', example: '2026-11-14T19:00:00' },
      { name: 'location', type: 'string', required: false, description: 'Venue name and address', example: 'Eko Convention Centre, Victoria Island, Lagos' },
      { name: 'description', type: 'string', required: false, description: 'Shown on the public event page', example: 'An intimate acoustic night with Lagos\u2019 rising Afrobeats acts.' },
      { name: 'ticket_price', type: 'number', required: true, description: 'Price per ticket in NGN', example: 25000 },
      { name: 'total_capacity', type: 'integer', required: false, description: 'Maximum tickets available', example: 1200 },
      { name: 'banner_url', type: 'string', required: false, description: 'Public banner image URL', example: 'https://cdn.quidly.com/banners/afrobeats-unplugged.jpg' },
    ],
    response: {
      id: '3c9a1e2b-6f4d-4a3e-9c1a-2b3c4d5e6f7a',
      event_name: 'Afrobeats Unplugged: Lagos Edition',
      event_date: '2026-11-14T19:00:00',
      ticket_price: 25000,
      total_capacity: 1200,
      status: 'active',
      created_at: '2026-08-11T09:40:00Z',
    },
  },

  'events-list': {
    type: 'endpoint',
    eyebrow: 'Events',
    method: 'GET',
    path: '/events',
    title: 'List events',
    description: 'Retrieve all events for the authenticated partner, most recent first.',
    paramLabel: 'Query parameters',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [
      { name: 'status', type: 'string', required: false, description: 'Filter by active, cancelled or completed', example: 'active' },
      { name: 'limit', type: 'integer', required: false, description: 'Page size, defaults to 20', example: 20 },
    ],
    response: {
      data: [
        { id: '3c9a1e2b-6f4d-4a3e-9c1a-2b3c4d5e6f7a', event_name: 'Afrobeats Unplugged: Lagos Edition', status: 'active', ticket_price: 25000 },
        { id: '5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b', event_name: 'Naija Comedy Jam', status: 'active', ticket_price: 10000 },
      ],
      meta: { total: 6, limit: 20 },
    },
  },

  'events-get': {
    type: 'endpoint',
    eyebrow: 'Events',
    method: 'GET',
    path: '/events/{id}',
    title: 'Get an event',
    description: 'Retrieve full details for a single event, including live capacity counts.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [{ name: 'id', type: 'uuid', required: true, description: 'Event ID', example: '3c9a1e2b-6f4d-4a3e-9c1a-2b3c4d5e6f7a' }],
    paramLabel: 'Path parameters',
    response: { id: '3c9a1e2b-6f4d-4a3e-9c1a-2b3c4d5e6f7a', event_name: 'Afrobeats Unplugged: Lagos Edition', total_capacity: 1200, tickets_sold: 812, tickets_checked_in: 340, status: 'active' },
  },

  'events-update': {
    type: 'endpoint',
    eyebrow: 'Events',
    method: 'PATCH',
    path: '/events/{id}',
    title: 'Update an event',
    description: 'Update mutable event fields. ticket_price changes only apply to transactions initialized after the update.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [
      { name: 'event_date', type: 'datetime', required: false, description: 'New start date and time', example: '2026-11-15T19:00:00' },
      { name: 'total_capacity', type: 'integer', required: false, description: 'New maximum capacity', example: 1500 },
      { name: 'banner_url', type: 'string', required: false, description: 'Replacement banner image', example: 'https://cdn.quidly.com/banners/afrobeats-unplugged-v2.jpg' },
    ],
    response: { id: '3c9a1e2b-6f4d-4a3e-9c1a-2b3c4d5e6f7a', total_capacity: 1500, updated_at: '2026-08-12T08:10:00Z' },
  },

  'events-cancel': {
    type: 'endpoint',
    eyebrow: 'Events',
    method: 'POST',
    path: '/events/{id}/cancel',
    title: 'Cancel an event',
    description: 'Mark an event as cancelled. All active tickets are invalidated and, if configured, refunds are queued automatically.',
    tip: 'Cancelling does not delete the event — historical transactions and tickets remain queryable for reporting.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [{ name: 'reason', type: 'string', required: false, description: 'Shown to customers in the cancellation notice', example: 'Venue unavailable due to renovation' }],
    response: { id: '3c9a1e2b-6f4d-4a3e-9c1a-2b3c4d5e6f7a', status: 'cancelled', tickets_invalidated: 812 },
  },

  /* ---------- TICKETS ---------- */
  'tickets-list-by-event': {
    type: 'endpoint',
    eyebrow: 'Tickets & check-in',
    method: 'GET',
    path: '/events/{id}/tickets',
    title: 'List tickets for an event',
    description: 'Retrieve every ticket issued for an event, including its current status and check-in time.',
    paramLabel: 'Query parameters',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [{ name: 'status', type: 'string', required: false, description: 'Filter by active, used or cancelled', example: 'active' }],
    response: {
      data: [
        { ticket_reference: 'TCKT-AB39F2', customer_name: 'Tolu Bakare', status: 'active' },
        { ticket_reference: 'TCKT-7C21DE', customer_name: 'Ifeoma Nwosu', status: 'used', checked_in_at: '2026-11-14T19:24:03' },
      ],
      meta: { total: 812 },
    },
  },

  'tickets-get': {
    type: 'endpoint',
    eyebrow: 'Tickets & check-in',
    method: 'GET',
    path: '/tickets/{reference}',
    title: 'Get a ticket',
    description: 'Look up a single ticket by its ticket_reference.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [{ name: 'reference', type: 'string', required: true, description: 'Ticket reference', example: 'TCKT-AB39F2' }],
    paramLabel: 'Path parameters',
    response: { ticket_reference: 'TCKT-AB39F2', event_id: '3c9a1e2b-6f4d-4a3e-9c1a-2b3c4d5e6f7a', customer_name: 'Tolu Bakare', customer_email: 'tolu.bakare@gmail.com', status: 'active' },
  },

  'tickets-checkin': {
    type: 'endpoint',
    eyebrow: 'Tickets & check-in',
    method: 'POST',
    path: '/tickets/{reference}/check-in',
    title: 'Check in a ticket',
    description: 'Validate a scanned QR code at the door and mark the ticket as used. Returns 409 if the ticket has already been checked in, preventing duplicate entry.',
    tip: 'Point your gate scanner app at this endpoint with a key scoped to tickets:validate only.',
    headers: [{ name: 'Authorization', required: true, description: 'A key with tickets:validate scope' }],
    params: [{ name: 'qr_code_data', type: 'string', required: true, description: 'Raw data decoded from the ticket QR code', example: 'QDLY|TCKT-AB39F2|evt_3c9a1e2b|9f2c1d8e' }],
    response: { ticket_reference: 'TCKT-AB39F2', status: 'used', checked_in_at: '2026-11-14T19:31:47', customer_name: 'Tolu Bakare' },
  },

  /* ---------- TRANSACTIONS ---------- */
  'txn-initialize': {
    type: 'endpoint',
    eyebrow: 'Transactions & payments',
    method: 'POST',
    path: '/transactions',
    title: 'Initialize a transaction',
    description: 'Start a ticket purchase. Returns a quidly_widget_session_id you pass to the Payment Widget to render the checkout UI.',
    headers: [{ name: 'Authorization', required: true, description: 'A key with widget:create_transaction scope' }],
    params: [
      { name: 'event_id', type: 'uuid', required: true, description: 'Event being purchased for', example: '3c9a1e2b-6f4d-4a3e-9c1a-2b3c4d5e6f7a' },
      { name: 'customer_name', type: 'string', required: true, description: 'Ticket holder\u2019s name', example: 'Tolu Bakare' },
      { name: 'customer_email', type: 'string', required: true, description: 'Where the ticket is delivered', example: 'tolu.bakare@gmail.com' },
      { name: 'customer_phone', type: 'string', required: false, description: 'Used for SMS ticket delivery', example: '+2348098765432' },
      { name: 'amount', type: 'number', required: true, description: 'Total charge in the specified currency', example: 25000 },
      { name: 'currency', type: 'string', required: false, description: 'Defaults to NGN', example: 'NGN' },
      { name: 'payment_method', type: 'string', required: false, description: 'card, bank_transfer or ussd', example: 'card' },
    ],
    response: {
      reference: 'QDLY-8823-TXN-4471',
      status: 'pending',
      quidly_widget_session_id: 'qwsess_9f2c1d8e7b6a5f4e',
      amount: 25000,
      currency: 'NGN',
    },
  },

  'txn-verify': {
    type: 'endpoint',
    eyebrow: 'Transactions & payments',
    method: 'GET',
    path: '/transactions/{reference}/verify',
    title: 'Verify a transaction',
    description: 'Confirm the final status of a transaction directly with Quidly — recommended immediately after the widget\u2019s onSuccess callback fires, before trusting client-side state.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [{ name: 'reference', type: 'string', required: true, description: 'Transaction reference', example: 'QDLY-8823-TXN-4471' }],
    paramLabel: 'Path parameters',
    response: { reference: 'QDLY-8823-TXN-4471', status: 'completed', amount: 25000, payment_gateway_ref: 'PSTK_7719203', completed_at: '2026-08-11T09:52:18Z' },
  },

  'txn-get': {
    type: 'endpoint',
    eyebrow: 'Transactions & payments',
    method: 'GET',
    path: '/transactions/{reference}',
    title: 'Get a transaction',
    description: 'Retrieve full details for a single transaction, including customer and payment metadata.',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [{ name: 'reference', type: 'string', required: true, description: 'Transaction reference', example: 'QDLY-8823-TXN-4471' }],
    paramLabel: 'Path parameters',
    response: {
      reference: 'QDLY-8823-TXN-4471',
      event_id: '3c9a1e2b-6f4d-4a3e-9c1a-2b3c4d5e6f7a',
      customer_name: 'Tolu Bakare',
      customer_email: 'tolu.bakare@gmail.com',
      amount: 25000,
      payment_method: 'card',
      status: 'completed',
    },
  },

  'txn-list': {
    type: 'endpoint',
    eyebrow: 'Transactions & payments',
    method: 'GET',
    path: '/transactions',
    title: 'List transactions',
    description: 'Retrieve transactions for the authenticated partner, optionally filtered by event or status — useful for building a settlement or sales dashboard.',
    paramLabel: 'Query parameters',
    headers: [{ name: 'Authorization', required: true, description: 'Your secret key' }],
    params: [
      { name: 'event_id', type: 'uuid', required: false, description: 'Restrict to one event', example: '3c9a1e2b-6f4d-4a3e-9c1a-2b3c4d5e6f7a' },
      { name: 'status', type: 'string', required: false, description: 'pending, processing, completed, failed or cancelled', example: 'completed' },
    ],
    response: {
      data: [
        { reference: 'QDLY-8823-TXN-4471', amount: 25000, status: 'completed' },
        { reference: 'QDLY-8824-TXN-4472', amount: 10000, status: 'failed' },
      ],
      meta: { total: 934 },
    },
  },

  /* ---------- WEBHOOKS ---------- */
  'webhooks-events': {
    type: 'doc',
    eyebrow: 'Webhooks',
    title: 'Event types & payloads',
    description: 'Subscribe your webhook_url to these event types to keep your own platform in sync with Quidly in real time.',
    sections: [
      {
        heading: 'transaction.completed',
        paragraphs: ['Fired the moment a payment settles successfully, just before ticket generation begins.'],
        table: { headers: ['Field', 'Example'], rows: [['event_type', 'transaction.completed'], ['reference', 'QDLY-8823-TXN-4471'], ['amount', '25000']] },
      },
      {
        heading: 'ticket.issued',
        paragraphs: ['Fired once the QR ticket has been generated and emailed to the customer.'],
        table: { headers: ['Field', 'Example'], rows: [['event_type', 'ticket.issued'], ['ticket_reference', 'TCKT-AB39F2'], ['customer_email', 'tolu.bakare@gmail.com']] },
      },
      {
        heading: 'ticket.checked_in',
        paragraphs: ['Fired the instant a ticket is scanned and validated at the gate — useful for a live attendance dashboard.'],
        table: { headers: ['Field', 'Example'], rows: [['event_type', 'ticket.checked_in'], ['ticket_reference', 'TCKT-AB39F2'], ['checked_in_at', '2026-11-14T19:31:47']] },
      },
      {
        heading: 'transaction.failed',
        paragraphs: ['Fired when a payment attempt fails, along with failed_reason so you can prompt the customer to retry.'],
        table: { headers: ['Field', 'Example'], rows: [['event_type', 'transaction.failed'], ['reference', 'QDLY-8824-TXN-4472'], ['failed_reason', 'insufficient_funds']] },
      },
    ],
  },

  'webhooks-retry': {
    type: 'doc',
    eyebrow: 'Webhooks',
    title: 'Delivery & retries',
    description: 'How Quidly handles a webhook endpoint that is slow, unreachable, or returns a non-2xx response.',
    sections: [
      {
        heading: 'Retry schedule',
        paragraphs: ['A non-2xx response — or no response within 10 seconds — marks the delivery failed and schedules a retry. retry_count and next_retry_at are visible on the webhook_events record.'],
        bullets: ['Attempt 1: immediate', 'Attempt 2: after 1 minute', 'Attempt 3: after 10 minutes', 'Attempts 4–8: hourly, then abandoned'],
      },
      {
        heading: 'Best practice',
        paragraphs: ['Respond with 200 as soon as you have durably queued the event, then process it asynchronously — this keeps delivery fast and avoids duplicate retries.'],
      },
    ],
  },

  /* ---------- GUIDES ---------- */
  'guide-track1': {
    type: 'doc',
    eyebrow: 'Guide',
    title: 'Connect an existing event platform',
    description: 'For teams that already have organizers, events and a UI — and just need Quidly to handle payments, ticket generation and check-in validation.',
    sections: [
      {
        heading: '1. Onboard as a partner',
        paragraphs: ['Register your platform as a single Quidly partner, generate sandbox keys from the developer portal, and configure a webhook_url to receive payment and ticket events.'],
      },
      {
        heading: '2. Drop in the payment widget',
        paragraphs: ['Call Initialize a transaction from your backend for each ticket purchase, then hand the returned quidly_widget_session_id to the Quidly Payment Widget on your checkout page. The widget captures card, bank transfer or USSD details and returns control to your app on success or failure.'],
      },
      {
        heading: '3. Confirm and generate tickets',
        paragraphs: ['Quidly verifies the payment server-side, generates a QR ticket, and emails it to the customer automatically. Listen for the ticket.issued webhook to notify your own platform.'],
      },
      {
        heading: '4. Validate tickets at the door',
        paragraphs: ['Point your existing check-in app at Check in a ticket using a key scoped to tickets:validate. Quidly rejects duplicate scans with a 409, so you don\u2019t need to track used state yourself.'],
      },
    ],
  },

  'guide-track2': {
    type: 'doc',
    eyebrow: 'Guide',
    title: 'Launch a ticketing platform on Quidly',
    description: 'For teams building a ticketing product from scratch, using Quidly for organizer accounts, events, payments and QR tickets end to end.',
    sections: [
      {
        heading: '1. Organizer onboarding',
        paragraphs: ['Each organizer who signs up to your platform becomes a Quidly partner: capture business details, bank account and KYC documents through Register a partner, Add settlement account and Submit KYC application.'],
      },
      {
        heading: '2. Event creation & management',
        paragraphs: ['Build a dashboard on top of Create an event, Update an event and Cancel an event so organizers can manage their own listings — name, description, banner, venue, date, and ticket price.'],
      },
      {
        heading: '3. Public event pages & discovery',
        paragraphs: ['Use List events to power a browsable marketplace, and generate a shareable URL per event (for example quidly.com/events/afrobeats-unplugged) that links straight into checkout.'],
      },
      {
        heading: '4. Checkout, tickets & check-in',
        paragraphs: ['Wire up Initialize a transaction behind your ticket selection flow, let Quidly issue the QR ticket automatically, and build a scanner app around Check in a ticket for event day.'],
      },
      {
        heading: '5. Organizer analytics',
        paragraphs: ['Combine List transactions and List tickets for an event to power an organizer dashboard: tickets sold, revenue, attendees checked in, and exportable attendee lists.'],
      },
    ],
  },

  'guide-golive': {
    type: 'doc',
    eyebrow: 'Guide',
    title: 'Go-live checklist',
    description: 'Run through this before switching your integration from sandbox to live keys.',
    sections: [
      {
        heading: 'Checklist',
        bullets: [
          'KYC status is approved and a verified settlement bank account is on file',
          'Live keys generated with the minimum scopes each service actually needs',
          'Webhook endpoint verifies the X-Quidly-Signature header and returns 200 quickly',
          'Check-in devices tested against a real duplicate-scan (409) response',
          'A pilot event run end-to-end in sandbox: create event → sell ticket → check in',
        ],
      },
    ],
  },
})

const doc = computed(() => docs[selectedKey.value] || docs['gs-landing'])

/* ============================================================
   CHANGELOG
============================================================ */
const changelogEntries = [
  {
    date: 'August 12, 2026',
    title: 'KYC resubmission reasons & bank name-enquiry',
    changes: [
      { type: 'Added', text: 'rejection_reason is now returned on Get KYC status for resubmission_required submissions.' },
      { type: 'Added', text: 'Verify account (name enquiry) now supports GTBank, Access, Zenith and UBA in sandbox.' },
    ],
  },
  {
    date: 'July 30, 2026',
    title: 'Faster webhook retries',
    changes: [
      { type: 'Changed', text: 'First retry now fires after 1 minute instead of 5.' },
      { type: 'Fixed', text: 'ticket.checked_in events were occasionally delivered twice for the same scan.' },
    ],
  },
  {
    date: 'July 10, 2026',
    title: 'Scoped API keys',
    changes: [
      { type: 'Added', text: 'Generate API key now accepts a scopes array, including a tickets:validate-only scope for gate devices.' },
      { type: 'Deprecated', text: 'Unscoped legacy keys will stop working on 1 November 2026.' },
    ],
  },
  {
    date: 'June 25, 2026',
    title: 'Sandbox bank verification',
    changes: [{ type: 'Added', text: 'Sandbox now returns an automatic is_verified: true for test account number 0000000000.' }],
  },
]

/* ============================================================
   CODE SAMPLE GENERATION
============================================================ */
function sampleBody(paramList) {
  const body = {}
  ;(paramList || []).forEach((p) => {
    if (p.name === 'id' || p.name === 'reference' || p.name === 'kyc_submission_id') return
    body[p.name] = p.example
  })
  return body
}

const codeText = computed(() => {
  const d = doc.value
  if (d.type !== 'endpoint') return ''
  const hasBody = ['POST', 'PATCH'].includes(d.method) && d.params?.some((p) => !['id', 'reference'].includes(p.name))
  const body = hasBody ? sampleBody(d.params) : null
  const path = `/v1${d.path}`

  if (codeLang.value === 'curl') {
    const lines = [`curl -X ${d.method} https://api.quidly.com${path} \\`, `  -H "Authorization: $QUIDLY_SECRET_KEY" \\`, `  -H "AppId: $QUIDLY_APP_ID"`]
    if (body) {
      lines[lines.length - 1] += ' \\'
      lines.push(`  -H "Content-Type: application/json" \\`)
      lines.push(`  -d '${JSON.stringify(body)}'`)
    }
    return lines.join('\n')
  }

  if (codeLang.value === 'node') {
    return [
      `const res = await fetch("https://api.quidly.com${path}", {`,
      `  method: "${d.method}",`,
      `  headers: {`,
      `    Authorization: process.env.QUIDLY_SECRET_KEY,`,
      `    AppId: process.env.QUIDLY_APP_ID,`,
      body ? `    "Content-Type": "application/json",` : null,
      `  },`,
      body ? `  body: JSON.stringify(${JSON.stringify(body, null, 2).replace(/\n/g, '\n  ')}),` : null,
      `});`,
      ``,
      `const data = await res.json();`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  // python
  return [
    `import os, requests`,
    ``,
    `response = requests.request(`,
    `    "${d.method}",`,
    `    "https://api.quidly.com${path}",`,
    `    headers={`,
    `        "Authorization": os.environ["QUIDLY_SECRET_KEY"],`,
    `        "AppId": os.environ["QUIDLY_APP_ID"],`,
    `    },`,
    body ? `    json=${JSON.stringify(body, null, 4).replace(/\n/g, '\n    ')},` : null,
    `)`,
    ``,
    `data = response.json()`,
  ]
    .filter(Boolean)
    .join('\n')
})

const responseText = computed(() => {
  const d = doc.value
  if (d.type !== 'endpoint') return ''
  return JSON.stringify(d.response, null, 2)
})

function copy(text) {
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<style scoped>
.sidebar-scroll {
  max-height: calc(100vh - 130px);
  overflow-y: auto;
  position: sticky;
  top: 110px;
}
.sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}
.sidebar-scroll::-webkit-scrollbar-thumb {
  background-color: #e5e7eb;
  border-radius: 4px;
}
pre {
  white-space: pre-wrap;
  word-break: break-word;
}
:deep(.v-tab) {
  letter-spacing: normal;
}
</style>