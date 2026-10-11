<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  date: { default: null },            // Date | null
  time: { type: String, default: '' }, // "hh:mm"
  ampm: { type: String, default: 'AM' },
  error: { type: String, default: '' },
})
const emit = defineEmits(['update:date', 'update:time', 'update:ampm'])

const open = ref(false)
const formatted = computed(() =>
  props.date ? props.date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
)

function onDate(v) {
  emit('update:date', v)
  open.value = false
}
function onTime(v) {
  emit('update:time', String(v ?? '').replace(/[^\d:]/g, '').slice(0, 5))
}
</script>

<template>
  <div>
    <span class="q-label q-req">{{ label }}</span>
    <div class="grid gap-3" style="grid-template-columns: 1fr 1fr 110px">
      <v-menu v-model="open" :close-on-content-click="false" location="bottom start">
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
        <v-date-picker :model-value="date" color="#2b7fff" show-adjacent-months @update:model-value="onDate" />
      </v-menu>

      <v-text-field
        :model-value="time"
        placeholder="hh:mm"
        variant="outlined"
        density="comfortable"
        color="#2b7fff"
        hide-details
        prepend-inner-icon="mdi-clock-outline"
        :error="!!error"
        @update:model-value="onTime"
      />

      <v-select
        :model-value="ampm"
        :items="['AM', 'PM']"
        variant="outlined"
        density="comfortable"
        color="#2b7fff"
        hide-details
        @update:model-value="(v) => emit('update:ampm', v)"
      />
    </div>
    <p v-if="error" class="q-error">{{ error }}</p>
  </div>
</template>
