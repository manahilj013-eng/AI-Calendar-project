/**
 * Audio Utilities & Alarm Ringtone Engine for SmartTime AI
 * - Synthesized multi-tone ringtones using Web Audio API (100% offline, cross-platform)
 * - Spoken announcements via Web Speech API
 * - Looping alarm ringer with dismissal and snooze controls
 */

let audioCtx = null;
let activeAlarmInterval = null;
let activeAlarmTimeout = null;

export function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const ALARM_TONES = [
  { id: 'alarm', name: '⏰ Digital Alarm (Classic Beep)', icon: '⏰', desc: 'Classic digital watch or phone triple beep' },
  { id: 'marimba', name: '🎵 Phone Marimba (Modern Chime)', icon: '🎵', desc: 'Modern acoustic marimba phone chime' },
  { id: 'radar', name: '🚨 Radar Siren (Loud Alert)', icon: '🚨', desc: 'Loud alternating dual-tone emergency siren' },
  { id: 'morning', name: '🌅 Morning Melody (Gentle Tune)', icon: '🌅', desc: 'Uplifting gentle morning arpeggio' },
  { id: 'fanfare', name: '🎺 Wake-up Fanfare (Trumpet)', icon: '🎺', desc: 'Energetic brass trumpet fanfare' },
  { id: 'chime', name: '🔔 Gentle Chime (Crystal Bell)', icon: '🔔', desc: 'Harmonious crystal two-tone chime' },
  { id: 'bell', name: '📢 Campus Bell (School Bell)', icon: '📢', desc: 'Resonant acoustic university tower bell' },
  { id: 'strum', name: '🎸 Acoustic Strum (Guitar)', icon: '🎸', desc: 'Warm 6-string acoustic guitar strum' },
  { id: 'voice', name: '🗣️ AI Voice Alert (Spoken Reminder)', icon: '🗣️', desc: 'Speaks out class name, time and room number' }
];

/**
 * 1. Classic Digital Alarm (Rapid Square Wave Beeps)
 */
export function playDigitalAlarmSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const beeps = [0.0, 0.12, 0.24, 0.48, 0.60, 0.72];
    beeps.forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(980, now + t);
      gain.gain.setValueAtTime(0.2, now + t);
      gain.gain.setValueAtTime(0.001, now + t + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.09);
    });
  } catch (err) {
    console.warn('Digital alarm error:', err);
  }
}

/**
 * 2. Modern Smartphone Marimba Ringtone
 */
export function playMarimbaSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [
      { f: 523.25, t: 0.0, dur: 0.28 },  // C5
      { f: 659.25, t: 0.1, dur: 0.28 },  // E5
      { f: 783.99, t: 0.2, dur: 0.32 },  // G5
      { f: 987.77, t: 0.3, dur: 0.38 },  // B5
      { f: 1046.50, t: 0.42, dur: 0.55 } // C6
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.25, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.dur);
    });
  } catch (err) {
    console.warn('Marimba sound error:', err);
  }
}

/**
 * 3. Radar Siren (Alternating High-Low Urgency Alarm)
 */
export function playRadarAlarmSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sweeps = [
      { f: 880, t: 0.0, dur: 0.22 },
      { f: 660, t: 0.22, dur: 0.22 },
      { f: 880, t: 0.44, dur: 0.22 },
      { f: 660, t: 0.66, dur: 0.22 },
      { f: 987, t: 0.90, dur: 0.4 }
    ];

    sweeps.forEach((s) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(s.f, now + s.t);
      gain.gain.setValueAtTime(0.18, now + s.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + s.t + s.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + s.t);
      osc.stop(now + s.t + s.dur);
    });
  } catch (err) {
    console.warn('Radar alarm error:', err);
  }
}

/**
 * 4. Morning Sunshine Melody (Pleasant, Soothing Arpeggio)
 */
export function playMorningMelodySound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [
      { f: 587.33, t: 0.0, dur: 0.35 },  // D5
      { f: 739.99, t: 0.15, dur: 0.35 }, // F#5
      { f: 880.00, t: 0.30, dur: 0.35 }, // A5
      { f: 1174.66, t: 0.48, dur: 0.45 },// D6
      { f: 1108.73, t: 0.70, dur: 0.4 }, // C#6
      { f: 880.00, t: 0.95, dur: 0.7 }   // A5
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.22, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.dur);
    });
  } catch (err) {
    console.warn('Morning melody error:', err);
  }
}

