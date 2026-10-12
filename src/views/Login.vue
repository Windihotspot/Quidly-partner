<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import AOS from 'aos'
import 'aos/dist/aos.css'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const form = ref()

const emailRules = [
  (v: string) => !!v?.trim() || 'Email address is required',
  (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Enter a valid email address'
]

const passwordRules = [(v: string) => !!v || 'Password is required']

onMounted(() => {
  AOS.init({
    duration: 750,
    easing: 'ease-out-cubic',
    once: true,
    offset: 35,
    delay: 50
  })
})

onBeforeUnmount(() => {
  AOS.refresh()
})

async function handleLogin() {
  if (authStore.loading) return

  const { valid } = await form.value.validate()
  if (!valid) return

  try {
    await authStore.login(email.value.trim(), password.value)
    const redirect = router.currentRoute.value.query.redirect

    router.replace(typeof redirect === 'string' ? redirect : '/dashboard')
  } catch {
    // The auth store handles the login error.
  }
}
</script>

<template>
  <main class="login-screen">
    <!-- Left: Login form -->
    <section class="login-panel">
      <div class="login-content">
        <header class="" data-aos="fade-down">
          <router-link to="/" class="" aria-label="Quidly home">
            <img src="@/assets/quidly-logo.png" alt="Quidly logo" class="w-20" />
          </router-link>
        </header>

        <div class="form-heading" data-aos="fade-up" data-aos-delay="80">
          <div class="eyebrow">
            <span class="eyebrow-dot"></span>
            PARTNER PORTAL
          </div>

          <h1>Welcome back.</h1>

          <p>Sign in to manage your events, monitor ticket sales, and keep your business moving.</p>
        </div>

        <v-form ref="form" class="login-form" @submit.prevent="handleLogin">
          <div class="field-group" data-aos="fade-up" data-aos-delay="100">
            <label for="login-email" class="field-label"> Email address </label>

            <v-text-field
              id="login-email"
              v-model="email"
              type="email"
              placeholder="you@company.com"
              prepend-inner-icon="mdi-email-outline"
              variant="outlined"
              density="comfortable"
              :rules="emailRules"
              autocomplete="username"
              hide-details="auto"
              class="login-field"
            />
          </div>

          <div class="field-group password-group" data-aos="fade-up" data-aos-delay="160">
            <div class="password-label-row">
              <label for="login-password" class="field-label"> Password </label>

              <router-link to="/forgot-password" class="forgot-link">
                Forgot password?
              </router-link>
            </div>

            <v-text-field
              id="login-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter your password"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              variant="outlined"
              density="comfortable"
              :rules="passwordRules"
              autocomplete="current-password"
              hide-details="auto"
              class="login-field"
              @click:append-inner="showPassword = !showPassword"
            />
          </div>

          <v-alert
            v-if="authStore.error"
            type="error"
            variant="tonal"
            density="comfortable"
            rounded="lg"
            class="feedback-alert"
          >
            {{ authStore.error }}
          </v-alert>

          <v-btn
            type="submit"
            block
            size="large"
            class="login-button"
            :loading="authStore.loading"
            :disabled="authStore.loading"
            elevation="0"
          >
            <span>Sign in to your account</span>

            <v-icon
              v-if="!authStore.loading"
              icon="mdi-arrow-right"
              size="20"
              class="button-icon"
            />
          </v-btn>

          <div class="signup-prompt" data-aos="fade-up" data-aos-delay="240">
            <span>New to Quidly?</span>

            <router-link to="/register" class="signup-link">
              Create an account
              <v-icon icon="mdi-arrow-up-right" size="15" />
            </router-link>
          </div>
        </v-form>

        <footer class="login-footer">
          <v-icon icon="mdi-shield-check-outline" size="16" />
          <span>Your account and business information are protected.</span>
        </footer>
      </div>
    </section>

    <!-- Right: Quidly product showcase -->
    <aside class="hero-panel">
      <div class="hero-background-shape shape-one"></div>
      <div class="hero-background-shape shape-two"></div>

      <header class="hero-topbar" data-aos="fade-down">
        <div class="secure-indicator">
          <span></span>
          Your business, in one place
        </div>
      </header>

      <div class="hero-copy" data-aos="fade-up" data-aos-delay="100">
        <span class="hero-kicker">
          <v-icon icon="mdi-sparkles" size="17" />
          YOUR EVENTS. YOUR GROWTH.
        </span>

        <h2>
          Good to have you
          <span>back in the game.</span>
        </h2>

        <p>
          Your events, ticket sales, transactions, and business insights are just a sign-in away.
        </p>
      </div>

      <div class="hero-illustration" data-aos="zoom-in" data-aos-delay="180">
        <img
          src="@/assets/events-ticketing.png"
          alt="Event management, digital ticketing, secure payments and sales analytics on Quidly"
          class="hero-image"
        />

        <div class="floating-card event-float">
          <div class="float-icon event-icon">
            <v-icon icon="mdi-calendar-check-outline" size="22" />
          </div>

          <div>
            <strong>Your events</strong>
            <span>Everything organized</span>
          </div>
        </div>

        <div class="floating-card payment-float">
          <div class="float-icon payment-icon">
            <v-icon icon="mdi-shield-check-outline" size="22" />
          </div>

          <div>
            <strong>Payment tracking</strong>
            <span>Stay on top of transactions</span>
          </div>

          <v-icon icon="mdi-check-circle" color="#10b981" size="19" />
        </div>
      </div>

      <div class="hero-benefits" data-aos="fade-up" data-aos-delay="240">
        <div class="benefit-item">
          <div class="benefit-icon">
            <v-icon icon="mdi-ticket-outline" size="21" />
          </div>

          <div>
            <strong>Easy ticketing</strong>
            <span>Manage your sales</span>
          </div>
        </div>

        <div class="benefit-divider"></div>

        <div class="benefit-item">
          <div class="benefit-icon green-benefit">
            <v-icon icon="mdi-chart-box-outline" size="21" />
          </div>

          <div>
            <strong>Business insights</strong>
            <span>Make informed decisions</span>
          </div>
        </div>
      </div>

      <footer class="hero-bottom">
        <span>MADE FOR EVENT PROFESSIONALS</span>
        <span class="hero-bottom-dot"></span>
        <span>POWERED BY QUIDLY</span>
      </footer>
    </aside>
  </main>
</template>

<style scoped>
.login-screen {
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

/* Login form */

.login-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 48px;
  background: #fff;
}

.login-content {
  width: 100%;
  max-width: 430px;
  margin: auto;
}

.brand-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: clamp(42px, 8vh, 76px);
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  border-radius: 13px;
  background: linear-gradient(145deg, #3b82f6, #1d4ed8);
  color: #fff;
  box-shadow: 0 7px 17px rgb(37 99 235 / 20%);
  text-decoration: none;
  transition: transform 0.2s ease;
}

.brand-mark:hover {
  transform: translateY(-2px);
}

.brand-name {
  color: #111c36;
  font-size: 25px;
  font-weight: 800;
  letter-spacing: -1.1px;
}

.brand-name > span {
  color: var(--quidly-blue);
}

.form-heading {
  margin-bottom: 35px;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 15px;
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
  font-size: clamp(32px, 3vw, 39px);
  font-weight: 800;
  letter-spacing: -1.6px;
  line-height: 1.16;
}

.form-heading p {
  max-width: 365px;
  margin: 14px 0 0;
  color: #718096;
  font-size: 13px;
  line-height: 1.9;
}

.field-group {
  margin-bottom: 23px;
}

.password-group {
  margin-top: 27px;
}

.field-label {
  display: block;
  margin-bottom: 9px;
  color: #344158;
  font-size: 12px;
  font-weight: 650;
}

.password-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.login-field :deep(.v-field) {
  min-height: 49px;
  border-radius: 11px;
  background: #fff;
  font-size: 13px;
}

.login-field :deep(.v-field__outline) {
  --v-field-border-opacity: 1;
}

.login-field :deep(.v-field--variant-outlined .v-field__outline__start),
.login-field :deep(.v-field--variant-outlined .v-field__outline__end),
.login-field :deep(.v-field--variant-outlined .v-field__outline__notch) {
  border-color: #e0e7f0;
}

.login-field :deep(.v-field--focused .v-field__outline__start),
.login-field :deep(.v-field--focused .v-field__outline__end),
.login-field :deep(.v-field--focused .v-field__outline__notch) {
  border-color: #2563eb !important;
}

.login-field :deep(.v-field__prepend-inner > .v-icon) {
  color: #94a3b8;
  opacity: 1;
  font-size: 19px;
}

.login-field :deep(input::placeholder) {
  color: #a0acbd;
  opacity: 1;
}

.login-field :deep(.v-field__input) {
  min-height: 47px;
}

.forgot-link {
  color: #2563eb;
  font-size: 11px;
  font-weight: 650;
  text-decoration: none;
  white-space: nowrap;
}

.forgot-link:hover {
  text-decoration: underline;
}

.feedback-alert {
  margin: 16px 0;
  font-size: 12px;
}

.login-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 51px;
  margin-top: 30px;
  border-radius: 11px;
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

.login-button:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.04);
  box-shadow: 0 11px 25px rgb(37 99 235 / 24%);
}

