<script setup>
import { ref, computed } from 'vue'
import { mockSettlements, formatNaira, simulateDelay } from '@/lib/mockData'
import MainLayout from '@/layouts/MainLayout.vue'
import { usePDF } from 'vue3-pdfmake'

const settlements = ref(mockSettlements)
const statusFilter = ref('all')
const downloading = ref(null)
const snackbar = ref({ show: false, text: '' })

const pdfmake = usePDF({ autoInstallVFS: true })

const statusStyles = {
  paid: { bg: '#e8f5e9', color: '#1b8a3a' },
  processing: { bg: '#fff3e0', color: '#b45309' }
}

const filtered = computed(() =>
  statusFilter.value === 'all'
    ? settlements.value
    : settlements.value.filter((s) => s.status === statusFilter.value)
)

const totals = computed(() => ({
  gross: settlements.value.reduce((sum, s) => sum + s.gross, 0),
  fees: settlements.value.reduce((sum, s) => sum + s.fees, 0),
  net: settlements.value.reduce((sum, s) => sum + s.net, 0)
}))

async function downloadReport(settlement) {
  downloading.value = settlement.id
  await simulateDelay(1000)
  downloading.value = null
  snackbar.value = { show: true, text: `Settlement report for ${settlement.period} downloaded.` }

  // Generate PDF with the settlement data
  generatePDF(settlement)
}

const generatePDF = (settlementData = null) => {
  // If specific settlement data is provided, use it, otherwise use filtered data
  const dataToUse = settlementData ? [settlementData] : filtered.value

  // Create table rows from the data
  const tableBody = [
    ['Period', 'Gross', 'Fees', 'Net', 'Status'] // Header row
  ]

  dataToUse.forEach((item) => {
    tableBody.push([
      item.period || 'N/A',
      `$${item.gross.toFixed(2)}`,
      `$${item.fees.toFixed(2)}`,
      `$${item.net.toFixed(2)}`,
      item.status.charAt(0).toUpperCase() + item.status.slice(1)
    ])
  })

  // Add totals row if showing all settlements
  if (!settlementData) {
    tableBody.push([
      'TOTAL',
      `$${totals.value.gross.toFixed(2)}`,
      `$${totals.value.fees.toFixed(2)}`,
      `$${totals.value.net.toFixed(2)}`,
      ''
    ])
  }

  const docDefinition = {
    content: [
      {
        text: settlementData
          ? `Settlement Report - ${settlementData.period}`
          : 'Settlements Report',
        fontSize: 24,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 20]
      },
      {
        text: settlementData ? `Status: ${settlementData.status}` : `Filter: ${statusFilter.value}`,
        fontSize: 14,
        margin: [0, 0, 0, 20]
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: tableBody
        },
        layout: {
          fillColor: function (rowIndex) {
            return rowIndex === 0 ? '#f5f5f5' : rowIndex % 2 === 0 ? '#fafafa' : null
          },
          hLineWidth: function (i, node) {
            return i === 0 || i === node.table.body.length ? 0.5 : 0.1
          },
          vLineWidth: function () {
            return 0.5
          }
        }
      },
      {
        text: `Generated on: ${new Date().toLocaleString()}`,
        fontSize: 10,
        alignment: 'center',
        margin: [0, 20, 0, 0],
        color: '#666'
      }
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10]
      },
      subheader: {
        fontSize: 14,
        margin: [0, 10, 0, 10]
      }
    },
    defaultStyle: {
      fontSize: 12
    }
  }

  // Generate filename based on what's being downloaded
  const filename = settlementData
    ? `settlement-${settlementData.period.toLowerCase().replace(/\s+/g, '-')}.pdf`
    : 'settlements-report.pdf'

  // Trigger the browser download
  pdfmake.createPdf(docDefinition).download(filename)
}
</script>

<template>
  <MainLayout title="Settlements" subtitle="Track payouts, platform fees, and refunds.">
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="summary-card">
        <p class="font-mono text-[10px] uppercase tracking-widest summary-label">Gross volume</p>
        <p class="font-display text-2xl font-bold summary-value mt-1">
          {{ formatNaira(totals.gross) }}
        </p>
      </div>
      <div class="summary-card">
        <p class="font-mono text-[10px] uppercase tracking-widest summary-label">Platform fees</p>
        <p class="font-display text-2xl font-bold summary-value mt-1">
          {{ formatNaira(totals.fees) }}
        </p>
      </div>
      <div class="summary-card-highlight">
        <p class="font-mono text-[10px] uppercase tracking-widest" style="color: #cfe3ff">
          Net payout
        </p>
        <p class="font-display text-2xl font-bold mt-1">{{ formatNaira(totals.net) }}</p>
      </div>
    </div>

    <div class="flex justify-end mb-4 gap-2">
      <v-btn-toggle
        v-model="statusFilter"
        mandatory
        density="compact"
        class="!rounded-lg filter-toggle"
      >
        <v-btn value="all" size="small">All</v-btn>
        <v-btn value="paid" size="small">Paid</v-btn>
        <v-btn value="processing" size="small">Processing</v-btn>
      </v-btn-toggle>

      <v-btn @click="generatePDF()" size="small"  class="!rounded-lg ">
        Download PDF
      </v-btn>
    </div>

    <div class="table-card">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left table-head font-mono text-[11px] uppercase tracking-wider">
            <th class="px-6 py-3 font-normal">Period</th>
            <th class="py-3 font-normal">Gross</th>
            <th class="py-3 font-normal">Fees</th>
            <th class="py-3 font-normal">Refunds</th>
            <th class="py-3 font-normal">Net</th>
            <th class="py-3 font-normal">Status</th>
            <th class="py-3 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in filtered" :key="s.id" class="table-row">
            <td class="px-6 py-3 row-emphasis font-medium">{{ s.period }}</td>
            <td class="py-3 row-body">{{ formatNaira(s.gross) }}</td>
            <td class="py-3 row-body">{{ formatNaira(s.fees) }}</td>
            <td class="py-3 row-body">{{ formatNaira(s.refunds) }}</td>
            <td class="py-3 row-emphasis font-semibold">{{ formatNaira(s.net) }}</td>
            <td class="py-3">
              <span
                class="status-pill"
                :style="{
                  background: statusStyles[s.status].bg,
                  color: statusStyles[s.status].color
                }"
              >
                {{ s.status }}
              </span>
            </td>
            <td class="py-3 pr-6 text-right">
              <v-btn
                size="small"
                variant="text"
                class="!text-[#2b7fff]"
                :loading="downloading === s.id"
                prepend-icon="mdi-download-outline"
                @click="downloadReport(s)"
              >
                Report
              </v-btn>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <v-snackbar v-model="snackbar.show" timeout="2200">{{ snackbar.text }}</v-snackbar>
  </MainLayout>
</template>

<style scoped>
.summary-card {
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  padding: 16px 20px;
}

.summary-card-highlight {
  background: #2b7fff;
  border-radius: 14px;
  padding: 16px 20px;
  color: #fff;
  box-shadow: 0 4px 14px rgba(43, 127, 255, 0.25);
}

.summary-label {
  color: #9ca3af;
}

.summary-value {
  color: #2b3e50;
}

.filter-toggle :deep(.v-btn) {
  color: #6b7280;
}

.filter-toggle :deep(.v-btn--active) {
  background: #e3f0ff !important;
  color: #2b7fff !important;
}

.table-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.table-head {
  color: #9ca3af;
}

.table-row {
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.row-emphasis {
  color: #2b3e50;
}

.row-body {
  color: #4b5563;
}

.status-pill {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 600;
  text-transform: capitalize;
}
</style>
