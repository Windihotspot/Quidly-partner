<template>
  <div
    :class="[
      'rounded-lg p-4 border-l-4 flex items-start gap-4',
      statusStyles[status]?.bg,
      statusStyles[status]?.border,
    ]"
  >
    <div
      :class="[
        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        statusStyles[status]?.icon,
      ]"
    >
      <component :is="statusIcons[status]" class="w-6 h-6" />
    </div>

    <div class="flex-1">
      <h3 :class="['font-semibold mb-1', statusStyles[status]?.text]">
        {{ statusLabels[status] }}
      </h3>
      <p :class="['text-sm', statusStyles[status]?.desc]">
        {{ statusMessages[status] }}
      </p>
      <p v-if="approvedDate" class="text-xs mt-2 opacity-75">
        Approved on {{ formatDate(approvedDate) }}
      </p>
    </div>

    <div v-if="status === 'approved'" class="flex-shrink-0">
      <v-btn
        size="small"
        variant="tonal"
        to="/dashboard/api-keys"
        class="text-xs"
      >
        View API Keys
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline'

interface Props {
  status: 'not_started' | 'submitted' | 'under_review' | 'resubmission_required' | 'approved' | 'rejected' | 'suspended'
  approvedDate?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  approvedDate: null,
})

const statusStyles = {
  not_started: {
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    icon: 'bg-gray-100',
    text: 'text-gray-900',
    desc: 'text-gray-600',
  },
  submitted: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    icon: 'bg-blue-100',
    text: 'text-blue-900',
    desc: 'text-blue-700',
  },
  under_review: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: 'bg-amber-100',
    text: 'text-amber-900',
    desc: 'text-amber-700',
  },
  resubmission_required: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    icon: 'bg-orange-100',
    text: 'text-orange-900',
    desc: 'text-orange-700',
  },
  approved: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    icon: 'bg-green-100',
    text: 'text-green-900',
    desc: 'text-green-700',
  },
  rejected: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon: 'bg-red-100',
    text: 'text-red-900',
    desc: 'text-red-700',
  },
  suspended: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon: 'bg-red-100',
    text: 'text-red-900',
    desc: 'text-red-700',
  },
}

const statusIcons = {
  not_started: DocumentIcon,
  submitted: ClockIcon,
  under_review: ClockIcon,
  resubmission_required: ExclamationTriangleIcon,
  approved: CheckCircleIcon,
  rejected: XCircleIcon,
  suspended: XCircleIcon,
}

const statusLabels = {
  not_started: 'Not Started',
  submitted: 'Submission Received',
  under_review: 'Under Review',
  resubmission_required: 'Resubmission Required',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
}

const statusMessages = {
  not_started: 'Start your KYC verification to access API keys',
  submitted: 'Thank you for your submission. Our team is reviewing your information.',
  under_review: 'Your KYC submission is being reviewed by our compliance team.',
  resubmission_required: 'We need additional information or corrected documents.',
  approved: 'Your KYC verification is complete! You can now use API keys.',
  rejected: 'Unfortunately, your KYC submission was not approved.',
  suspended: 'Your account has been suspended. Please contact support.',
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>