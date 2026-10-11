
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import AOS from 'aos'
import 'aos/dist/aos.css'

const router = useRouter()
const authStore = useAuthStore()

const businessName = ref('')
const contactName = ref('')
const email = ref('')
const phone = ref('')
const businessType = ref('')
const password = ref('')
const showPassword = ref(false)
const form = ref()
const successMessage = ref('')

let redirectTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  AOS.init({
    duration: 750,
    easing: 'ease-out-cubic',
    once: true,
    offset: 35,
    delay: 50,
  })
})

onBeforeUnmount(() => {
  if (redirectTimer) clearTimeout(redirectTimer)
})

const businessTypeOptions = [
  { title: 'Event Organizer', value: 'event_organizer' },
  { title: 'Venue', value: 'venue' },
  { title: 'Promoter', value: 'promoter' },
  { title: 'Other', value: 'other' },
]

const requiredRule = (v: string) =>
  !!v?.trim() || 'This field is required'

const businessNameRules = [
  requiredRule,
  (v: string) => v.trim().length >= 2 || 'Enter a valid business name',
]

const contactNameRules = [
  requiredRule,
  (v: string) => v.trim().length >= 2 || 'Enter your full name',
]

const emailRules = [
  requiredRule,
  (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ||
    'Enter a valid email address',
]

const phoneRules = [
  requiredRule,
  (v: string) =>
    /^[+()\d\s-]{7,20}$/.test(v) ||
    'Enter a valid phone number',
]

const businessTypeRules = [requiredRule]

const passwordRules = [
  requiredRule,
  (v: string) =>
    v.length >= 8 || 'Use at least 8 characters',
]

async function handleRegister() {
  successMessage.value = ''

  if (authStore.loading) return

  const { valid } = await form.value.validate()
  if (!valid) return

  const payload = {
    businessName: businessName.value.trim(),
    contactName: contactName.value.trim(),
    email: email.value.trim(),
    phone: phone.value.trim(),
    businessType: businessType.value,
    password: password.value,
  }

  try {
    const result = await authStore.register(payload)

    successMessage.value =
      result?.message ||
      'Account created successfully. You can now log in.'

    redirectTimer = setTimeout(() => {
      router.push('/')
    }, 2000)
  } catch {
    // The auth store handles the registration error.
  }
}
</script>

<template>
  <main class="register-screen">
    <!-- Registration panel -->
    <section class="register-panel">
      <div class="register-content">
        <header class="" data-aos="fade-down">
          <router-link
            to="/"
            class=""
            aria-label="Quidly home"
          >
             <img
          src="@/assets/quidly-logo.png"
          alt="Quidly logo"
          class="w-20"
        />

          </router-link>

          
        </header>

        <div class="form-heading" data-aos="fade-up" data-aos-delay="80">
          <div class="eyebrow">
            PARTNER ONBOARDING
          </div>

          <h1>Create your partner account</h1>

          <p>
            Bring your events to life. Manage ticket sales and payments
            from one simple platform.
          </p>
        </div>

        <v-form
          ref="form"
          class="register-form"
          @submit.prevent="handleRegister"
        >
          <div class="form-section-label" data-aos="fade-up">
            <span class="section-number">01</span>
            Business information
          </div>

          <div
            class="field-group"
            data-aos="fade-up"
            data-aos-delay="70"
          >
            <label for="business-name" class="field-label">
              Business name
            </label>

            <v-text-field
              id="business-name"
              v-model="businessName"
              placeholder="e.g. Acme Events Ltd"
              prepend-inner-icon="mdi-domain"
              variant="outlined"
              density="comfortable"
              :rules="businessNameRules"
              autocomplete="organization"
              hide-details="auto"
              class="register-field"
            />
          </div>

          <div
            class="field-group"
            data-aos="fade-up"
            data-aos-delay="110"
          >
            <label for="contact-name" class="field-label">
              Contact person's name
            </label>

            <v-text-field
              id="contact-name"
              v-model="contactName"
              placeholder="Enter your full name"
              prepend-inner-icon="mdi-account-outline"
              variant="outlined"
              density="comfortable"
              :rules="contactNameRules"
              autocomplete="name"
              hide-details="auto"
              class="register-field"
            />
          </div>

          <div
            class="field-group"
            data-aos="fade-up"
            data-aos-delay="150"
          >
            <label for="email" class="field-label">
              Business email address
            </label>

            <v-text-field
              id="email"
              v-model="email"
              placeholder="you@company.com"
              prepend-inner-icon="mdi-email-outline"
              type="email"
              variant="outlined"
              density="comfortable"
              :rules="emailRules"
              autocomplete="email"
              hide-details="auto"
              class="register-field"
            />
          </div>

          <div
            class="field-group"
            data-aos="fade-up"
            data-aos-delay="190"
          >
            <label for="phone" class="field-label">
              Phone number
            </label>

            <v-text-field
              id="phone"
              v-model="phone"
              placeholder="+234 800 000 0000"
              prepend-inner-icon="mdi-phone-outline"
              type="tel"
              variant="outlined"
              density="comfortable"
              :rules="phoneRules"
              autocomplete="tel"
              hide-details="auto"
              class="register-field"
            />
          </div>

          <div
            class="field-group"
            data-aos="fade-up"
            data-aos-delay="230"
          >
            <label for="business-type" class="field-label">
              What best describes your business?
            </label>

            <v-select
              id="business-type"
              v-model="businessType"
              :items="businessTypeOptions"
              item-title="title"
              item-value="value"
              placeholder="Select business type"
              prepend-inner-icon="mdi-briefcase-outline"
              variant="outlined"
              density="comfortable"
              :rules="businessTypeRules"
              hide-details="auto"
              class="register-field"
            />
          </div>

          <div class="form-section-label password-section" data-aos="fade-up">
            <span class="section-number">02</span>
            Secure your account
          </div>

          <div
            class="field-group"
            data-aos="fade-up"
            data-aos-delay="80"
          >
            <label for="password" class="field-label">
              Create a password
            </label>

            <v-text-field
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="At least 8 characters"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="
                showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'
              "
              variant="outlined"
              density="comfortable"
              :rules="passwordRules"
              autocomplete="new-password"
              hide-details="auto"
              class="register-field"
              @click:append-inner="showPassword = !showPassword"
            />

            <p class="field-hint">
              <v-icon icon="mdi-shield-check-outline" size="15" />
              Use at least 8 characters to protect your account.
            </p>
          </div>

          <v-alert
            v-if="authStore.error"
            type="error"
            variant="tonal"
            density="comfortable"
            rounded="lg"
            class="feedback-alert"
            closable
          >
            {{ authStore.error }}
          </v-alert>

          <v-alert
            v-if="successMessage"
            type="success"
            variant="tonal"
            density="comfortable"
            rounded="lg"
            class="feedback-alert"
          >
            {{ successMessage }}
          </v-alert>

          <v-btn
            type="submit"
            block
            size="large"
            class="register-button"
            :loading="authStore.loading"
            :disabled="!!successMessage"
            elevation="0"
          >
            <span>Create partner account</span>
            <v-icon
              v-if="!authStore.loading"
              icon="mdi-arrow-right"
              size="20"
              class="button-icon"
            />
          </v-btn>

          <p class="login-prompt">
            Already have an account?
            <router-link to="/" class="login-link">
              Log in
            </router-link>
          </p>
        </v-form>

        <footer class="form-footer">
          <v-icon icon="mdi-lock-check-outline" size="15" />
          Your information is handled securely.
        </footer>
      </div>
    </section>

    <!-- Visual / product value panel -->
    <aside class="hero-panel">
      <div class="hero-background-shape shape-one"></div>
      <div class="hero-background-shape shape-two"></div>

      <div class="hero-topbar" data-aos="fade-down">
        

        <div class="secure-indicator">
          <span></span>
          Built for your business
        </div>
      </div>

      <div class="hero-copy" data-aos="fade-up" data-aos-delay="100">
        <span class="hero-kicker">
          <v-icon icon="mdi-sparkles" size="17" />
          YOUR EVENTS. YOUR GROWTH.
        </span>

        <h2>
          Everything you need to
          <span>make it happen.</span>
        </h2>

        <p>
          From event creation to ticket sales and payment tracking,
          Quidly brings your event business together in one place.
        </p>
      </div>

      <div
        class="hero-illustration"
        data-aos="zoom-in"
        data-aos-delay="180"
      >
        <img
          src="@/assets/events-ticketing.png"
          alt="Quidly event creation, digital ticketing, secure payments and partner analytics"
          class="hero-image"
        />

        <div class="floating-card event-float">
          <div class="float-icon event-icon">
            <v-icon icon="mdi-calendar-check-outline" size="22" />
          </div>
          <div>
            <strong>Create events</strong>
            <span>Bring your vision to life</span>
          </div>
        </div>

        <div class="floating-card payment-float">
          <div class="float-icon payment-icon">
            <v-icon icon="mdi-shield-check-outline" size="22" />
          </div>
          <div>
            <strong>Secure payments</strong>
            <span>Track your transactions</span>
          </div>
          <v-icon
            icon="mdi-check-circle"
            color="#10b981"
            size="19"
          />
        </div>
      </div>

      <div class="hero-benefits" data-aos="fade-up" data-aos-delay="240">
        <div class="benefit-item">
          <div class="benefit-icon">
            <v-icon icon="mdi-ticket-outline" size="21" />
          </div>
          <div>
            <strong>Simple ticketing</strong>
            <span>Sell tickets with ease</span>
          </div>
        </div>

        <div class="benefit-divider"></div>

        <div class="benefit-item">
          <div class="benefit-icon green-benefit">
            <v-icon icon="mdi-chart-box-outline" size="21" />
          </div>
          <div>
            <strong>Clear insights</strong>
            <span>Stay on top of sales</span>
          </div>
        </div>
      </div>

      <div class="hero-bottom">
        <span>MADE FOR EVENT PROFESSIONALS</span>
        <span class="hero-bottom-dot"></span>
        <span>POWERED BY QUIDLY</span>
      </div>
    </aside>
  </main>
</template>

<style scoped>
.register-screen {
  --quidly-blue: #2563eb;
  --quidly-blue-dark: #1d4ed8;
  --quidly-navy: #101b36;
  --quidly-muted: #718096;
  --quidly-border: #e6ebf3;

  display: grid;
  grid-template-columns: minmax(460px, 0.92fr) minmax(0, 1.08fr);
  min-height: 100vh;
  background: #fff;
  color: var(--quidly-navy);
  font-family: inherit;
}

/* Registration area */

.register-panel {
  display: flex;
  justify-content: center;
  padding: 34px 48px 26px;
  background: #fff;
}

.register-content {
  width: 100%;
  max-width: 430px;
  margin: auto;
}

.brand-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 37px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  border-radius: 13px;
  color: #fff;
  background: linear-gradient(145deg, #3b82f6, #1d4ed8);
  box-shadow: 0 7px 17px rgb(37 99 235 / 20%);
  text-decoration: none;
  transition: transform 0.2s ease;
}

.brand-mark:hover {
  transform: translateY(-2px);
}

.brand-name {
  font-size: 25px;
  font-weight: 800;
  letter-spacing: -1.1px;
  color: #111c36;
}

.brand-name > span {
  color: var(--quidly-blue);
}

.form-heading {
  margin-bottom: 29px;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 13px;
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.45px;
}

.eyebrow-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2563eb;
  box-shadow: 0 0 0 4px #eff6ff;
}