/**
 * 5. Wake-up Fanfare (Triumphant Brass-Style Wakeup)
 */
export function playFanfareSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [
      { f: 392.00, t: 0.0, dur: 0.18 },  // G4
      { f: 523.25, t: 0.18, dur: 0.18 }, // C5
      { f: 659.25, t: 0.36, dur: 0.22 }, // E5
      { f: 783.99, t: 0.58, dur: 0.65 }  // G5
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.24, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.dur);
    });
  } catch (err) {
    console.warn('Fanfare error:', err);
  }
}

/**
 * 6. Harmonious Gentle Chime
 */
export function playChimeSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // C5
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.8);

    // G5
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.15);
    gain2.gain.setValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 1.2);
  } catch (err) {
    console.warn('Audio chime playback failed:', err);
  }
}

/**
 * 7. Campus Bell Gong (4-Harmonic Deep Bell)
 */
export function playCollegeBellSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [440, 880, 1320, 1760].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      const amp = 0.24 / (idx + 1);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 2.0);
    });
  } catch (err) {
    console.warn('College bell error:', err);
  }
}

/**
 * 8. Acoustic Guitar Strum
 */
export function playGuitarStrumSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const strings = [164.81, 220.00, 293.66, 392.00, 493.88, 659.25]; // E-A-D-G-B-E

    strings.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      gain.gain.setValueAtTime(0.18, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.04 + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 1.2);
    });
  } catch (err) {
    console.warn('Guitar strum error:', err);
  }
}

/**
 * 9. Natural Spoken Voice Reminder
 */
export function playVoiceReminder(text = 'Attention! Your class is starting soon. Please get ready!') {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      playDigitalAlarmSound();
    }
  } catch (err) {
    console.warn('Voice reminder error:', err);
    playDigitalAlarmSound();
  }
}

/**
 * Main dispatcher to play any selected alarm tone once
 */
export function playAlarmTone(toneId = 'alarm', customText = 'Attention! Your class is starting soon.') {
  if (toneId === 'alarm') {
    playDigitalAlarmSound();
  } else if (toneId === 'marimba') {
    playMarimbaSound();
  } else if (toneId === 'radar') {
    playRadarAlarmSound();
  } else if (toneId === 'morning') {
    playMorningMelodySound();
  } else if (toneId === 'fanfare') {
    playFanfareSound();
  } else if (toneId === 'bell') {
    playCollegeBellSound();
  } else if (toneId === 'strum') {
    playGuitarStrumSound();
  } else if (toneId === 'voice') {
    playVoiceReminder(customText);
  } else {
    playChimeSound();
  }
}

/**
 * Starts continuous looping alarm ringing (repeats until stopped or 25s limit)
 */
export function startContinuousAlarm(toneId = 'alarm', customText = 'Attention! Class reminder.', durationMs = 25000) {
  stopContinuousAlarm();

  // Play immediately
  playAlarmTone(toneId, customText);

  // Vibrate mobile device if supported
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([500, 200, 500, 200, 500]);
    } catch (_) {}
  }

  // Loop tone every 2.4 seconds
  activeAlarmInterval = setInterval(() => {
    playAlarmTone(toneId, customText);
  }, 2400);

  // Auto-stop after durationMs
  activeAlarmTimeout = setTimeout(() => {
    stopContinuousAlarm();
  }, durationMs);
}

/**
 * Stops continuous looping alarm
 */
export function stopContinuousAlarm() {
  if (activeAlarmInterval) {
    clearInterval(activeAlarmInterval);
    activeAlarmInterval = null;
  }
  if (activeAlarmTimeout) {
    clearTimeout(activeAlarmTimeout);
    activeAlarmTimeout = null;
  }
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
  }
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch (_) {}
  }
}

/**
 * Gets currently saved alarm tone preference from localStorage
 */
export function getSavedAlarmTone(key = 'smarttime_alarm_tone_1') {
  return localStorage.getItem(key) || 'alarm';
}

/**
 * Starts speech recognition using Web Speech API (with fallback simulation)
 */
export function createSpeechRecognizer(onTranscript, onError, onEnd) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        onTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      if (onError) onError(event.error);
    };

    recognition.onend = () => {
      if (onEnd) onEnd();
    };

    return recognition;
  }

  return null;
}
