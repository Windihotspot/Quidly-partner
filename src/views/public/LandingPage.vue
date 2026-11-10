<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import AOS from 'aos'
import 'aos/dist/aos.css'

const menuOpen = ref(false)
const scrolled = ref(false)
const openFaq = ref<number | null>(0)
const yearly = ref(false)

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' }
]

const stats = [
  { value: '10K+', label: 'Tickets sold', icon: 'fa-ticket' },
  { value: '500+', label: 'Events hosted', icon: 'fa-calendar-check' },
  { value: '₦2B+', label: 'Payments tracked', icon: 'fa-naira-sign' },
  { value: '99.9%', label: 'Platform uptime', icon: 'fa-bolt' }
]

const features = [
  { icon: 'fa-calendar-plus', title: 'Create events in minutes', text: 'Set up dates, venues, ticket tiers and images from one simple form, then publish.', tone: 'blue' },
  { icon: 'fa-ticket', title: 'Digital ticketing', text: 'Sell tickets online and send each buyer a unique QR ticket straight to their phone.', tone: 'blue' },
  { icon: 'fa-shield-halved', title: 'Secure payments', text: 'Every transaction is protected and tracked, so you always know what has been paid.', tone: 'green' },
  { icon: 'fa-chart-line', title: 'Live sales analytics', text: 'Watch sales, revenue and attendance as they happen and spot what is working.', tone: 'blue' },
  { icon: 'fa-qrcode', title: 'Fast entry check-in', text: 'Scan tickets at the door with any phone. Duplicate and fake tickets are rejected.', tone: 'green' },
  { icon: 'fa-users', title: 'Attendee management', text: 'See who bought, who attended and export your guest list whenever you need it.', tone: 'blue' }
]

const steps = [
  { icon: 'fa-user-plus', title: 'Create your partner account', text: 'Tell us about your business and secure your account in under two minutes.' },
  { icon: 'fa-calendar-plus', title: 'Publish your event', text: 'Add event details and ticket types, then share your event link anywhere.' },
  { icon: 'fa-ticket', title: 'Sell tickets', text: 'Buyers pay online and get their QR tickets instantly.' },
  { icon: 'fa-wallet', title: 'Track and get paid', text: 'Monitor every transaction and follow your earnings from your dashboard.' }
]

const plans = [
  { name: 'Starter', monthly: 'Free', yearly: 'Free', note: 'For your first events', perks: ['Unlimited free events', 'QR ticketing', 'Basic sales reports', 'Email support'], featured: false },
  { name: 'Growth', monthly: '₦15,000', yearly: '₦150,000', note: 'For growing organisers', perks: ['Everything in Starter', 'Advanced analytics', 'Team access', 'Priority support', 'Attendee exports'], featured: true },
  { name: 'Business', monthly: 'Custom', yearly: 'Custom', note: 'For large event companies', perks: ['Everything in Growth', 'Dedicated manager', 'Custom integrations', 'Onboarding help'], featured: false }
]

const testimonials = [
  { name: 'Adaeze Okafor', role: 'Founder, Lagos Live Nights', text: 'We moved all our ticket sales to Quidly and finally know our numbers in real time. Check-in at the door is now painless.' },
  { name: 'Tunde Bakare', role: 'Director, Bakare Conferences', text: 'Payment tracking used to take us a whole afternoon. Now it is one screen, and it is always up to date.' },
  { name: 'Chioma Eze', role: 'Owner, Spark Festivals', text: 'Setting up an event took minutes. Our attendees loved getting their tickets on their phones straight away.' }
]

const faqs = [
  { q: 'Who can become a Quidly partner?', a: 'Any event organiser, promoter, venue or business that sells tickets. Create an account, add your business details and you can start right away.' },
  { q: 'How do I receive my money?', a: 'Ticket payments are tracked in your dashboard. You can follow every transaction and see what has been settled to you.' },
  { q: 'Can I manage more than one event?', a: 'Yes. Run as many events as you like from one account and compare their performance side by side.' },
  { q: 'How does ticket check-in work?', a: 'Each ticket has a unique QR code. Scan it at the entrance with a phone and the ticket is marked as used.' },
  { q: 'Is my business information safe?', a: 'Your account and business data are protected, and payments are processed securely.' }
]

const footerCols = [
  { title: 'Product', links: ['Features', 'Pricing', 'How it works', 'FAQ'] },
  { title: 'Company', links: ['About', 'Contact', 'Careers', 'Blog'] },
  { title: 'Legal', links: ['Terms of service', 'Privacy policy', 'Refund policy'] }
]

