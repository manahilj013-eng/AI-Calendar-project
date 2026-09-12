/**
 * Interactive Alarm Ringing Modal for SmartTime AI
 * Emulates a real phone alarm clock screen with ringing audio,
 * pulsing visual animations, vibration, and Dismiss / Snooze actions.
 */

import { startContinuousAlarm, stopContinuousAlarm, ALARM_TONES, getSavedAlarmTone } from '../utils/audioUtils.js';

let activeModalEl = null;

/**
 * Triggers the live alarm modal and starts continuous audio ringing
 */
export function triggerLiveAlarm({
  title = 'Class Alarm Ringing! ⏰',
  message = 'Your lecture is starting soon. Please get ready!',
  toneId = null,
  room = '',
  teacher = '',
  timeStr = ''
} = {}) {
  // If already open, close previous
  dismissLiveAlarm();

  const chosenTone = toneId || getSavedAlarmTone('smarttime_alarm_tone_1') || 'alarm';
  const toneObj = ALARM_TONES.find((t) => t.id === chosenTone) || ALARM_TONES[0];

  // Start continuous audio loop & vibration
  startContinuousAlarm(chosenTone, `${title}. ${message}`);

  const modalRoot = document.getElementById('modal-root') || document.body;
  const overlay = document.createElement('div');
  overlay.id = 'live-alarm-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(10, 14, 26, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    animation: fadeIn 0.3s ease;
  `;

  overlay.innerHTML = `
    <div style="
      background: var(--bg-card, #ffffff);
      color: var(--text-primary, #1e293b);
      border-radius: var(--radius-2xl, 24px);
      box-shadow: 0 25px 60px -15px rgba(108, 99, 255, 0.5), 0 0 0 3px rgba(108, 99, 255, 0.35);
      max-width: 480px;
      width: 100%;
      text-align: center;
      padding: 2.5rem 1.75rem;
      border: 1px solid var(--border-color, #e2e8f0);
      position: relative;
      animation: bounceIn 0.4s ease;
    ">
      <!-- Pulsing Alarm Bell Icon -->
      <div style="
        width: 90px;
        height: 90px;
        margin: 0 auto 1.5rem auto;
        border-radius: 50%;
        background: linear-gradient(135deg, #FF6584, #6C63FF);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 3rem;
        box-shadow: 0 0 35px rgba(255, 101, 132, 0.6);
        animation: pulseRing 1.2s infinite;
      ">
        ⏰
      </div>

      <!-- Live Ringing Badge -->
      <div style="margin-bottom: 0.75rem;">
        <span class="badge badge-active" style="font-size: 0.82rem; padding: 0.35rem 0.9rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; background: #FF6584; color: #fff;">
          🔔 Alarm Ringing Now
        </span>
      </div>

      <!-- Title & Message -->
      <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 0.5rem; color: var(--text-primary, #1e293b);">
        ${title}
      </h2>
      <p style="font-size: 1.05rem; color: var(--text-secondary, #64748b); margin-bottom: 1.25rem; line-height: 1.5;">
        ${message}
      </p>

      ${
        timeStr || room || teacher
          ? `
        <div style="background: var(--bg-main, #f8fafc); border-radius: var(--radius-lg, 12px); padding: 0.9rem 1.25rem; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.92rem; text-align: left; border: 1px solid var(--border-color, #e2e8f0);">
          ${timeStr ? `<div>⏰ <strong>Time:</strong> <span style="color: var(--primary-purple, #6C63FF); font-weight: 700;">${timeStr}</span></div>` : ''}
          ${room ? `<div>📍 <strong>Location:</strong> ${room}</div>` : ''}
          ${teacher ? `<div>👨‍🏫 <strong>Instructor:</strong> ${teacher}</div>` : ''}
        </div>
      `
          : ''
      }

      <!-- Current Ringtone Label -->
      <div style="font-size: 0.84rem; color: var(--text-muted, #94a3b8); margin-bottom: 1.75rem; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
        <span>🎵 Ringtone:</span>
        <strong style="color: var(--primary-purple, #6C63FF);">${toneObj.name}</strong>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <button id="btn-dismiss-alarm-modal" class="btn btn-primary btn-lg" style="
          width: 100%;
          padding: 1rem;
          font-size: 1.15rem;
          font-weight: 700;
          border-radius: var(--radius-lg, 12px);
          box-shadow: 0 8px 20px rgba(108, 99, 255, 0.4);
        ">
          ⏹️ Turn Off Alarm
        </button>

        <button id="btn-snooze-alarm-modal" class="btn btn-outline" style="
          width: 100%;
          padding: 0.85rem;
          font-size: 0.95rem;
          font-weight: 600;
          border-radius: var(--radius-lg, 12px);
        ">
          💤 Snooze 5 Minutes
        </button>
      </div>
    </div>
  `;

  modalRoot.appendChild(overlay);
  activeModalEl = overlay;

  overlay.querySelector('#btn-dismiss-alarm-modal')?.addEventListener('click', () => {
    dismissLiveAlarm();
  });

  overlay.querySelector('#btn-snooze-alarm-modal')?.addEventListener('click', () => {
    dismissLiveAlarm();
    setTimeout(() => {
      triggerLiveAlarm({
        title: `Snoozed Alert: ${title}`,
        message: `Snooze finished! ${message}`,
        toneId: chosenTone,
        room,
        teacher,
        timeStr
      });
    }, 5 * 60 * 1000);
  });
}

/**
 * Dismisses the active alarm modal and stops all ringing sounds
 */
export function dismissLiveAlarm() {
  stopContinuousAlarm();
  if (activeModalEl && activeModalEl.parentNode) {
    activeModalEl.parentNode.removeChild(activeModalEl);
  }
  activeModalEl = null;
}
