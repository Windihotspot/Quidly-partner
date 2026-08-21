<script setup>
import { ref, reactive } from 'vue'
import { mockWebhooks, generateFakeSecret, simulateDelay } from '@/lib/mockData'
import MainLayout from '@/layouts/MainLayout.vue'

const webhooks = ref(JSON.parse(JSON.stringify(mockWebhooks)))
const revealedSecrets = ref({})
const rotating = ref(null)
const snackbar = ref({ show: false, text: '' })

const dialog = ref(false)
const saving = ref(false)
const form = reactive({ url: '' })

function mask(secret) {
  return secret.slice(0, 10) + '••••••••••••'
}

function toggleReveal(id) {
  revealedSecrets.value[id] = !revealedSecrets.value[id]
}

function copy(text) {
  navigator.clipboard?.writeText(text)
  snackbar.value = { show: true, text: 'Copied to clipboard.' }
}

async function toggleEnabled(hook) {
  hook.enabled = !hook.enabled
  snackbar.value = {
    show: true,
    text: `Webhook ${hook.enabled ? 'enabled' : 'disabled'}.`
  }
}

async function rotateSecret(hook) {
  rotating.value = hook.id

  await simulateDelay(900)

  hook.secret = generateFakeSecret()
  revealedSecrets.value[hook.id] = true

  rotating.value = null

  snackbar.value = {
    show: true,
    text: 'Secret rotated. Update it in your integration.'
  }
}

async function removeHook(hook) {
  webhooks.value = webhooks.value.filter((h) => h.id !== hook.id)

  snackbar.value = {
    show: true,
    text: 'Webhook removed.'
  }
}

async function handleAdd() {
  if (!form.url) return

  saving.value = true

  await simulateDelay(900)

  webhooks.value.push({
    id: `wh_${Date.now()}`,
    url: form.url,
    enabled: true,
    secret: generateFakeSecret(),
  })

  saving.value = false
  dialog.value = false
  form.url = ''

  snackbar.value = {
    show: true,
    text: 'Webhook endpoint added.'
  }
}
</script>