function onScroll() {
  scrolled.value = window.scrollY > 12
}

onMounted(() => {
  AOS.init({ duration: 800, easing: 'ease-out-cubic', once: true, offset: 40 })
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div class="min-h-screen bg-white text-[#101b36] antialiased scroll-smooth">
    <!-- NAVBAR -->
    <header
      class="fixed inset-x-0 top-0 z-50 transition-all duration-300"
      :class="scrolled ? 'bg-white/85 backdrop-blur-xl shadow-[0_1px_0_#e6ebf3]' : 'bg-transparent'"
      data-aos="fade-down"
    >
      <nav class="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <router-link to="/" aria-label="Quidly home">
          <img src="@/assets/quidly-logo.png" alt="Quidly logo" class="w-20" />
        </router-link>

        <ul class="hidden items-center gap-9 md:flex">
          <li v-for="l in navLinks" :key="l.href">
            <a :href="l.href" class="text-sm font-semibold text-[#475569] transition hover:text-[#2563eb]">{{ l.label }}</a>
          </li>
        </ul>

        <div class="hidden items-center gap-3 md:flex">
          <router-link to="/login" class="rounded-xl px-4 py-2.5 text-sm font-bold text-[#101b36] transition hover:bg-[#eff6ff]">Sign in</router-link>
          <router-link
            to="/register"
            class="rounded-xl bg-gradient-to-r from-[#3478f6] to-[#2459df] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgb(37_99_235/0.25)] transition hover:-translate-y-0.5"
          >
            Become a partner
          </router-link>
        </div>

        <button
          class="grid h-10 w-10 place-items-center rounded-xl border border-[#e6ebf3] text-[#101b36] md:hidden"
          aria-label="Toggle menu"
          @click="menuOpen = !menuOpen"
        >
          <i class="fa-solid" :class="menuOpen ? 'fa-xmark' : 'fa-bars'"></i>
        </button>
      </nav>

      <Transition
        enter-active-class="transition duration-200"
        enter-from-class="opacity-0 -translate-y-2"
        leave-active-class="transition duration-150"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="menuOpen" class="border-t border-[#e6ebf3] bg-white px-5 pb-6 pt-3 md:hidden">
          <a v-for="l in navLinks" :key="l.href" :href="l.href" class="block py-3 text-sm font-semibold text-[#475569]" @click="menuOpen = false">{{ l.label }}</a>
          <div class="mt-3 grid gap-2">
            <router-link to="/login" class="rounded-xl border border-[#e6ebf3] py-3 text-center text-sm font-bold">Sign in</router-link>
            <router-link to="/register" class="rounded-xl bg-[#2563eb] py-3 text-center text-sm font-bold text-white">Become a partner</router-link>
          </div>
        </div>
      </Transition>
    </header>

    <main>
      <!-- HERO -->
      <section class="relative overflow-hidden bg-gradient-to-br from-[#f5f8ff] via-[#f7faff] to-[#f0f5ff] pt-32 pb-20 lg:pt-40">
        <div class="pointer-events-none absolute -right-40 top-20 h-[440px] w-[440px] rounded-full border border-[#2563eb]/10"></div>
        <div class="pointer-events-none absolute -right-24 top-32 h-[340px] w-[340px] rounded-full border border-[#2563eb]/10"></div>
        <div class="pointer-events-none absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-[#10b981]/10 blur-3xl"></div>
        <div class="pointer-events-none absolute right-1/4 top-10 h-80 w-80 rounded-full bg-[#2563eb]/10 blur-3xl"></div>

        <div class="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div class="mx-auto max-w-3xl text-center">
            <div data-aos="fade-down" class="inline-flex items-center gap-2 rounded-full border border-[#dce7ff] bg-white px-4 py-2 text-xs font-bold tracking-wide text-[#3569cb] shadow-sm">
              <span class="h-2 w-2 rounded-full bg-[#10b981] shadow-[0_0_0_4px_rgb(16_185_129/0.15)]"></span>
              Built for event professionals
            </div>

            <h1 data-aos="fade-up" data-aos-delay="100" class="mt-6 text-4xl font-extrabold leading-[1.1] tracking-[-0.04em] sm:text-5xl lg:text-7xl">
              Everything you need to
              <span class="bg-gradient-to-r from-[#2563eb] to-[#3b82f6] bg-clip-text text-transparent">make it happen.</span>
            </h1>

            <p data-aos="fade-up" data-aos-delay="200" class="mx-auto mt-6 max-w-xl text-base leading-8 text-[#718096] sm:text-lg">
              From event creation to ticket sales and payment tracking, Quidly brings your whole event business together in one place.
            </p>

            <div data-aos="fade-up" data-aos-delay="300" class="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <router-link
                to="/register"
                class="group inline-flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#3478f6] to-[#2459df] px-7 py-4 text-sm font-bold text-white shadow-[0_10px_25px_rgb(37_99_235/0.28)] transition hover:-translate-y-0.5 sm:w-auto"
              >
                Create partner account
                <i class="fa-solid fa-arrow-right transition group-hover:translate-x-1"></i>
              </router-link>
              <a href="#how" class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#e0e7f0] bg-white px-7 py-4 text-sm font-bold transition hover:border-[#2563eb] hover:text-[#2563eb] sm:w-auto">
                <i class="fa-regular fa-circle-play"></i> See how it works
              </a>
            </div>

            <p data-aos="fade-up" data-aos-delay="400" class="mt-5 text-xs text-[#94a3b8]">
              <i class="fa-solid fa-shield-halved mr-1 text-[#10b981]"></i> Free to start. No card required.
            </p>
          </div>

          <!-- Hero visual -->
          <div class="relative mx-auto mt-16 max-w-4xl" data-aos="zoom-in" data-aos-delay="200" data-aos-duration="1000">
            <div class="rounded-3xl border border-white bg-white/70 p-3 shadow-[0_30px_80px_rgb(36_63_113/0.12)] backdrop-blur">
              <img src="@/assets/events-ticketing.png" alt="Event management, digital ticketing, secure payments and sales analytics on Quidly" class="w-full rounded-2xl object-contain animate-[float_6s_ease-in-out_infinite]" />
            </div>

            <div class="absolute -left-3 top-10 hidden items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white/95 px-4 py-3 shadow-xl backdrop-blur sm:flex animate-[float_5s_ease-in-out_infinite]" data-aos="fade-right" data-aos-delay="600">
              <span class="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ff] text-[#2563eb]"><i class="fa-regular fa-calendar-check"></i></span>
              <div>
                <p class="text-xs font-bold">Create events</p>
                <p class="mt-0.5 text-[11px] text-[#8a95a7]">Bring your vision to life</p>
              </div>
            </div>

            <div class="absolute -right-3 bottom-10 hidden items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white/95 px-4 py-3 shadow-xl backdrop-blur sm:flex animate-[float_5s_ease-in-out_-2.5s_infinite]" data-aos="fade-left" data-aos-delay="700">
              <span class="grid h-10 w-10 place-items-center rounded-xl bg-[#e6faf2] text-[#059669]"><i class="fa-solid fa-shield-halved"></i></span>
              <div>
                <p class="text-xs font-bold">Secure payments</p>
                <p class="mt-0.5 text-[11px] text-[#8a95a7]">Track your transactions</p>
              </div>
              <i class="fa-solid fa-circle-check text-[#10b981]"></i>
            </div>
          </div>
        </div>
      </section>

      <!-- STATS -->
      <!-- <section class="border-y border-[#e6ebf3] bg-white py-12">
        <div class="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 lg:grid-cols-4 lg:px-8">
          <div v-for="(s, i) in stats" :key="s.label" class="text-center" data-aos="fade-up" :data-aos-delay="i * 100">
            <span class="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb]"><i class="fa-solid" :class="s.icon"></i></span>
            <p class="text-3xl font-extrabold tracking-tight lg:text-4xl">{{ s.value }}</p>
            <p class="mt-1 text-sm text-[#718096]">{{ s.label }}</p>
          </div>
        </div>
      </section> -->

      <!-- FEATURES -->
      <section id="features" class="scroll-mt-20 bg-white py-24">
        <div class="mx-auto max-w-7xl px-5 lg:px-8">
          <div class="mx-auto max-w-2xl text-center" data-aos="fade-up">
            <p class="text-xs font-extrabold tracking-[0.15em] text-[#2563eb]">FEATURES</p>
            <h2 class="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">One platform for your whole event business</h2>
            <p class="mt-4 leading-8 text-[#718096]">Sell tickets, get paid and understand your audience without juggling different tools.</p>
          </div>

          <div class="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <article
              v-for="(f, i) in features"
              :key="f.title"
              class="group rounded-3xl border border-[#e6ebf3] bg-white p-7 transition duration-300 hover:-translate-y-1.5 hover:border-[#bfd3ff] hover:shadow-[0_20px_50px_rgb(37_99_235/0.10)]"
              data-aos="fade-up"
              :data-aos-delay="(i % 3) * 120"
            >
              <span
                class="grid h-12 w-12 place-items-center rounded-2xl text-lg transition group-hover:scale-110"
                :class="f.tone === 'green' ? 'bg-[#e4f9f0] text-[#079669]' : 'bg-[#eaf1ff] text-[#2563eb]'"
              >
                <i class="fa-solid" :class="f.icon"></i>
              </span>
              <h3 class="mt-5 text-lg font-bold">{{ f.title }}</h3>
              <p class="mt-2 text-sm leading-7 text-[#718096]">{{ f.text }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- HOW IT WORKS -->
      <section id="how" class="scroll-mt-20 bg-gradient-to-br from-[#f5f8ff] to-[#f0f5ff] py-24">
        <div class="mx-auto max-w-7xl px-5 lg:px-8">
          <div class="mx-auto max-w-2xl text-center" data-aos="fade-up">
            <p class="text-xs font-extrabold tracking-[0.15em] text-[#2563eb]">HOW IT WORKS</p>
            <h2 class="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">From sign-up to sold out in four steps</h2>
          </div>

          <div class="relative mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <div class="absolute left-[12%] right-[12%] top-8 hidden border-t-2 border-dashed border-[#bfd3ff] lg:block"></div>
            <div v-for="(s, i) in steps" :key="s.title" class="relative text-center" data-aos="fade-up" :data-aos-delay="i * 150">
              <div class="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-xl text-white shadow-[0_10px_24px_rgb(37_99_235/0.3)]">
                <i class="fa-solid" :class="s.icon"></i>
                <span class="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[#10b981] text-xs font-bold text-white">{{ i + 1 }}</span>
              </div>
              <h3 class="mt-6 text-lg font-bold">{{ s.title }}</h3>
              <p class="mx-auto mt-2 max-w-xs text-sm leading-7 text-[#718096]">{{ s.text }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- PAYMENTS / SECURITY SPLIT -->
      <section class="bg-white py-24">
        <div class="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-8">
          <div data-aos="fade-right">
            <p class="text-xs font-extrabold tracking-[0.15em] text-[#059669]">PAYMENTS & INSIGHTS</p>
            <h2 class="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Know where every naira comes from</h2>
            <p class="mt-4 leading-8 text-[#718096]">Follow ticket sales and transactions as they happen, and make decisions with real numbers instead of guesses.</p>
            <ul class="mt-8 space-y-4">
              <li v-for="p in ['Real-time sales dashboard', 'Transaction history for every event', 'Secure, protected payments', 'Exportable attendee and revenue reports']" :key="p" class="flex items-center gap-3 text-sm font-semibold">
                <span class="grid h-6 w-6 place-items-center rounded-full bg-[#e4f9f0] text-xs text-[#079669]"><i class="fa-solid fa-check"></i></span>
                {{ p }}
              </li>
            </ul>
            <router-link to="/register" class="mt-9 inline-flex items-center gap-2 text-sm font-bold text-[#2563eb] hover:underline">
              Start selling tickets <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
            </router-link>
          </div>

          <div class="relative" data-aos="fade-left" data-aos-delay="150">
            <div class="rounded-3xl border border-[#e6ebf3] bg-gradient-to-br from-[#f5f8ff] to-white p-6 shadow-[0_30px_70px_rgb(36_63_113/0.10)]">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-[#8a95a7]">Total revenue</p>
                  <p class="text-3xl font-extrabold tracking-tight">₦4,820,500</p>
                </div>
                <span class="rounded-full bg-[#e4f9f0] px-3 py-1 text-xs font-bold text-[#079669]"><i class="fa-solid fa-arrow-trend-up mr-1"></i>+24%</span>
              </div>
              <div class="mt-8 flex h-40 items-end gap-3">
                <div v-for="(h, i) in [35, 55, 42, 70, 60, 88, 100]" :key="i" class="flex-1 rounded-t-lg bg-gradient-to-t from-[#2563eb] to-[#60a5fa]" :style="{ height: h + '%' }" data-aos="fade-up" :data-aos-delay="200 + i * 80"></div>
              </div>
              <div class="mt-3 flex justify-between text-[11px] text-[#94a3b8]">
                <span v-for="d in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']" :key="d">{{ d }}</span>
              </div>
            </div>
            <div class="absolute -bottom-5 -left-3 flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-xl sm:-left-6 animate-[float_5s_ease-in-out_infinite]">
              <span class="grid h-10 w-10 place-items-center rounded-xl bg-[#e6faf2] text-[#059669]"><i class="fa-solid fa-ticket"></i></span>
              <div>
                <p class="text-xs font-bold">128 tickets sold</p>
                <p class="mt-0.5 text-[11px] text-[#8a95a7]">in the last 24 hours</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- PRICING -->
      <!-- <section id="pricing" class="scroll-mt-20 bg-gradient-to-br from-[#f5f8ff] to-[#f0f5ff] py-24">
        <div class="mx-auto max-w-7xl px-5 lg:px-8">
          <div class="mx-auto max-w-2xl text-center" data-aos="fade-up">
            <p class="text-xs font-extrabold tracking-[0.15em] text-[#2563eb]">PRICING</p>
            <h2 class="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">Simple plans that grow with you</h2>
            <div class="mx-auto mt-8 inline-flex rounded-full border border-[#dce7ff] bg-white p-1 text-sm font-bold">
              <button class="rounded-full px-5 py-2 transition" :class="!yearly ? 'bg-[#2563eb] text-white' : 'text-[#64748b]'" @click="yearly = false">Monthly</button>
              <button class="rounded-full px-5 py-2 transition" :class="yearly ? 'bg-[#2563eb] text-white' : 'text-[#64748b]'" @click="yearly = true">Yearly</button>
            </div>
          </div>

          <div class="mt-14 grid items-center gap-6 lg:grid-cols-3">
            <article
              v-for="(p, i) in plans"
              :key="p.name"
              class="relative rounded-3xl border p-8 transition duration-300 hover:-translate-y-1.5"
              :class="p.featured ? 'border-[#2563eb] bg-[#101b36] text-white shadow-[0_30px_70px_rgb(37_99_235/0.3)] lg:scale-105' : 'border-[#e6ebf3] bg-white'"
              data-aos="fade-up"
              :data-aos-delay="i * 130"
            >
              <span v-if="p.featured" class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#10b981] px-4 py-1 text-xs font-bold text-white">Most popular</span>
              <h3 class="text-lg font-bold">{{ p.name }}</h3>
              <p class="mt-1 text-sm" :class="p.featured ? 'text-[#94a3b8]' : 'text-[#718096]'">{{ p.note }}</p>
              <p class="mt-6 text-4xl font-extrabold tracking-tight">
                {{ yearly ? p.yearly : p.monthly }}
                <span v-if="p.monthly.startsWith('₦')" class="text-sm font-medium opacity-60">/{{ yearly ? 'year' : 'month' }}</span>
              </p>
              <ul class="mt-7 space-y-3">
                <li v-for="perk in p.perks" :key="perk" class="flex items-center gap-3 text-sm">
                  <i class="fa-solid fa-circle-check" :class="p.featured ? 'text-[#34d399]' : 'text-[#10b981]'"></i>{{ perk }}
                </li>
              </ul>
              <router-link
                to="/register"
                class="mt-8 block rounded-xl py-3.5 text-center text-sm font-bold transition"
                :class="p.featured ? 'bg-[#2563eb] text-white hover:bg-[#3b82f6]' : 'border border-[#e0e7f0] hover:border-[#2563eb] hover:text-[#2563eb]'"
              >
                {{ p.name === 'Business' ? 'Talk to us' : 'Get started' }}
              </router-link>
            </article>
          </div>
        </div>
      </section> -->

      <!-- TESTIMONIALS -->
      <section class="bg-white py-24">
        <div class="mx-auto max-w-7xl px-5 lg:px-8">
          <div class="mx-auto max-w-2xl text-center" data-aos="fade-up">
            <p class="text-xs font-extrabold tracking-[0.15em] text-[#2563eb]">LOVED BY ORGANISERS</p>
            <h2 class="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">Partners who made it happen</h2>
          </div>
          <div class="mt-14 grid gap-6 md:grid-cols-3">
            <figure v-for="(t, i) in testimonials" :key="t.name" class="rounded-3xl border border-[#e6ebf3] bg-[#fbfcff] p-7 transition hover:shadow-[0_20px_50px_rgb(37_99_235/0.08)]" data-aos="flip-up" :data-aos-delay="i * 120">
              <div class="flex gap-1 text-sm text-[#f59e0b]"><i v-for="n in 5" :key="n" class="fa-solid fa-star"></i></div>
              <blockquote class="mt-4 text-sm leading-7 text-[#475569]">{{ t.text }}</blockquote>
              <figcaption class="mt-6 flex items-center gap-3">
                <span class="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-sm font-bold text-white">{{ t.name.split(' ').map(n => n[0]).join('') }}</span>
                <div>
                  <p class="text-sm font-bold">{{ t.name }}</p>
                  <p class="text-xs text-[#8a95a7]">{{ t.role }}</p>
                </div>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <section id="faq" class="scroll-mt-20 bg-gradient-to-br from-[#f5f8ff] to-[#f0f5ff] py-24">
        <div class="mx-auto max-w-3xl px-5 lg:px-8">
          <div class="text-center" data-aos="fade-up">
            <p class="text-xs font-extrabold tracking-[0.15em] text-[#2563eb]">FAQ</p>
            <h2 class="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">Questions, answered</h2>
          </div>
          <div class="mt-12 space-y-3">
            <div v-for="(f, i) in faqs" :key="f.q" class="overflow-hidden rounded-2xl border border-[#e6ebf3] bg-white" data-aos="fade-up" :data-aos-delay="i * 80">
              <button class="flex w-full items-center justify-between gap-4 p-5 text-left text-sm font-bold sm:text-base" :aria-expanded="openFaq === i" @click="openFaq = openFaq === i ? null : i">
                {{ f.q }}
                <i class="fa-solid fa-chevron-down text-xs text-[#2563eb] transition-transform duration-300" :class="openFaq === i ? 'rotate-180' : ''"></i>
              </button>
              <div class="grid transition-all duration-300" :class="openFaq === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                <p class="overflow-hidden px-5 text-sm leading-7 text-[#718096]" :class="openFaq === i ? 'pb-5' : ''">{{ f.a }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="bg-white px-5 py-24 lg:px-8">
        <div class="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2563eb] via-[#1d4ed8] to-[#101b36] px-6 py-16 text-center text-white sm:py-20" data-aos="zoom-in">
          <div class="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10"></div>
          <div class="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-[#10b981]/20 blur-3xl"></div>
          <div class="relative">
            <h2 class="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">Good events deserve a good platform.</h2>
            <p class="mx-auto mt-5 max-w-xl leading-8 text-blue-100">Join Quidly today and start selling tickets, tracking payments and growing your event business.</p>
            <div class="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <router-link to="/register" class="group inline-flex items-center gap-3 rounded-xl bg-white px-8 py-4 text-sm font-bold text-[#1d4ed8] shadow-xl transition hover:-translate-y-0.5">
                Create partner account <i class="fa-solid fa-arrow-right transition group-hover:translate-x-1"></i>
              </router-link>
              <router-link to="/login" class="rounded-xl border border-white/30 px-8 py-4 text-sm font-bold transition hover:bg-white/10">I already have an account</router-link>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- FOOTER -->
    <footer class="border-t border-[#e6ebf3] bg-[#fbfcff]">
      <div class="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-[1.4fr_2fr] lg:px-8" data-aos="fade-up">
        <div>
          <img src="@/assets/quidly-logo.png" alt="Quidly logo" class="w-20" />
          <p class="mt-4 max-w-xs text-sm leading-7 text-[#718096]">Create events, sell tickets and track payments from one simple platform.</p>
          <div class="mt-6 flex gap-3">
            <a v-for="s in ['fa-x-twitter', 'fa-instagram', 'fa-linkedin-in', 'fa-facebook-f']" :key="s" href="#" class="grid h-10 w-10 place-items-center rounded-xl border border-[#e6ebf3] bg-white text-[#64748b] transition hover:-translate-y-0.5 hover:border-[#2563eb] hover:text-[#2563eb]" aria-label="Social link">
              <i class="fa-brands" :class="s"></i>
            </a>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div v-for="c in footerCols" :key="c.title">
            <h4 class="text-sm font-bold">{{ c.title }}</h4>
            <ul class="mt-4 space-y-3">
              <li v-for="l in c.links" :key="l"><a href="#" class="text-sm text-[#718096] transition hover:text-[#2563eb]">{{ l }}</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="border-t border-[#e6ebf3] py-6">
        <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 text-xs text-[#9aa5b5] sm:flex-row lg:px-8">
          <p>© {{ new Date().getFullYear() }} Quidly. All rights reserved.</p>
          <p><i class="fa-solid fa-shield-halved mr-1 text-[#10b981]"></i> Your account and business information are protected.</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
</style>