/**
 * Public Landing Page Component
 */

import { openLoginModal, openSignupModal } from './authModals.js';
import { state } from '../state.js';

export function renderLandingPage(container) {
  container.innerHTML = `
    <div style="background-color: var(--bg-main); min-height: 100vh;">
      <!-- Header -->
      <header class="landing-header">
        <div class="container" style="display: flex; align-items: center; justify-content: space-between;">
          <a href="#" class="brand-logo" style="margin-bottom: 0;">
            <div class="brand-icon">⏰</div>
            <div>
              <span>SMARTTIME</span>
              <span style="color: var(--primary-purple); font-size: 0.8em; margin-left: 3px;">AI</span>
            </div>
          </a>

          <nav style="display: flex; gap: 2rem; align-items: center;" class="desktop-only">
            <a href="#how-it-works" style="font-weight: 500; color: var(--text-secondary);">How It Works</a>
            <a href="#features" style="font-weight: 500; color: var(--text-secondary);">Features</a>
            <a href="#students-teachers" style="font-weight: 500; color: var(--text-secondary);">For Students & Teachers</a>
          </nav>

          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <button id="landing-login-btn" class="btn btn-outline">
              Login
            </button>
            <button id="landing-get-started-btn" class="btn btn-primary">
              Get Started Free ➔
            </button>
          </div>
        </div>
      </header>

      <!-- Hero Section -->
      <section class="landing-hero">
        <div class="container">
          <div class="hero-tag">
            <span>✨ AI-Powered Timetable & Schedule Assistant</span>
          </div>

          <h1 class="hero-title">
            Turn Your Timetable Into a <span class="gradient-text">Smart Schedule</span>.
          </h1>

          <p class="hero-subtitle">
            Upload your timetable photo, speak your classes naturally, or enter manually.
            SmartTime AI automatically organizes your calendar and reminds you before every class.
          </p>

          <div class="hero-actions">
            <button id="hero-cta-btn" class="btn btn-primary btn-lg">
              Get Started Free ✨
            </button>
            <button id="hero-how-btn" class="btn btn-secondary btn-lg">
              See How It Works 💡
            </button>
          </div>

          <!-- Hero Visual Flow -->
          <div class="hero-visual-flow">
            <div class="flow-steps-grid">
              <div class="flow-card">
                <div class="flow-card-icon">📷</div>
                <h4 style="margin-bottom: 0.25rem;">01. Timetable</h4>
                <p style="font-size: 0.82rem;">Image, Voice or Manual entry</p>
              </div>

              <div class="flow-card" style="background: var(--bg-soft-blue);">
                <div class="flow-card-icon">🧠</div>
                <h4 style="margin-bottom: 0.25rem;">02. AI Engine</h4>
                <p style="font-size: 0.82rem;">Understands times, days & rooms</p>
              </div>

              <div class="flow-card" style="background: var(--bg-soft-purple);">
                <div class="flow-card-icon">📅</div>
                <h4 style="margin-bottom: 0.25rem;">03. Smart Calendar</h4>
                <p style="font-size: 0.82rem;">Auto-repeats until semester ends</p>
              </div>

              <div class="flow-card" style="background: var(--bg-soft-pink);">
                <div class="flow-card-icon">🔔</div>
                <h4 style="margin-bottom: 0.25rem;">04. Dual Reminders</h4>
                <p style="font-size: 0.82rem;">Notifies you 30m & 5m before class</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features Section -->
      <section id="features" style="padding: 4rem 0; background: var(--bg-white);">
        <div class="container">
          <div style="text-align: center; max-width: 600px; margin: 0 auto 3rem auto;">
            <div class="badge badge-purple" style="margin-bottom: 0.5rem;">Powerful Capabilities</div>
            <h2>Everything You Need To Stay On Track</h2>
            <p>Simple enough for anyone, powered by state-of-the-art schedule intelligence.</p>
          </div>

          <div class="features-grid">
            <div class="card card-hover card-purple-tint">
              <div style="font-size: 2.2rem; margin-bottom: 1rem;">📷</div>
              <h3>AI Timetable Scanner</h3>
              <p>Upload a picture or snapshot of your timetable and let AI read days, subjects, times, and rooms with zero effort.</p>
            </div>

            <div class="card card-hover card-pink-tint">
              <div style="font-size: 2.2rem; margin-bottom: 1rem;">🎤</div>
              <h3>Voice Schedule Input</h3>
              <p>Simply speak your schedule naturally in English or Hindi/Hinglish. SmartTime AI structures your entire week instantly.</p>
            </div>

            <div class="card card-hover card-blue-tint">
              <div style="font-size: 2.2rem; margin-bottom: 1rem;">📅</div>
              <h3>Smart Calendar & Recurrence</h3>
              <p>Your timetable repeats automatically every week until your semester or term expires. No manual recurring setups.</p>
            </div>

            <div class="card card-hover" style="border-color: rgba(34, 197, 94, 0.25); background: linear-gradient(145deg, #FFF, var(--bg-main));">
              <div style="font-size: 2.2rem; margin-bottom: 1rem;">🔔</div>
              <h3>Proactive Reminders</h3>
              <p>Get notified before class starts with gentle browser alerts and sound chimes so you never miss a lecture.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- How It Works Section -->
      <section id="how-it-works" style="padding: 5rem 0;">
        <div class="container">
          <div style="text-align: center; max-width: 600px; margin: 0 auto 3.5rem auto;">
            <div class="badge badge-blue" style="margin-bottom: 0.5rem;">5 Simple Steps</div>
            <h2>How SmartTime AI Works</h2>
            <p>"One step at a time" — straightforward, intuitive, and stress-free.</p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
            <div class="card" style="text-align: center;">
              <div style="width: 44px; height: 44px; border-radius: 999px; background: var(--primary-purple); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; margin: 0 auto 1rem auto;">01</div>
              <h4>Upload or Speak</h4>
              <p style="font-size: 0.85rem;">Provide your timetable picture, voice note, or simple form.</p>
            </div>

            <div class="card" style="text-align: center;">
              <div style="width: 44px; height: 44px; border-radius: 999px; background: var(--sky-blue); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; margin: 0 auto 1rem auto;">02</div>
              <h4>AI Understands</h4>
              <p style="font-size: 0.85rem;">Scans days, class timings, teachers, and rooms.</p>
            </div>

            <div class="card" style="text-align: center;">
              <div style="width: 44px; height: 44px; border-radius: 999px; background: var(--soft-purple); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; margin: 0 auto 1rem auto;">03</div>
              <h4>Review & Confirm</h4>
              <p style="font-size: 0.85rem;">Preview structured classes, edit details, or resolve conflicts.</p>
            </div>

            <div class="card" style="text-align: center;">
              <div style="width: 44px; height: 44px; border-radius: 999px; background: var(--soft-pink); color: #881337; display: flex; align-items: center; justify-content: center; font-weight: 800; margin: 0 auto 1rem auto;">04</div>
              <h4>Validity & Alerts</h4>
              <p style="font-size: 0.85rem;">Choose how long it stays active and set custom reminder timing.</p>
            </div>

            <div class="card" style="text-align: center;">
              <div style="width: 44px; height: 44px; border-radius: 999px; background: var(--mint-green); color: #14532D; display: flex; align-items: center; justify-content: center; font-weight: 800; margin: 0 auto 1rem auto;">05</div>
              <h4>All Set! 🎉</h4>
              <p style="font-size: 0.85rem;">Sit back while SmartTime AI keeps you organized and on time.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Students & Teachers Section -->
      <section id="students-teachers" style="padding: 4rem 0; background: var(--bg-white);">
        <div class="container">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem;">
            <div class="card card-purple-tint" style="padding: 2.5rem;">
              <div class="badge badge-purple" style="margin-bottom: 1rem;">For Students</div>
              <h3>Never miss a class or change of room again.</h3>
              <p style="margin: 1rem 0 1.5rem 0;">Snap a photo of your college syllabus or university routine. Get instant countdowns to your next class and proactive reminders right on your phone or laptop.</p>
              <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.9rem;">
                <li>✓ Live countdown to next class</li>
                <li>✓ Teacher name and room numbers at a glance</li>
                <li>✓ Semester timetable expiry alerts</li>
              </ul>
            </div>

            <div class="card card-blue-tint" style="padding: 2.5rem;">
              <div class="badge badge-blue" style="margin-bottom: 1rem;">For Teachers & Tutors</div>
              <h3>Manage multiple lectures and batches effortlessly.</h3>
              <p style="margin: 1rem 0 1.5rem 0;">Keep track of your weekly teaching timetable, coaching sessions, and lecture halls without tedious manual calendar entry.</p>
              <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.9rem;">
                <li>✓ Multi-day schedule and room management</li>
                <li>✓ Easy timetable extension for next term</li>
                <li>✓ Reschedule single lectures in one click</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Footer CTA -->
      <footer style="padding: 4rem 0; text-align: center; border-top: 1px solid var(--border-color);">
        <div class="container">
          <h2>Ready to organize your schedule effortlessly?</h2>
          <p style="margin: 0.75rem auto 2rem auto;">Join thousands of students and educators using SmartTime AI.</p>
          <button id="footer-cta-btn" class="btn btn-primary btn-lg">
            Get Started Free Now ➔
          </button>
          <p style="margin-top: 3rem; font-size: 0.8rem; color: var(--text-muted);">
            © 2026 SmartTime AI — "Your Schedule. Automatically Organized."
          </p>
        </div>
      </footer>
    </div>
  `;

  // Attach button listeners
  const openLogin = () => openLoginModal();
  const openSignup = () => openSignupModal();

  container.querySelector('#landing-login-btn').addEventListener('click', openLogin);
  container.querySelector('#landing-get-started-btn').addEventListener('click', openSignup);
  container.querySelector('#hero-cta-btn').addEventListener('click', openSignup);
  container.querySelector('#footer-cta-btn').addEventListener('click', openSignup);

  container.querySelector('#hero-how-btn').addEventListener('click', () => {
    document.querySelector('#how-it-works').scrollIntoView({ behavior: 'smooth' });
  });
}