.form-heading h1 {
  margin: 0;
  color: #111c36;
  font-size: clamp(28px, 2.2vw, 34px);
  font-weight: 750;
  letter-spacing: -1.25px;
  line-height: 1.18;
}

.form-heading p {
  max-width: 385px;
  margin: 12px 0 0;
  color: #718096;
  font-size: 13px;
  line-height: 1.8;
}

.form-section-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 17px;
  color: #24324b;
  font-size: 12px;
  font-weight: 750;
}

.section-number {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 10px;
  font-weight: 800;
}

.field-group {
  margin-bottom: 17px;
}

.field-label {
  display: block;
  margin-bottom: 7px;
  color: #344158;
  font-size: 12px;
  font-weight: 650;
}

.register-field :deep(.v-field) {
  min-height: 47px;
  border-radius: 10px;
  background: #fff;
  font-size: 13px;
}

.register-field :deep(.v-field__outline) {
  --v-field-border-opacity: 1;
}

.register-field :deep(.v-field--variant-outlined .v-field__outline__start),
.register-field :deep(.v-field--variant-outlined .v-field__outline__end),
.register-field :deep(.v-field--variant-outlined .v-field__outline__notch) {
  border-color: #e0e7f0;
}

.register-field :deep(.v-field--focused .v-field__outline__start),
.register-field :deep(.v-field--focused .v-field__outline__end),
.register-field :deep(.v-field--focused .v-field__outline__notch) {
  border-color: #2563eb !important;
}

