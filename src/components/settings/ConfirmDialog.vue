<script setup>
defineProps({
  modelValue: Boolean,
  title: { type: String, required: true },
  text: { type: String, default: '' },
  confirmText: { type: String, default: 'Confirm' },
  busy: Boolean,
})
const emit = defineEmits(['update:modelValue', 'confirm'])
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="420" @update:model-value="emit('update:modelValue', $event)">
    <div class="cd">
      <h3 class="q-section-title">{{ title }}</h3>
      <p class="q-help mt-1">{{ text }}</p>
      <div class="flex justify-end gap-2 mt-6">
        <v-btn class="q-btn-ghost" :disabled="busy" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn class="q-btn-primary" :loading="busy" @click="emit('confirm')">{{ confirmText }}</v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
.cd { background: #fff; border-radius: 18px; padding: 24px; }
</style>