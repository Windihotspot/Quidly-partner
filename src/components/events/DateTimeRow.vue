
<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  date: { default: null },
  time: { type: String, default: '' }, // HH:mm (24-hour)
  ampm: { type: String, default: 'AM' },
  error: { type: String, default: '' },
})

const emit = defineEmits([
  'update:date',
  'update:time',
  'update:ampm',
])

const dateMenu = ref(false)
const timeMenu = ref(false)

const formatted = computed(() => {
  if (!props.date) return ''

  // Supports both YYYY-MM-DD strings and Date objects.
  if (typeof props.date === 'string') {
    const [year, month, day] = props.date.split('-').map(Number)
    if (!year || !month || !day) return props.date

    return new Date(year, month - 1, day).toLocaleDateString(
      'en-NG',
      { day: 'numeric', month: 'short', year: 'numeric' },
    )
  }

  return props.date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
})

const formattedTime = computed(() => {
  if (!props.time) return null

  const [hours, minutes] = props.time.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null

  const hour12 = hours % 12 || 12

  return `${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
})

function onDate(value) {
  if (!value) return

  emit('update:date', value)
  dateMenu.value = false
}

function onTime(value) {
  if (!value) return

  const match = String(value).match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return

  emit(
    'update:time',
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  )

  emit('update:ampm', hours >= 12 ? 'PM' : 'AM')
}

function onAmpm(value) {
  if (!value) return

  if (!props.time) {
    emit('update:ampm', value)
    return
  }

  const [hours, minutes] = props.time.split(':').map(Number)

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return

  const hour12 = hours % 12
  const newHours = value === 'PM' ? hour12 + 12 : hour12

  emit(
    'update:time',
    `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  )

  emit('update:ampm', value)
}
</script>

<template>
  <div class="date-time-wrapper">
    <span class="q-label q-req">{{ label }}</span>

    <div class="date-time-grid">
      <!-- Date picker -->
      <v-menu
        v-model="dateMenu"
        :close-on-content-click="false"
        location="bottom start"
      >
        <template #activator="{ props: menuProps }">
          <v-text-field
            v-bind="menuProps"
            :model-value="formatted"
            :placeholder="label.replace(/^(Start|End) /, '') + ' (pick a date)'"
            readonly
            variant="outlined"
            density="comfortable"
            color="#2b7fff"
            hide-details
            prepend-inner-icon="mdi-calendar-outline"
            :error="!!error"
          />
        </template>

        <v-date-picker
          :model-value="date"
          color="#2b7fff"
          show-adjacent-months
          @update:model-value="onDate"
        />
      </v-menu>

      <!-- Time picker -->
      <v-menu
        v-model="timeMenu"
        :close-on-content-click="false"
        location="bottom start"
      >
        <template #activator="{ props: menuProps }">
          <v-text-field
            v-bind="menuProps"
            :model-value="formattedTime"
            placeholder="Select time"
            readonly
            variant="outlined"
            density="comfortable"
            color="#2b7fff"
            hide-details
            prepend-inner-icon="mdi-clock-outline"
            :error="!!error"
          />
        </template>

        <v-time-picker
          :model-value="time"
          format="24hr"
          color="#2b7fff"
          @update:model-value="onTime"
        />
      </v-menu>

      <!-- AM/PM selector -->
      <v-select
        :model-value="ampm"
        :items="['AM', 'PM']"
        variant="outlined"
        density="comfortable"
        color="#2b7fff"
        hide-details
        :error="!!error"
        @update:model-value="onAmpm"
      />
    </div>

    <p v-if="error" class="q-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.date-time-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 100px;
  gap: 12px;
  align-items: start;
}

@media (max-width: 600px) {
  .date-time-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
}
</style>
