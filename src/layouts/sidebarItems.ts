const sidebarItems = [
  {
    section: 'OVERVIEW',
    roles: ['partner', 'admin'],
    items: [
      {
        nav: 'overview',
        label: 'Dashboard',
        icon: 'mdi mdi-view-dashboard-outline',
        to: '/dashboard'
      },
      { nav: 'events', label: 'Events', icon: 'mdi mdi-calendar-outline', to: '/events' },
      { nav: 'orders', label: 'Orders', icon: 'mdi mdi-receipt-text-outline', to: '/orders' }
    ]
  },
  {
    section: 'FINANCE',
    roles: ['partner', 'admin'],
    items: [
      {
        nav: 'settlements',
        label: 'Settlements',
        icon: 'mdi mdi-bank-transfer',
        to: '/settlements'
      }
    ]
  },

  {
    section: 'ACCOUNT',
    roles: ['partner', 'admin'],
    items: [
      {
        nav: 'kyc',
        label: 'Business Verification',
        icon: 'mdi mdi-shield-check-outline',
        to: '/kyc'
      },
      { nav: 'settings', label: 'Settings', icon: 'mdi mdi-cog-outline', to: '/settings' }
    ]
  },
  {
    section: 'PLATFORM',
    roles: ['super_admin'],
    items: [
      { nav: 'admin', label: 'Dashboard', icon: 'mdi mdi-view-dashboard-outline', to: '/admin' },
      { nav: 'a-partners', label: 'Partners', icon: 'mdi mdi-domain', to: '/admin/partners' },
      {
        nav: 'a-kyc',
        label: 'KYC Reviews',
        icon: 'mdi mdi-shield-check-outline',
        to: '/admin/kyc'
      },
      {
        nav: 'a-tx',
        label: 'Transactions',
        icon: 'mdi mdi-swap-horizontal',
        to: '/admin/transactions'
      },
      { nav: 'a-events', label: 'Events', icon: 'mdi mdi-calendar-outline', to: '/admin/events' }
    ]
  },
  {
    section: 'FINANCE',
    roles: ['super_admin'],
    items: [
      {
        nav: 'a-settle',
        label: 'Settlements',
        icon: 'mdi mdi-bank-transfer',
        to: '/admin/settlements'
      }
    ]
  },
  {
    section: 'SYSTEM',
    roles: ['super_admin'],
    items: [
      { nav: 'a-banks', label: 'Banks', icon: 'mdi mdi-bank-outline', to: '/admin/banks' },
      { nav: 'a-ops', label: 'Webhooks & Keys', icon: 'mdi mdi-webhook', to: '/admin/ops' },
      { nav: 'a-audit', label: 'Audit Log', icon: 'mdi mdi-history', to: '/admin/audit' },
      { nav: 'a-users', label: 'Admins', icon: 'mdi mdi-account-key-outline', to: '/admin/users' }
    ]
  }
]

export default sidebarItems
