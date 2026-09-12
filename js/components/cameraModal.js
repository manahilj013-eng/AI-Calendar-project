/**
 * Camera Capture Modal for SmartTime AI
 * Live WebRTC camera stream with snapshot capture & fallback handling
 */

import { showToast } from './toast.js';

let stream = null;

export function openCameraModal(onPhotoCaptured) {
  let modal = document.querySelector('#modal-camera');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-camera';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 520px; text-align: center;">
      <div class="modal-header">
        <h3>Take Timetable Photo 📷</h3>
        <button class="btn btn-ghost btn-icon" id="camera-close-btn">✕</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 1rem; font-size: 0.88rem;">Fit your entire timetable inside the frame clearly.</p>

        <div style="position: relative; background: #000; border-radius: var(--radius-lg); overflow: hidden; height: 320px; display: flex; align-items: center; justify-content: center;">
          <video id="camera-video" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
          <canvas id="camera-canvas" style="display: none;"></canvas>
          <img id="camera-preview-img" style="display: none; width: 100%; height: 100%; object-fit: contain; background: #111;" />

          <div id="camera-guide-overlay" style="position: absolute; inset: 20px; border: 2px dashed rgba(255,255,255,0.7); border-radius: 12px; pointer-events: none;"></div>
        </div>

        <div style="margin-top: 1.5rem; display: flex; justify-content: center; gap: 1rem;">
          <button id="btn-snap-photo" class="btn btn-primary btn-lg" style="border-radius: var(--radius-full);">
            📸 Capture Photo
          </button>
          <button id="btn-retake-photo" class="btn btn-outline btn-lg" style="display: none;">
            🔄 Retake
          </button>
          <button id="btn-use-photo" class="btn btn-mint btn-lg" style="display: none;">
            ✓ Use Photo
          </button>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');

  const video = modal.querySelector('#camera-video');
  const canvas = modal.querySelector('#camera-canvas');
  const previewImg = modal.querySelector('#camera-preview-img');
  const snapBtn = modal.querySelector('#btn-snap-photo');
  const retakeBtn = modal.querySelector('#btn-retake-photo');
  const useBtn = modal.querySelector('#btn-use-photo');
  const overlay = modal.querySelector('#camera-guide-overlay');

  let capturedBase64 = null;

  async function startStream() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = stream;
        video.style.display = 'block';
        previewImg.style.display = 'none';
        overlay.style.display = 'block';
      } else {
        throw new Error('Camera API not supported in this browser');
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
      showToast('Camera access unavailable. You can upload an image instead.', 'warning');
      // Create simulated snapshot
      generateSimulatedCapture();
    }
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function generateSimulatedCapture() {
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 600, 400);
    ctx.fillStyle = '#6C63FF';
    ctx.font = 'bold 24px Poppins, sans-serif';
    ctx.fillText('Class Timetable 2026', 180, 50);
    ctx.fillStyle = '#25243A';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText('Monday: Digital Marketing (5:00 PM - 6:00 PM) - Room 204', 50, 110);
    ctx.fillText('Tuesday: SEO & Analytics (4:00 PM - 5:00 PM) - Lab 108', 50, 150);
    ctx.fillText('Wednesday: Graphic Design (6:30 PM - 7:45 PM) - Studio 3', 50, 190);
    ctx.fillText('Thursday: Database Architecture (2:00 PM - 3:30 PM)', 50, 230);
    ctx.fillText('Friday: Machine Learning (3:00 PM - 4:30 PM)', 50, 270);

    capturedBase64 = canvas.toDataURL('image/png');
    video.style.display = 'none';
    overlay.style.display = 'none';
    previewImg.src = capturedBase64;
    previewImg.style.display = 'block';
    snapBtn.style.display = 'none';
    retakeBtn.style.display = 'inline-flex';
    useBtn.style.display = 'inline-flex';
  }

  startStream();

  snapBtn.addEventListener('click', () => {
    if (video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      capturedBase64 = canvas.toDataURL('image/png');

      video.style.display = 'none';
      overlay.style.display = 'none';
      previewImg.src = capturedBase64;
      previewImg.style.display = 'block';
      snapBtn.style.display = 'none';
      retakeBtn.style.display = 'inline-flex';
      useBtn.style.display = 'inline-flex';
    } else {
      generateSimulatedCapture();
    }
  });

  retakeBtn.addEventListener('click', () => {
    capturedBase64 = null;
    startStream();
    snapBtn.style.display = 'inline-flex';
    retakeBtn.style.display = 'none';
    useBtn.style.display = 'none';
  });

  useBtn.addEventListener('click', () => {
    stopStream();
    modal.classList.remove('open');
    if (onPhotoCaptured && capturedBase64) {
      onPhotoCaptured(capturedBase64);
    }
  });

  modal.querySelector('#camera-close-btn').addEventListener('click', () => {
    stopStream();
    modal.classList.remove('open');
  });
}