.register-field :deep(.v-field__prepend-inner > .v-icon) {
  color: #94a3b8;
  opacity: 1;
  font-size: 19px;
}

.register-field :deep(input::placeholder),
.register-field :deep(.v-field__input input::placeholder) {
  color: #a0acbd;
  opacity: 1;
}

.register-field :deep(.v-field__input) {
  min-height: 45px;
}

.password-section {
  margin-top: 25px;
  margin-bottom: 16px;
}

.field-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 7px 0 0;
  color: #8793a5;
  font-size: 10px;
  line-height: 1.5;
}

.field-hint :deep(.v-icon) {
  color: #64748b;
}

.feedback-alert {
  margin-top: 15px;
  font-size: 12px;
}

.register-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 49px;
  margin-top: 25px;
  border-radius: 10px;
  background: linear-gradient(105deg, #3478f6 0%, #2459df 100%) !important;
  color: #fff !important;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  box-shadow: 0 8px 20px rgb(37 99 235 / 17%);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
}

.register-button:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.04);
  box-shadow: 0 11px 25px rgb(37 99 235 / 24%);
}

.button-icon {
  margin-left: 9px;
  transition: transform 0.2s ease;
}

.register-button:hover .button-icon {
  transform: translateX(3px);
}

.login-prompt {
  margin: 20px 0 0;
  color: #7b8799;
  text-align: center;
  font-size: 12px;
}