<template>
  <MainLayout
    title="Webhooks"
    subtitle="Get notified the moment a payment or ticket status changes."
  >
    <!-- ADD BUTTON -->
    <div class="flex justify-end mb-5 sm:mb-6">
      <v-btn
        class="create-btn w-full sm:w-auto"
        prepend-icon="mdi-plus"
        @click="dialog = true"
      >
        Add endpoint
      </v-btn>
    </div>

    <!-- WEBHOOK LIST -->
    <div class="grid gap-4">
      <div
        v-for="hook in webhooks"
        :key="hook.id"
        class="webhook-card"
      >
        <!-- TOP SECTION -->
        <div class="webhook-header">
          <!-- ICON + URL -->
          <div class="webhook-info">
            <span
              class="icon-badge"
              style="background: #e8f5e9"
            >
              <i
                class="mdi mdi-webhook"
                style="color: #1b8a3a"
              ></i>
            </span>

            <div class="hook-content">
              <div class="flex items-start gap-2">
                <span
                  class="status-dot mt-[5px]"
                  :class="hook.enabled ? 'dot-on' : 'dot-off'"
                ></span>

                <p class="font-mono text-sm hook-url">
                  {{ hook.url }}
                </p>
              </div>
            </div>
          </div>

          <!-- CONTROLS -->
          <div class="webhook-controls">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 sm:hidden">
                {{ hook.enabled ? 'Active' : 'Disabled' }}
              </span>

              <v-switch
                :model-value="hook.enabled"
                density="compact"
                hide-details
                color="#2b7fff"
                @update:model-value="toggleEnabled(hook)"
              />
            </div>

            <v-btn
              icon="mdi-delete-outline"
              variant="text"
              size="small"
              class="!text-[#dc2626]"
              @click="removeHook(hook)"
            />
          </div>
        </div>

        <!-- SECRET -->
        <div class="secret-panel">
          <!-- SECRET VALUE -->
          <div class="secret-info">
            <p class="font-mono text-[10px] uppercase tracking-widest secret-label">
              Signing secret
            </p>

            <p class="font-mono text-xs secret-value mt-1 break-all">
              {{
                revealedSecrets[hook.id]
                  ? hook.secret
                  : mask(hook.secret)
              }}
            </p>
          </div>

          <!-- ACTIONS -->
          <div class="secret-actions">
            <v-btn
              size="small"
              variant="text"
              class="!text-[#2b7fff]"
              @click="toggleReveal(hook.id)"
            >
              {{ revealedSecrets[hook.id] ? 'Hide' : 'Reveal' }}
            </v-btn>

            <v-btn
              size="small"
              variant="text"
              class="!text-[#2b7fff]"
              prepend-icon="mdi-content-copy"
              @click="copy(hook.secret)"
            >
              Copy
            </v-btn>

            <v-btn
              size="small"
              variant="text"
              class="!text-[#dc2626]"
              :loading="rotating === hook.id"
              @click="rotateSecret(hook)"
            >
              Rotate
            </v-btn>
          </div>
        </div>
      </div>

      <!-- EMPTY STATE -->
      <p
        v-if="!webhooks.length"
        class="text-center empty-state text-sm py-12"
      >
        No webhook endpoints configured yet.
      </p>
    </div>

    <!-- ADD WEBHOOK DIALOG -->
    <v-dialog
      v-model="dialog"
      max-width="420"
      width="calc(100% - 32px)"
    >
      <v-card class="!rounded-xl">
        <v-card-title class="font-display text-xl px-5 pt-5">
          Add webhook endpoint
        </v-card-title>

        <v-card-text class="px-5">
          <v-text-field
            v-model="form.url"
            label="Endpoint URL"
            placeholder="https://yourapp.com/webhooks/quidly"
            variant="outlined"
            density="comfortable"
            color="#2b7fff"
          />
        </v-card-text>

        <v-card-actions class="px-5 pb-5 flex flex-col-reverse sm:flex-row gap-2">
          <v-btn
            variant="text"
            class="w-full sm:w-auto"
            @click="dialog = false"
          >
            Cancel
          </v-btn>

          <v-btn
            class="save-btn w-full sm:w-auto"
            :loading="saving"
            @click="handleAdd"
          >
            Add endpoint
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="snackbar.show"
      timeout="2200"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </MainLayout>
</template>

<style scoped>
.v-btn {
  text-transform: none;
}

/* =========================
   BUTTONS
========================= */

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

/* =========================
   WEBHOOK CARD
========================= */

.webhook-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 24px;
  transition: box-shadow 0.2s ease;
}

.webhook-card:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

/* =========================
   HEADER
========================= */

.webhook-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.webhook-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.hook-content {
  min-width: 0;
  flex: 1;
}

.hook-url {
  color: #2b3e50;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.webhook-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* =========================
   ICON
========================= */

.icon-badge {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
}

/* =========================
   STATUS
========================= */

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex-shrink: 0;
}

.dot-on {
  background: #1b8a3a;
}

.dot-off {
  background: #d1d5db;
}

/* =========================
   SECRET
========================= */

.secret-panel {
  margin-top: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.secret-info {
  min-width: 0;
  flex: 1;
}

.secret-label {
  color: #9ca3af;
}

.secret-value {
  color: #2b3e50;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.secret-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.empty-state {
  color: #9ca3af;
}

/* =========================
   MOBILE
========================= */

@media (max-width: 640px) {
  .webhook-card {
    padding: 16px;
    border-radius: 15px;
  }

  .webhook-header {
    align-items: flex-start;
    gap: 12px;
  }

  .webhook-info {
    align-items: flex-start;
    gap: 10px;
  }

  .webhook-controls {
    gap: 2px;
  }

  .secret-panel {
    margin-top: 14px;
    padding: 12px;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .secret-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
    border-top: 1px solid #e5e7eb;
    padding-top: 8px;
  }

  .secret-actions .v-btn {
    padding-left: 8px !important;
    padding-right: 8px !important;
  }
}

/* =========================
   VERY SMALL SCREENS
========================= */

@media (max-width: 380px) {
  .webhook-card {
    padding: 13px;
  }

  .icon-badge {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }

  .hook-url {
    font-size: 12px;
  }

  .secret-actions {
    gap: 0;
  }

  .secret-actions .v-btn {
    font-size: 12px;
  }
}
</style>