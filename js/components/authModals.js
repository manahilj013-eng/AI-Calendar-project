/**
 * Authentication and Onboarding Modals
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from './toast.js';

export function renderAuthModals(container) {
  container.innerHTML = `
    <!-- Login Modal -->
    <div id="modal-login" class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Welcome Back 👋</h3>
          <button class="btn btn-ghost btn-icon modal-close">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 1.25rem;">Sign in to access your timetable and reminders.</p>

          <form id="form-login">
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="login-email" class="form-control" placeholder="yourname@domain.com" required>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="login-password" class="form-control" placeholder="••••••••" required>
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top: 1rem;">
              Login to SmartTime
            </button>
          </form>

          <div style="text-align: center; margin: 1.5rem 0 1rem 0;">
            <span style="color: var(--text-muted); font-size: 0.85rem;">OR</span>
          </div>

          <button id="btn-quick-demo" class="btn btn-secondary btn-block">
            ⚡ One-Click Test Account
          </button>

          <p style="text-align: center; margin-top: 1.5rem; font-size: 0.88rem;">
            Don't have an account? <a href="#" id="switch-to-signup" style="font-weight: 600;">Create Account</a>
          </p>
        </div>
      </div>
    </div>

    <!-- Signup Modal -->
    <div id="modal-signup" class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Create Your Account ✨</h3>
          <button class="btn btn-ghost btn-icon modal-close">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 1.25rem;">Create your free account to build your custom schedule.</p>

          <form id="form-signup">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="signup-name" class="form-control" placeholder="e.g. manahil" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="signup-email" class="form-control" placeholder="name@domain.com" required>
            </div>
            <div class="form-group">
              <label class="form-label">Your Role</label>
              <select id="signup-role" class="form-control">
                <option value="Student">Student (University / College / School)</option>
                <option value="Teacher">Teacher / Tutor / Professor</option>
                <option value="Personal">Personal Routine</option>
                <option value="Work">Professional / Work</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="signup-password" class="form-control" placeholder="At least 6 characters" required minlength="6">
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top: 1rem;">
              Create Free Account ➔
            </button>
          </form>

          <p style="text-align: center; margin-top: 1.5rem; font-size: 0.88rem;">
            Already have an account? <a href="#" id="switch-to-login" style="font-weight: 600;">Login</a>
          </p>
        </div>
      </div>
    </div>

    <!-- Onboarding Modal -->
    <div id="modal-onboarding" class="modal-backdrop">
      <div class="modal-card" style="max-width: 580px;">
        <div class="modal-header">
          <h3>Welcome to SmartTime AI 🎉</h3>
        </div>
        <div class="modal-body" id="onboarding-step-container">
          <!-- Populated dynamically -->
        </div>
      </div>
    </div>
  `;

  // Attach handlers
  setupModalHandlers(container);
}

function setupModalHandlers(container) {
  const loginModal = container.querySelector('#modal-login');
  const signupModal = container.querySelector('#modal-signup');

  container.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      loginModal.classList.remove('open');
      signupModal.classList.remove('open');
    });
  });

  const switchToSignup = container.querySelector('#switch-to-signup');
  if (switchToSignup) {
    switchToSignup.addEventListener('click', (e) => {
      e.preventDefault();
      loginModal.classList.remove('open');
      signupModal.classList.add('open');
    });
  }

  const switchToLogin = container.querySelector('#switch-to-login');
  if (switchToLogin) {
    switchToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      signupModal.classList.remove('open');
      loginModal.classList.add('open');
    });
  }

  // Quick Demo Login (Registers or logs in automatically)
  const quickDemoBtn = container.querySelector('#btn-quick-demo');
  if (quickDemoBtn) {
    quickDemoBtn.addEventListener('click', async () => {
      try {
        let res;
        try {
          res = await api.login({ email: 'manahilj013@gmail.com', password: 'password123' });
        } catch (e) {
          // If user does not exist in clean DB, register on the fly
          res = await api.register({
            name: 'manahil',
            email: 'manahilj013@gmail.com',
            password: 'password123',
            role: 'Student'
          });
        }
        state.setUser(res.user, res.token);
        loginModal.classList.remove('open');
        showToast(`Logged in as ${res.user.name}!`, 'success');
        state.setView('dashboard');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Login Submit
  const loginForm = container.querySelector('#form-login');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = container.querySelector('#login-email').value.trim();
      const password = container.querySelector('#login-password').value;

      try {
        const res = await api.login({ email, password });
        state.setUser(res.user, res.token);
        loginModal.classList.remove('open');
        showToast(`Welcome back, ${res.user.name}!`, 'success');
        state.setView('dashboard');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Signup Submit
  const signupForm = container.querySelector('#form-signup');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = container.querySelector('#signup-name').value.trim();
      const email = container.querySelector('#signup-email').value.trim();
      const role = container.querySelector('#signup-role').value;
      const password = container.querySelector('#signup-password').value;

      try {
        const res = await api.register({ name, email, password, role });
        state.setUser(res.user, res.token);
        signupModal.classList.remove('open');
        showToast(`Account created! Welcome, ${name}! 🎉`, 'success');
        state.setView('add-schedule');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

export function openLoginModal() {
  const modal = document.querySelector('#modal-login');
  if (modal) modal.classList.add('open');
}

export function openSignupModal() {
  const modal = document.querySelector('#modal-signup');
  if (modal) modal.classList.add('open');
}

export function startOnboardingWizard() {
  const modal = document.querySelector('#modal-onboarding');
  const container = document.querySelector('#onboarding-step-container');
  if (!modal || !container) return;

  modal.classList.add('open');

  let currentStep = 1;
  const onboardingData = {
    name: state.user?.name || '',
    role: 'Student',
    method: 'image'
  };

  function renderStep() {
    if (currentStep === 1) {
      container.innerHTML = `
        <h4 style="margin-bottom: 0.5rem;">Step 1 of 3: What should we call you?</h4>
        <p style="margin-bottom: 1.5rem;">Let's personalize your SmartTime AI schedule assistant.</p>
        <div class="form-group">
          <label class="form-label">Your Name</label>
          <input type="text" id="ob-name" class="form-control" value="${onboardingData.name}" placeholder="e.g. Alex Johnson" required>
        </div>
        <button id="ob-next-1" class="btn btn-primary btn-block btn-lg" style="margin-top: 1rem;">
          Continue ➔
        </button>
      `;

      container.querySelector('#ob-next-1').addEventListener('click', () => {
        const nameVal = container.querySelector('#ob-name').value.trim();
        if (!nameVal) {
          showToast('Please enter your name', 'warning');
          return;
        }
        onboardingData.name = nameVal;
        currentStep = 2;
        renderStep();
      });
    } else if (currentStep === 2) {
      container.innerHTML = `
        <h4 style="margin-bottom: 0.5rem;">Step 2 of 3: How will you use SmartTime AI?</h4>
        <p style="margin-bottom: 1.5rem;">Select the role that fits your daily routine best.</p>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1.5rem;">
          ${['Student', 'Teacher', 'Personal', 'Work', 'Other']
            .map(
              (role) => `
            <button type="button" class="btn btn-outline role-select-btn ${onboardingData.role === role ? 'btn-primary' : ''}" data-role="${role}" style="padding: 1rem; justify-content: flex-start; gap: 0.75rem;">
              <span style="font-size: 1.3rem;">${role === 'Student' ? '🎓' : role === 'Teacher' ? '👨‍🏫' : role === 'Work' ? '💼' : role === 'Personal' ? '🌟' : '📌'}</span>
              <span>${role}</span>
            </button>
          `
            )
            .join('')}
        </div>
        <button id="ob-next-2" class="btn btn-primary btn-block btn-lg">
          Continue ➔
        </button>
      `;

      container.querySelectorAll('.role-select-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.role-select-btn').forEach((b) => {
            b.classList.remove('btn-primary');
            b.classList.add('btn-outline');
          });
          btn.classList.remove('btn-outline');
          btn.classList.add('btn-primary');
          onboardingData.role = btn.getAttribute('data-role');
        });
      });

      container.querySelector('#ob-next-2').addEventListener('click', () => {
        currentStep = 3;
        renderStep();
      });
    } else if (currentStep === 3) {
      container.innerHTML = `
        <h4 style="margin-bottom: 0.5rem;">Step 3 of 3: How would you like to add your schedule?</h4>
        <p style="margin-bottom: 1.5rem;">Choose your preferred input method.</p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
          <button type="button" class="method-option-btn card card-hover" data-method="image" style="padding: 1rem; display: flex; align-items: center; gap: 1rem; cursor: pointer; text-align: left;">
            <span style="font-size: 2rem;">📷</span>
            <div>
              <strong style="display: block; color: var(--text-primary);">Upload Timetable Picture</strong>
              <span style="font-size: 0.85rem; color: var(--text-secondary);">AI reads your photo or timetable PDF automatically</span>
            </div>
          </button>

          <button type="button" class="method-option-btn card card-hover" data-method="voice" style="padding: 1rem; display: flex; align-items: center; gap: 1rem; cursor: pointer; text-align: left;">
            <span style="font-size: 2rem;">🎤</span>
            <div>
              <strong style="display: block; color: var(--text-primary);">Speak Schedule Naturally</strong>
              <span style="font-size: 0.85rem; color: var(--text-secondary);">Simply tell SmartTime AI your classes by voice</span>
            </div>
          </button>

          <button type="button" class="method-option-btn card card-hover" data-method="manual" style="padding: 1rem; display: flex; align-items: center; gap: 1rem; cursor: pointer; text-align: left;">
            <span style="font-size: 2rem;">✍️</span>
            <div>
              <strong style="display: block; color: var(--text-primary);">Enter Manually</strong>
              <span style="font-size: 0.85rem; color: var(--text-secondary);">Add your subjects and times with a simple form</span>
            </div>
          </button>
        </div>
      `;

      container.querySelectorAll('.method-option-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const method = btn.getAttribute('data-method');
          onboardingData.method = method;

          try {
            await api.saveOnboarding({ name: onboardingData.name, role: onboardingData.role });
            state.user.name = onboardingData.name;
            state.user.role = onboardingData.role;
            state.setUser(state.user, state.token);
          } catch (e) {
            console.warn(e);
          }

          modal.classList.remove('open');
          showToast('Welcome aboard!', 'success');
          state.setView('add-schedule');
        });
      });
    }
  }

  renderStep();
}