.button-icon {
  margin-left: 10px;
  transition: transform 0.2s ease;
}

.login-button:hover .button-icon {
  transform: translateX(3px);
}

.signup-prompt {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 25px;
  color: #7b8799;
  font-size: 12px;
}

.signup-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #2563eb;
  font-weight: 750;
  text-decoration: none;
}

.signup-link:hover {
  text-decoration: underline;
}

.login-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 45px;
  padding-top: 19px;
  border-top: 1px solid #f0f2f6;
  color: #9aa5b5;
  font-size: 10px;
  line-height: 1.6;
  text-align: center;
}

.login-footer :deep(.v-icon) {
  flex-shrink: 0;
}

/* Product showcase */

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
  align-items: center;
  justify-content: space-between;
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
  align-items: center;
  justify-content: center;
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
  align-items: center;
  justify-content: center;
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

/* Animation */

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

/* Responsive */

@media (min-width: 1500px) {
  .login-panel {
    padding-right: 70px;
    padding-left: 70px;
  }

  .login-content {
    max-width: 445px;
  }

  .hero-panel {
    padding-right: 65px;
    padding-left: 65px;
  }
}

@media (max-width: 1100px) {
  .login-screen {
    grid-template-columns: minmax(400px, 0.95fr) minmax(0, 1.05fr);
  }

  .login-panel {
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
  .login-screen {
    display: block;
  }

  .login-panel {
    min-height: 100vh;
    padding: 30px 25px;
  }

  .login-content {
    max-width: 470px;
  }

  .brand-header {
    margin-bottom: 42px;
  }

  .login-footer {
    margin-top: 35px;
  }

  .hero-panel {
    display: none;
  }
}

@media (max-width: 480px) {
  .login-panel {
    padding: 22px 20px 28px;
  }

  .brand-header {
    margin-bottom: 35px;
  }

  .form-heading h1 {
    font-size: 32px;
  }

  .form-heading p {
    font-size: 12px;
  }

  .field-group {
    margin-bottom: 20px;
  }

  .password-group {
    margin-top: 24px;
  }

  .login-button {
    margin-top: 25px;
  }

  .login-footer {
    margin-top: 32px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-image,
  .floating-card {
    animation: none;
  }

  .brand-mark,
  .login-button,
  .button-icon {
    transition: none;
  }
}
</style>
