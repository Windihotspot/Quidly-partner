import '@/scss/style.scss'

import { createApp } from 'vue'
import { PDFPlugin } from 'vue3-pdfmake';
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import App from './App.vue'
import router from './router'
import 'aos/dist/aos.css'
import AOS from 'aos'

// Import Element Plus and its styles
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

import 'vuetify/styles'
import './assets/fonts.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import VueApexCharts from 'vue3-apexcharts'
import '@fortawesome/fontawesome-free/css/all.css'
import '@mdi/font/css/materialdesignicons.css'

let vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi
    }
  }
})

const app = createApp(App)



const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
app.use(router)
app.use(vuetify)
app.use(VueApexCharts)
app.use(ElementPlus);
app.use(PDFPlugin);

const urlParams = new URLSearchParams(window.location.search)
const redirectPath = urlParams.get('redirect')

if (redirectPath) {
  router.push(redirectPath).catch(() => {})
}

app.mount('#app')

AOS.init()




