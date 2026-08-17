<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4 py-8 md:py-12">
    <!-- Header -->
    <div class="max-w-6xl mx-auto mb-8">
      <div class="flex items-center gap-3 mb-2">
        <div class="p-2 bg-blue-100 rounded-lg">
          <svg class="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-gray-900">KYC Review</h1>
      </div>
      <p class="text-gray-600 ml-11">Review and approve partner KYC submissions</p>
    </div>

    <!-- Main Content -->
    <div class="max-w-6xl mx-auto">
      <!-- Filters -->
      <div class="bg-white rounded-xl shadow-md p-6 mb-8">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <v-select
            v-model="filterStatus"
            label="Filter by Status"
            :items="statusOptions"
            variant="outlined"
            density="comfortable"
            @update:model-value="loadSubmissions"
          />

          <v-text-field
            v-model="searchQuery"
            label="Search by Name or Email"
            variant="outlined"
            density="comfortable"
            @input="loadSubmissions"
          />

          <v-btn
            color="primary"
            size="large"
            @click="loadSubmissions"
            :loading="loading"
          >
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd" />
            </svg>
            Refresh
          </v-btn>
        </div>
      </div>

      <!-- Submissions List -->
      <div class="space-y-4">
        <v-progress-linear
          v-if="loading && submissions.length === 0"
          indeterminate
          color="primary"
          class="mb-6"
        />

        <div v-if="submissions.length === 0 && !loading" class="bg-white rounded-xl shadow-md p-12 text-center">
          <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-gray-600 font-medium mb-2">No submissions found</p>
          <p class="text-gray-500 text-sm">Adjust filters or check back later</p>
        </div>

        <!-- Submission Cards -->
        <KYCSubmissionCard
          v-for="submission in submissions"
          :key="submission.id"
          :submission="submission"
          :partner="partners[submission.partner_id]"
          :documents="documentsBySubmission[submission.id] || []"
          :loading="loading"
          @approve="handleApprove"
          @reject="handleReject"
          @view-details="selectedSubmission = submission"
        />
      </div>

      <!-- Details Modal -->
      <KYCSubmissionDetailsModal
        v-model="showDetailsModal"
        :submission="selectedSubmission"
        :partner="selectedSubmission ? partners[selectedSubmission.partner_id] : null"
        :documents="selectedSubmission ? (documentsBySubmission[selectedSubmission.id] || []) : []"
        @approve="handleApprove"
        @reject="handleReject"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createClient } from '@supabase/supabase-js'
import KYCSubmissionCard from '@/components/Admin/KYCSubmissionCard.vue'
import KYCSubmissionDetailsModal from '@/components/Admin/KYCSubmissionDetailsModal.vue'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// State
const submissions = ref<any[]>([])
const partners = ref<Record<string, any>>({})
const documentsBySubmission = ref<Record<string, any[]>>({})
const loading = ref(false)
const selectedSubmission = ref<any | null>(null)
const showDetailsModal = ref(false)

// Filters
const filterStatus = ref('submitted')
const searchQuery = ref('')

const statusOptions = [
  { title: 'All', value: null },
  { title: 'Submitted', value: 'submitted' },
  { title: 'Under Review', value: 'under_review' },
  { title: 'Approved', value: 'approved' },
  { title: 'Rejected', value: 'rejected' },
]

// Methods
const loadSubmissions = async () => {
  loading.value = true

  try {
    // Build query
    let query = supabase
      .from('partner_kyc_submissions')
      .select('*')

    if (filterStatus.value) {
      query = query.eq('status', filterStatus.value)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    // Filter by search query
    let filtered = data || []
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      filtered = filtered.filter(sub =>
        sub.legal_business_name.toLowerCase().includes(q) ||
        sub.director_full_name.toLowerCase().includes(q)
      )
    }

    submissions.value = filtered

    // Load partner info
    const partnerIds = [...new Set(filtered.map(s => s.partner_id))]
    const { data: partnerData } = await supabase
      .from('partners')
      .select('*')
      .in('id', partnerIds)

    partners.value = {}
    partnerData?.forEach(p => {
      partners.value[p.id] = p
    })

    // Load documents for each submission
    const submissionIds = filtered.map(s => s.id)
    const { data: docsData } = await supabase
      .from('partner_kyc_documents')
      .select('*')
      .in('kyc_submission_id', submissionIds)

    documentsBySubmission.value = {}
    docsData?.forEach(doc => {
      if (!documentsBySubmission.value[doc.kyc_submission_id]) {
        documentsBySubmission.value[doc.kyc_submission_id] = []
      }
      documentsBySubmission.value[doc.kyc_submission_id].push(doc)
    })
  } catch (err) {
    console.error('Error loading submissions:', err)
  } finally {
    loading.value = false
  }
}

const handleApprove = async (submissionId: string, adminNotes: string) => {
  try {
    const submission = submissions.value.find(s => s.id === submissionId)
    if (!submission) return

    // Update submission status
    const { error: updateSubError } = await supabase
      .from('partner_kyc_submissions')
      .update({
        status: 'approved',
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submissionId)

    if (updateSubError) throw updateSubError

    // Update partner KYC status
    const { error: updatePartnerError } = await supabase
      .from('partners')
      .update({
        kyc_status: 'approved',
        kyc_approved_at: new Date().toISOString(),
        kyc_approved_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('id', submission.partner_id)

    if (updatePartnerError) throw updatePartnerError

    // Log to history
    await supabase.from('partner_kyc_status_history').insert({
      partner_id: submission.partner_id,
      from_status: submission.kyc_status,
      to_status: 'approved',
      changed_by: (await supabase.auth.getUser()).data.user?.id,
      reason: adminNotes,
    })

    // TODO: Send email notification to partner

    await loadSubmissions()
    selectedSubmission.value = null
    showDetailsModal.value = false
  } catch (err) {
    console.error('Error approving submission:', err)
  }
}

const handleReject = async (submissionId: string, rejectionReason: string) => {
  try {
    const submission = submissions.value.find(s => s.id === submissionId)
    if (!submission) return

    // Update submission status
    const { error: updateSubError } = await supabase
      .from('partner_kyc_submissions')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason,
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submissionId)

    if (updateSubError) throw updateSubError

    // Update partner KYC status to resubmission_required
    const { error: updatePartnerError } = await supabase
      .from('partners')
      .update({
        kyc_status: 'resubmission_required',
      })
      .eq('id', submission.partner_id)

    if (updatePartnerError) throw updatePartnerError

    // Log to history
    await supabase.from('partner_kyc_status_history').insert({
      partner_id: submission.partner_id,
      from_status: submission.kyc_status,
      to_status: 'rejected',
      changed_by: (await supabase.auth.getUser()).data.user?.id,
      reason: rejectionReason,
    })

    // TODO: Send email notification to partner

    await loadSubmissions()
    selectedSubmission.value = null
    showDetailsModal.value = false
  } catch (err) {
    console.error('Error rejecting submission:', err)
  }
}

// Initialize
onMounted(() => {
  loadSubmissions()
})
</script>