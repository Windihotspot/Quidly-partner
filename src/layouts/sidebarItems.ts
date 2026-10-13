const sidebarItems = [
  {
    section: 'OVERVIEW',
    roles: ['partner', 'admin'],
    items: [
      { nav: 'overview', label: 'Dashboard', icon: 'mdi mdi-view-dashboard-outline', to: '/dashboard' },
      { nav: 'events', label: 'Events', icon: 'mdi mdi-calendar-outline', to: '/events' },
    ],
  },
   {
    section: 'FINANCE',
    roles: ['partner', 'admin'],
    items: [
      { nav: 'settlements', label: 'Settlements', icon: 'mdi mdi-bank-transfer', to: '/settlements' },
    ],
  },
  // {
  //   section: 'DEVELOPERS',
  //   roles: ['partner', 'admin'],
  //   items: [
  //     { nav: 'api-keys', label: 'API Keys', icon: 'mdi mdi-key-outline', to: '/api-keys' },
  //     { nav: 'widget', label: 'Payment Widget', icon: 'mdi mdi-puzzle-outline', to: '/widget' },
  //     { nav: 'webhooks', label: 'Webhooks', icon: 'mdi mdi-webhook', to: '/webhooks' },
  //   ],
  // },
 
  {
    section: 'ACCOUNT',
    roles: ['partner', 'admin'],
    items: [
      { nav: 'kyc', label: 'Business Verification', icon: 'mdi mdi-shield-check-outline', to: '/kyc' },
      { nav: 'settings', label: 'Settings', icon: 'mdi mdi-cog-outline', to: '/settings' },
    ],
  },
]

export default sidebarItems