.login-link {
  margin-left: 3px;
  color: #2563eb;
  font-weight: 750;
  text-decoration: none;
}

.login-link:hover {
  text-decoration: underline;
}

.form-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  margin-top: 27px;
  padding-top: 17px;
  border-top: 1px solid #f0f2f6;
  color: #9aa5b5;
  font-size: 10px;
}

/* Right-hand hero area */

.hero-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 100%;
  padding: 34px clamp(26px, 4vw, 60px) 25px;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(ellipse at 70% 35%, rgb(42 101 222 / 12%), transparent 42%),
    radial-gradient(ellipse at 25% 85%, rgb(16 185 129 / 8%), transparent 36%),
    linear-gradient(145deg, #f5f8ff 0%, #f7faff 46%, #f0f5ff 100%);
}

.hero-background-shape {
  position: absolute;
  z-index: -1;
  pointer-events: none;
  border: 1px solid rgb(37 99 235 / 7%);
  border-radius: 50%;
}

.shape-one {
  top: 17%;
  right: -140px;
  width: 440px;
  height: 440px;
}

.shape-two {
  top: 22%;
  right: -90px;
  width: 340px;
  height: 340px;
}

.hero-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.hero-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #152440;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.65px;
}

.hero-brand-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #e1ebff;
  color: #2563eb;
}

.hero-brand-dot {
  color: #2563eb;
}

.partner-pill {
  margin-left: 2px;
  padding: 5px 8px;
  border: 1px solid #dce7ff;
  border-radius: 6px;
  background: #edf3ff;
  color: #456bb5;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1px;
}

.secure-indicator {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #7b879a;
  font-size: 10px;
  font-weight: 550;
}

.secure-indicator > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 4px rgb(16 185 129 / 10%);
}

.hero-copy {
  max-width: 480px;
  margin: clamp(35px, 5vh, 58px) auto 0;
  text-align: center;
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #3569cb;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.25px;
}

.hero-copy h2 {
  margin: 15px 0 12px;
  color: #15223d;
  font-size: clamp(29px, 3vw, 43px);
  font-weight: 800;
  letter-spacing: -1.8px;
  line-height: 1.13;
}

.hero-copy h2 > span {
  display: block;
  color: #2563eb;
}

.hero-copy p {
  max-width: 390px;
  margin: 0 auto;
  color: #77849a;
  font-size: 12px;
  line-height: 1.9;
}

.hero-illustration {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
  max-width: 680px;
  min-height: 300px;
  margin: 5px auto 0;
}

.hero-image {
  display: block;
  width: 100%;
  max-width: 660px;
  max-height: 490px;
  object-fit: contain;
  filter: drop-shadow(0 16px 24px rgb(42 76 140 / 5%));
  animation: hero-float 6s ease-in-out infinite;
}

.floating-card {
  position: absolute;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgb(226 232 240 / 85%);
  border-radius: 13px;
  background: rgb(255 255 255 / 95%);
  box-shadow: 0 12px 32px rgb(36 63 113 / 10%);
  backdrop-filter: blur(12px);
  animation: card-float 5s ease-in-out infinite;
}

.floating-card strong,
.floating-card span {
  display: block;
  white-space: nowrap;
}

.floating-card strong {
  color: #25334c;
  font-size: 10px;
  font-weight: 750;
}

.floating-card div > span {
  margin-top: 4px;
  color: #8a95a7;
  font-size: 9px;
}

.float-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 11px;
}

.event-icon {
  background: #edf3ff;
  color: #2563eb;
}

.payment-icon {
  background: #e6faf2;
  color: #059669;
}

.event-float {
  top: 16%;
  left: 0;
}

.payment-float {
  right: 0;
  bottom: 16%;
  animation-delay: -2.5s;
}

.hero-benefits {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: clamp(16px, 3vw, 38px);
  width: 100%;
  max-width: 480px;
  margin: 5px auto 0;
  padding: 19px 0;
  border-top: 1px solid rgb(218 227 242 / 90%);
}

.benefit-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.benefit-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 39px;
  height: 39px;
  border: 1px solid #dce8ff;
  border-radius: 11px;
  background: #eaf1ff;
  color: #2563eb;
}

.green-benefit {
  border-color: #d3f4e7;
  background: #e4f9f0;
  color: #079669;
}

.benefit-item strong,
.benefit-item span {
  display: block;
  white-space: nowrap;
}

.benefit-item strong {
  color: #2d3a52;
  font-size: 10px;
  font-weight: 750;
}

.benefit-item span {
  margin-top: 5px;
  color: #8a95a7;
  font-size: 9px;
}

.benefit-divider {
  width: 1px;
  height: 34px;
  background: #dce4f0;
}

.hero-bottom {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  padding-top: 13px;
  border-top: 1px solid rgb(218 227 242 / 90%);
  color: #9aa5b7;
  font-size: 8px;
  font-weight: 750;
  letter-spacing: 1px;
}

.hero-bottom-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #5c88dd;
}

/* Motion */

@keyframes hero-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8px);
  }
}

@keyframes card-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-6px);
  }
}

/* Responsive layout */

@media (min-width: 1500px) {
  .register-panel {
    padding-right: 70px;
    padding-left: 70px;
  }

  .register-content {
    max-width: 445px;
  }

  .hero-panel {
    padding-right: 65px;
    padding-left: 65px;
  }
}

@media (max-width: 1100px) {
  .register-screen {
    grid-template-columns: minmax(400px, 0.95fr) minmax(0, 1.05fr);
  }

  .register-panel {
    padding-right: 30px;
    padding-left: 30px;
  }

  .hero-panel {
    padding-right: 25px;
    padding-left: 25px;
  }

  .floating-card {
    padding: 9px 10px;
  }

  .event-float {
    left: -5px;
  }

  .payment-float {
    right: -5px;
  }
}

@media (max-width: 900px) {
  .register-screen {
    display: block;
  }

  .register-panel {
    min-height: 100vh;
    padding: 28px 25px;
  }

  .register-content {
    max-width: 470px;
  }

  .brand-header {
    margin-bottom: 34px;
  }

  .hero-panel {
    display: none;
  }
}

@media (max-width: 480px) {
  .register-panel {
    padding: 22px 20px 26px;
  }

  .brand-header {
    margin-bottom: 31px;
  }

  .form-heading h1 {
    font-size: 29px;
  }

  .form-heading p {
    font-size: 12px;
  }

  .field-group {
    margin-bottom: 15px;
  }

  .password-section {
    margin-top: 22px;
  }

  .register-button {
    margin-top: 21px;
  }
}

/* Accessibility: respect reduced-motion preferences */

@media (prefers-reduced-motion: reduce) {
  .hero-image,
  .floating-card {
    animation: none;
  }

  .brand-mark,
  .register-button,
  .button-icon {
    transition: none;
  }
}
</style>
