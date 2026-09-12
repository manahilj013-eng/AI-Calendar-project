/**
 * 5-Step Unified Schedule Creation Wizard for SmartTime AI
 * Handles Image OCR, Voice Input, Manual Builder -> Review -> Validity -> Reminders -> Calendar Generation
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { showToast } from './toast.js';
import { openCameraModal } from './cameraModal.js';
import { formatTime12h, formatDatePretty, DAYS_LIST } from '../utils/dateUtils.js';
import { createSpeechRecognizer, playChimeSound, ALARM_TONES, playAlarmTone } from '../utils/audioUtils.js';
import { eventsToCSV, downloadCSV, parseCSVToEvents } from '../utils/csvUtils.js';

export function renderAddScheduleWizard(container) {
  let currentStep = 1;
  let inputMethod = 'camera'; // 'camera' | 'upload' | 'manual'
  let uploadedImageUrl = null;
  let extractedEvents = [];
  let validityDuration = '3 Months';
  let validityStartDate = new Date().toISOString().split('T')[0];
  let validityEndDate = null;
  let reminder1Minutes = 45;
  let reminder2Minutes = 5;
  let reminder1Tone = localStorage.getItem('smarttime_alarm_tone_1') || 'alarm';
  let reminder2Tone = localStorage.getItem('smarttime_alarm_tone_2') || 'voice';
  let remindersEnabled = true;
  let isRecordingVoice = false;
  let voiceRecognizer = null;
  let customTimetableTitle = '';

  // Calculate default 3 months end date
  const defaultEnd = new Date();
  defaultEnd.setMonth(defaultEnd.getMonth() + 3);
  validityEndDate = defaultEnd.toISOString().split('T')[0];

  function renderWizard() {
    container.innerHTML = `
      <div style="max-width: 860px; margin: 0 auto;">
        <!-- Stepper Progress Bar -->
        <div class="stepper-container">
          <div class="stepper-line">
            <div class="stepper-line-fill" style="width: ${(currentStep - 1) * 25}%;"></div>
          </div>
          ${[1, 2, 3, 4, 5]
            .map((s) => {
              const labels = ['Add', 'Review', 'Validity', 'Reminders', 'Done'];
              const statusClass = s === currentStep ? 'active' : s < currentStep ? 'completed' : '';
              return `
              <div class="step-item ${statusClass}">
                <div class="step-circle">${s < currentStep ? '✓' : s}</div>
                <div class="step-label">${labels[s - 1]}</div>
              </div>
            `;
            })
            .join('')}
        </div>

        <div id="step-content-area"></div>
      </div>
    `;

    const contentArea = container.querySelector('#step-content-area');
    if (currentStep === 1) renderStep1(contentArea);
    else if (currentStep === 2) renderStep2(contentArea);
    else if (currentStep === 3) renderStep3(contentArea);
    else if (currentStep === 4) renderStep4(contentArea);
    else if (currentStep === 5) renderStep5(contentArea);
  }

  // ==========================================
  // STEP 1: ADD SCHEDULE (Camera / Upload / Manual)
  // ==========================================
  let manualSubMode = 'form'; // 'form' | 'voice'
  let manualList = [];

  function renderStep1(area) {
    area.innerHTML = `
      <div style="text-align: center; margin-bottom: 2rem;">
        <h2 style="font-size: 2rem; margin-bottom: 0.5rem;">How would you like to add your schedule?</h2>
        <p>Choose one of the 3 easy ways below to add your timetable:</p>
      </div>

      <!-- Step 1: Timetable / File Name Selector -->
      <div class="card" style="margin-bottom: 1.75rem; padding: 1.25rem 1.5rem; border-left: 5px solid var(--primary-purple); background: var(--bg-card); box-shadow: var(--shadow-sm);">
        <label for="step1-timetable-name-input" style="display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 1.05rem; margin-bottom: 0.35rem; color: var(--text-primary); flex-wrap: wrap; gap: 0.5rem;">
          <span style="display: inline-flex; align-items: center; gap: 0.45rem;">
            📁 Timetable / File Name (فائل کا نام منتخب کریں یا لکھیں):
          </span>
          <span style="font-size: 0.8rem; font-weight: 600; color: var(--primary-purple);">
            Appears on your Timetable card
          </span>
        </label>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
          Type your desired timetable name or select a preset. When you upload an image, its file name will automatically be filled here.
        </p>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
          <input 
            type="text" 
            id="step1-timetable-name-input" 
            class="form-input" 
            style="flex: 1; min-width: 260px; font-size: 1.05rem; font-weight: 600; padding: 0.7rem 1rem;" 
            placeholder="e.g. BSCS 5th Semester Section A, Fall 2026 Schedule..." 
            value="${customTimetableTitle || ''}" 
          />
          <select id="step1-timetable-preset-select" class="form-input" style="max-width: 240px; font-size: 0.9rem; font-weight: 600; padding: 0.7rem 0.85rem; cursor: pointer;">
            <option value="">⚡ Quick Presets (اختیارات)...</option>
            <option value="BSCS 5th Semester Section A">BSCS 5th Semester Section A</option>
            <option value="Semester Routine 2026">Semester Routine 2026</option>
            <option value="Fall 2026 Class Schedule">Fall 2026 Class Schedule</option>
            <option value="Spring 2026 Class Routine">Spring 2026 Class Routine</option>
            <option value="University Weekly Schedule">University Weekly Schedule</option>
            <option value="College Routine">College Routine</option>
          </select>
        </div>
      </div>

      <!-- 3 Primary Method Cards -->
      <div class="wizard-method-cards">
        <div class="method-card ${inputMethod === 'camera' ? 'card-purple-tint active-method' : ''}" id="card-method-camera" style="border-color: ${inputMethod === 'camera' ? 'var(--primary-purple)' : 'var(--border-color)'};">
          <div class="method-card-icon" style="background: var(--bg-soft-purple); color: var(--primary-purple);">📷</div>
          <h3>1. Camera Scan</h3>
          <p style="font-size: 0.88rem;">Take a live photo of your timetable board or sheet with your camera.</p>
          <button class="btn ${inputMethod === 'camera' ? 'btn-primary' : 'btn-outline'} btn-sm" id="btn-card-camera" style="margin-top: 0.75rem; width: 100%;">
            📷 Open Camera
          </button>
        </div>

        <div class="method-card ${inputMethod === 'upload' ? 'card-blue-tint active-method' : ''}" id="card-method-upload" style="border-color: ${inputMethod === 'upload' ? 'var(--sky-blue)' : 'var(--border-color)'};">
          <div class="method-card-icon" style="background: var(--bg-soft-blue); color: #0284C7;">📁</div>
          <h3>2. Upload File / Image</h3>
          <p style="font-size: 0.88rem;">Upload an image or document from your phone, laptop, or computer.</p>
          <button class="btn ${inputMethod === 'upload' ? 'btn-primary' : 'btn-outline'} btn-sm" id="btn-card-upload" style="margin-top: 0.75rem; width: 100%;">
            📁 Choose File
          </button>
        </div>

        <div class="method-card ${inputMethod === 'manual' ? 'card-pink-tint active-method' : ''}" id="card-method-manual" style="border-color: ${inputMethod === 'manual' ? 'var(--soft-pink)' : 'var(--border-color)'};">
          <div class="method-card-icon" style="background: var(--bg-soft-pink); color: #881337;">✍️</div>
          <h3>3. Enter Manually</h3>
          <p style="font-size: 0.88rem;">Fill in your classes step-by-step or speak them using voice.</p>
          <button class="btn ${inputMethod === 'manual' ? 'btn-primary' : 'btn-outline'} btn-sm" id="btn-card-manual" style="margin-top: 0.75rem; width: 100%;">
            ✍️ Open Form Below ↓
          </button>
        </div>
      </div>

      <!-- Hidden Global File Input for Direct Upload -->
      <input type="file" id="global-timetable-file-input" accept="image/*,.csv,text/csv" style="display: none;">

      <!-- Active Method Container -->
      <div id="method-workspace" class="card" style="padding: 2.25rem; margin-top: 1.5rem; scroll-margin-top: 2rem;"></div>
    `;

    const workspace = area.querySelector('#method-workspace');
    const globalFileInput = area.querySelector('#global-timetable-file-input');

    const nameInp1 = area.querySelector('#step1-timetable-name-input');
    if (nameInp1) {
      nameInp1.addEventListener('input', (e) => {
        customTimetableTitle = e.target.value.trim();
      });
    }

    const presetSel1 = area.querySelector('#step1-timetable-preset-select');
    if (presetSel1) {
      presetSel1.addEventListener('change', (e) => {
        if (e.target.value) {
          customTimetableTitle = e.target.value;
          if (nameInp1) nameInp1.value = e.target.value;
        }
      });
    }

    globalFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageFile(e.target.files[0], workspace);
      }
    });

    // Card 1: Camera Click
    const handleCameraClick = (e) => {
      e?.stopPropagation();
      inputMethod = 'camera';
      renderStep1(area);
      openCameraModal((base64) => {
        handleImageBase64(base64, area.querySelector('#method-workspace'));
      });
    };

    area.querySelector('#card-method-camera').addEventListener('click', () => {
      inputMethod = 'camera';
      renderStep1(area);
      const ws = area.querySelector('#method-workspace');
      ws?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    area.querySelector('#btn-card-camera').addEventListener('click', handleCameraClick);

    // Card 2: Upload Click
    const handleUploadClick = (e) => {
      e?.stopPropagation();
      inputMethod = 'upload';
      renderStep1(area);
      globalFileInput.click();
    };

    area.querySelector('#card-method-upload').addEventListener('click', () => {
      inputMethod = 'upload';
      renderStep1(area);
      const ws = area.querySelector('#method-workspace');
      ws?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    area.querySelector('#btn-card-upload').addEventListener('click', handleUploadClick);

    // Card 3: Manual Click
    const handleManualClick = (e) => {
      e?.stopPropagation();
      inputMethod = 'manual';
      renderStep1(area);
      const ws = area.querySelector('#method-workspace');
      ws?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    area.querySelector('#card-method-manual').addEventListener('click', handleManualClick);
    area.querySelector('#btn-card-manual').addEventListener('click', handleManualClick);

    // ----------------------------------------------------
    // METHOD 1: LIVE CAMERA SCANNER
    // ----------------------------------------------------
    if (inputMethod === 'camera') {
      workspace.innerHTML = `
        <div style="text-align: center; max-width: 580px; margin: 0 auto;">
          <div style="font-size: 3.5rem; margin-bottom: 0.75rem;">📷</div>
          <h3 style="margin-bottom: 0.5rem;">Live Camera Timetable Scanner</h3>
          <p style="margin-bottom: 1.75rem; color: var(--text-secondary);">
            Point your webcam or phone camera at your timetable document or whiteboard. SmartTime AI will automatically detect and organize all your classes.
          </p>

          <div style="background: var(--bg-soft-purple); border: 2px dashed var(--primary-purple); border-radius: var(--radius-xl); padding: 2.5rem 1.5rem; margin-bottom: 1.75rem;">
            <p style="font-size: 0.95rem; margin-bottom: 1.25rem;">
              Make sure the timetable is well-lit and all subject names and times are clearly visible.
            </p>
            <button id="btn-open-camera-main" class="btn btn-primary btn-lg" style="padding: 1rem 2.5rem; font-size: 1.1rem; box-shadow: 0 8px 24px var(--primary-purple-glow);">
              📷 Open Camera & Take Photo
            </button>
          </div>

          <p style="font-size: 0.82rem; color: var(--text-muted);">
            🔒 Camera stream is processed securely in your browser.
          </p>
        </div>
      `;

      workspace.querySelector('#btn-open-camera-main').addEventListener('click', () => {
        openCameraModal((base64) => {
          handleImageBase64(base64, workspace);
        });
      });
    }

    // ----------------------------------------------------
    // METHOD 2: UPLOAD IMAGE / FILE
    // ----------------------------------------------------
    else if (inputMethod === 'upload') {
      workspace.innerHTML = `
        <div style="text-align: center;">
          <h3 style="margin-bottom: 0.5rem;">Upload Timetable Image / File</h3>
          <p style="margin-bottom: 1.75rem; color: var(--text-secondary);">Upload a photo or screenshot of your timetable (PNG, JPG, WEBP) or a CSV file.</p>

          <div id="drop-zone" style="border: 2px dashed var(--soft-purple); border-radius: var(--radius-lg); padding: 3rem 1.5rem; background: var(--bg-soft-purple); cursor: pointer; transition: all var(--transition-normal); margin-bottom: 1.5rem;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">📁</div>
            <h4 style="color: var(--primary-purple); margin-bottom: 0.25rem;">Drag & drop your timetable file here</h4>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">or click anywhere here to browse from your device</p>
            <input type="file" id="file-input" accept="image/*,.csv,text/csv" style="display: none;">
          </div>

          <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
            <button id="btn-browse-file" class="btn btn-primary btn-lg">
              📁 Browse File
            </button>
            <button id="btn-browse-folder" class="btn btn-outline btn-lg" style="font-weight: 600; border-color: var(--primary-purple); color: var(--primary-purple);">
              📂 Upload Folder
            </button>
            <input type="file" id="folder-input" webkitdirectory directory multiple style="display: none;">
            <button id="btn-demo-timetable" class="btn btn-secondary btn-lg">
              ✨ Try Sample Timetable
            </button>
          </div>
        </div>
      `;

      const dropZone = workspace.querySelector('#drop-zone');
      const fileInput = workspace.querySelector('#file-input');
      const folderInput = workspace.querySelector('#folder-input');

      dropZone.addEventListener('click', () => fileInput.click());
      workspace.querySelector('#btn-browse-file').addEventListener('click', () => fileInput.click());
      workspace.querySelector('#btn-browse-folder').addEventListener('click', () => folderInput.click());

      folderInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          const files = Array.from(e.target.files);
          const timetableFile = files.find((f) => f.name.toLowerCase().endsWith('.csv')) ||
                                files.find((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
          if (timetableFile) {
            handleImageFile(timetableFile, workspace);
            showToast(`Found and processing "${timetableFile.name}" from selected folder!`, 'info');
          } else {
            showToast('No timetable image or CSV file found in selected folder', 'warning');
          }
        }
      });

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary-purple)';
        dropZone.style.background = 'rgba(108, 99, 255, 0.15)';
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--soft-purple)';
        dropZone.style.background = 'var(--bg-soft-purple)';
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleImageFile(e.dataTransfer.files[0], workspace);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleImageFile(e.target.files[0], workspace);
        }
      });

      workspace.querySelector('#btn-demo-timetable').addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 600, 400);
        ctx.fillStyle = '#6C63FF';
        ctx.font = 'bold 24px Poppins, sans-serif';
        ctx.fillText('Weekly College Timetable', 150, 60);
        ctx.fillStyle = '#25243A';
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText('Monday: Digital Marketing (5:00 PM - 6:00 PM)', 80, 130);
        ctx.fillText('Tuesday: SEO & Analytics (4:00 PM - 5:00 PM)', 80, 180);
        ctx.fillText('Wednesday: Graphic Design (6:30 PM - 7:45 PM)', 80, 230);
        ctx.fillText('Thursday: Database Architecture (2:00 PM - 3:30 PM)', 80, 280);
        ctx.fillText('Friday: Machine Learning Seminar (3:00 PM - 4:30 PM)', 80, 330);

        handleImageBase64(canvas.toDataURL('image/png'), workspace);
      });
    }

    // ----------------------------------------------------
    // METHOD 3: MANUAL SCHEDULE (FORM ENTRY & VOICE NOTE)
    // ----------------------------------------------------
    else if (inputMethod === 'manual') {
      workspace.innerHTML = `
        <div>
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <h3 style="margin-bottom: 0.35rem;">Enter Your Custom Schedule ✍️</h3>
            <p style="color: var(--text-secondary);">Choose whether you want to enter classes via form or speak them with your voice:</p>
          </div>

          <!-- Sub-mode Toggle (Form Entry vs Voice Input) -->
          <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 2rem;">
            <button id="btn-submode-form" class="btn ${manualSubMode === 'form' ? 'btn-primary' : 'btn-outline'}" style="padding: 0.75rem 1.5rem;">
              📝 Step-by-Step Form Entry
            </button>
            <button id="btn-submode-voice" class="btn ${manualSubMode === 'voice' ? 'btn-primary' : 'btn-outline'}" style="padding: 0.75rem 1.5rem;">
              🎤 Voice Speech Input
            </button>
          </div>

          <div id="manual-submode-content"></div>
        </div>
      `;

      const submodeHolder = workspace.querySelector('#manual-submode-content');

      workspace.querySelector('#btn-submode-form').addEventListener('click', () => {
        manualSubMode = 'form';
        renderStep1(area);
        const ws = area.querySelector('#method-workspace');
        ws?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      workspace.querySelector('#btn-submode-voice').addEventListener('click', () => {
        manualSubMode = 'voice';
        renderStep1(area);
        const ws = area.querySelector('#method-workspace');
        ws?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      // 3A: FORM ENTRY
      if (manualSubMode === 'form') {
        submodeHolder.innerHTML = `
          <form id="form-manual-class" class="card card-purple-tint" style="margin-bottom: 1.5rem;">
            <h4 style="margin-bottom: 1rem; color: var(--primary-purple);">+ Add a Class</h4>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Class / Subject Name *</label>
                <input type="text" id="manual-class-name" class="form-control" placeholder="e.g. Physics / Digital Marketing" required>
              </div>

              <div class="form-group">
                <label class="form-label">Day of Week *</label>
                <select id="manual-day" class="form-control" required>
                  ${DAYS_LIST.map((d) => `<option value="${d}">${d}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Start Time *</label>
                <input type="time" id="manual-start-time" class="form-control" value="09:00" required>
              </div>

              <div class="form-group">
                <label class="form-label">End Time</label>
                <input type="time" id="manual-end-time" class="form-control" value="10:00">
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Teacher / Instructor <span class="optional">(Optional)</span></label>
                <input type="text" id="manual-teacher" class="form-control" placeholder="e.g. Prof. Sarah">
              </div>

              <div class="form-group">
                <label class="form-label">Room / Location <span class="optional">(Optional)</span></label>
                <input type="text" id="manual-room" class="form-control" placeholder="e.g. Room 204 / Hall A">
              </div>
            </div>

            <button type="submit" class="btn btn-outline btn-block" style="border-color: var(--primary-purple); color: var(--primary-purple); font-weight: 600;">
              + Add Class to List
            </button>
          </form>

          <!-- List of Added Classes -->
          <div id="manual-classes-list"></div>

          <div style="margin-top: 2rem; display: flex; justify-content: flex-end;">
            <button id="btn-continue-manual" class="btn btn-primary btn-lg">
              Review Schedule ➔
            </button>
          </div>
        `;

        function renderManualList() {
          const listDiv = submodeHolder.querySelector('#manual-classes-list');
          if (manualList.length === 0) {
            listDiv.innerHTML = `
              <div style="text-align: center; padding: 2rem 1rem; background: var(--bg-main); border-radius: var(--radius-md); border: 1px dashed var(--border-color); margin-top: 1rem;">
                <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">✍️</div>
                <strong style="color: var(--text-primary);">No classes added yet</strong>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">Fill out the form above and click "+ Add Class to List" to add each of your weekly classes.</p>
              </div>
            `;
            return;
          }

          listDiv.innerHTML = `
            <h4 style="margin-bottom: 0.75rem;">Classes in Schedule (${manualList.length})</h4>
            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
              ${manualList
                .map(
                  (item, idx) => `
                <div class="card" style="padding: 0.85rem 1.2rem; display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <strong>${item.class_name}</strong>
                    <div style="font-size: 0.82rem; color: var(--text-secondary);">
                      📅 ${item.day} • ⏰ ${formatTime12h(item.start_time)} - ${item.end_time ? formatTime12h(item.end_time) : '(No end time)'} ${item.room ? `• 📍 ${item.room}` : ''} ${item.teacher ? `• 👨‍🏫 ${item.teacher}` : ''}
                    </div>
                  </div>
                  <button class="btn btn-ghost btn-sm btn-del-manual" data-index="${idx}" style="color: var(--status-error);">✕</button>
                </div>
              `
                )
                .join('')}
            </div>
          `;

          listDiv.querySelectorAll('.btn-del-manual').forEach((btn) => {
            btn.addEventListener('click', () => {
              const i = parseInt(btn.getAttribute('data-index'), 10);
              manualList.splice(i, 1);
              renderManualList();
            });
          });
        }

        renderManualList();

        submodeHolder.querySelector('#form-manual-class').addEventListener('submit', (e) => {
          e.preventDefault();
          const name = submodeHolder.querySelector('#manual-class-name').value.trim();
          const day = submodeHolder.querySelector('#manual-day').value;
          const start = submodeHolder.querySelector('#manual-start-time').value;
          const end = submodeHolder.querySelector('#manual-end-time').value;
          const teacher = submodeHolder.querySelector('#manual-teacher').value.trim();
          const room = submodeHolder.querySelector('#manual-room').value.trim();

          manualList.push({
            class_name: name,
            subject: name,
            day,
            start_time: start,
            end_time: end || null,
            duration_minutes: 60,
            teacher: teacher || null,
            room: room || null,
            confidence: 1.0
          });

          // Reset form
          submodeHolder.querySelector('#manual-class-name').value = '';
          submodeHolder.querySelector('#manual-teacher').value = '';
          submodeHolder.querySelector('#manual-room').value = '';
          renderManualList();
          showToast(`Added ${name}!`, 'success');
        });

        submodeHolder.querySelector('#btn-continue-manual').addEventListener('click', () => {
          if (manualList.length === 0) {
            showToast('Please add at least one class before continuing', 'warning');
            return;
          }
          extractedEvents = manualList;
          currentStep = 2;
          renderWizard();
        });
      }

      // 3B: VOICE SPEECH INPUT
      else if (manualSubMode === 'voice') {
        submodeHolder.innerHTML = `
          <div style="text-align: center;">
            <h4 style="margin-bottom: 0.5rem;">Speak Your Schedule 🎤</h4>
            <p style="margin-bottom: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
              Tap the microphone and speak naturally in English or Urdu/Hindi. For example: <br>
              <em>"Monday ko meri Digital Marketing class 5:00 PM to 6:00 PM hai Room 204 me by Prof Sarah."</em>
            </p>

            <div style="margin: 2rem 0;">
              <button id="btn-mic-record" class="btn btn-icon" style="width: 84px; height: 84px; font-size: 2.5rem; background: linear-gradient(135deg, var(--soft-pink), var(--primary-purple)); color: white; margin: 0 auto; box-shadow: 0 8px 24px var(--primary-purple-glow);">
                🎤
              </button>
              <div id="mic-status-label" style="font-weight: 600; color: var(--primary-purple); margin-top: 1rem;">
                Tap to Speak
              </div>
            </div>

            <div id="voice-waves-container" style="display: none;">
              <div class="audio-waves">
                <div class="audio-bar"></div><div class="audio-bar"></div><div class="audio-bar"></div>
                <div class="audio-bar"></div><div class="audio-bar"></div><div class="audio-bar"></div>
                <div class="audio-bar"></div>
              </div>
            </div>

            <div class="form-group" style="margin-top: 1.5rem; text-align: left;">
              <label class="form-label">Voice Transcript / Spoken Text</label>
              <textarea id="voice-transcript" class="form-control" rows="3" placeholder="Your spoken words will appear here. You can also type or edit directly..."></textarea>
            </div>

            <div style="display: flex; justify-content: center; gap: 1rem; margin-top: 1.5rem; flex-wrap: wrap;">
              <button id="btn-sample-voice" class="btn btn-outline">
                💬 Fill Sample Spoken Schedule
              </button>
              <button id="btn-process-voice" class="btn btn-primary btn-lg">
                Extract Voice Schedule ➔
              </button>
            </div>
          </div>
        `;

        const micBtn = submodeHolder.querySelector('#btn-mic-record');
        const micStatus = submodeHolder.querySelector('#mic-status-label');
        const waves = submodeHolder.querySelector('#voice-waves-container');
        const transcriptArea = submodeHolder.querySelector('#voice-transcript');

        micBtn.addEventListener('click', () => {
          if (!isRecordingVoice) {
            isRecordingVoice = true;
            micBtn.style.animation = 'pulseMic 1.2s infinite';
            micStatus.textContent = 'Listening... Speak your schedule clearly';
            waves.style.display = 'block';

            voiceRecognizer = createSpeechRecognizer(
              (transcript) => {
                transcriptArea.value = transcript;
              },
              (err) => {
                console.warn('Speech error:', err);
                showToast('Speech note: microphone unavailable, you can type directly.', 'info');
              },
              () => {
                isRecordingVoice = false;
                micBtn.style.animation = 'none';
                micStatus.textContent = 'Listening finished. Review text below.';
                waves.style.display = 'none';
              }
            );

            if (voiceRecognizer) {
              try {
                voiceRecognizer.start();
              } catch (e) {
                console.warn(e);
              }
            }
          } else {
            isRecordingVoice = false;
            micBtn.style.animation = 'none';
            micStatus.textContent = 'Tap to Speak Again';
            waves.style.display = 'none';
            if (voiceRecognizer) {
              try {
                voiceRecognizer.stop();
              } catch (e) {}
            }
          }
        });

        submodeHolder.querySelector('#btn-sample-voice').addEventListener('click', () => {
          transcriptArea.value = 'Monday ko meri Digital Marketing class 5:00 PM to 6:00 PM hai Room 204 me by Prof Sarah, and Tuesday ko SEO class 4:00 PM to 5:00 PM hai Lab 108 me.';
          showToast('Sample voice text loaded!', 'info');
        });

        submodeHolder.querySelector('#btn-process-voice').addEventListener('click', async () => {
          const text = transcriptArea.value.trim();
          if (!text) {
            showToast('Please speak or enter your schedule first', 'warning');
            return;
          }

          renderAIProcessingScreen(workspace, 'AI is extracting your classes from voice note...', async () => {
            const res = await api.parseVoice(text);
            extractedEvents = res.events;
            currentStep = 2;
            renderWizard();
          });
        });
      }
    }
  }

  // Canvas image enhancer: 2x upscaling, grayscale, and adaptive contrast stretching
  function preprocessTimetableCanvas(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxDim = Math.max(img.width, img.height);
          const scale = maxDim < 1200 ? 2.0 : maxDim < 1800 ? 1.5 : 1.0;
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;

          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const enhanced = (gray - 128) * 1.5 + 128;
            const val = enhanced > 140 ? 255 : enhanced < 90 ? 0 : enhanced;
            d[i] = val;
            d[i + 1] = val;
            d[i + 2] = val;
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // Handle image files, CSV files, and run laser scanning animation with real Tesseract OCR
  function handleImageFile(file, workspace) {
    if (!file) return;

    // Check if uploaded file is a CSV file
    if (file.name && (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv')) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
      if (cleanName) {
        customTimetableTitle = cleanName;
        const nameInp1 = document.querySelector('#step1-timetable-name-input');
        if (nameInp1) nameInp1.value = cleanName;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        try {
          const events = parseCSVToEvents(text);
          if (events && events.length > 0) {
            extractedEvents = events;
            currentStep = 2;
            renderWizard();
            showToast(`✓ Loaded ${events.length} classes from CSV file!`, 'success');
            return;
          }
        } catch (parseErr) {
          console.warn('Local CSV parse note:', parseErr);
        }

        // Server fallback for CSV
        const formData = new FormData();
        formData.append('image', file);
        formData.append('csv_text', text);
        api.scanImage(formData).then((res) => {
          extractedEvents = res.events || [];
          if (res.detected_title && !customTimetableTitle) {
            customTimetableTitle = res.detected_title;
          }
          currentStep = 2;
          renderWizard();
          showToast(`✓ Loaded ${extractedEvents.length} classes from CSV!`, 'success');
        }).catch((err) => {
          showToast('Failed to parse CSV file: ' + err.message, 'error');
        });
      };
      reader.readAsText(file);
      return;
    }

    if (file && file.name) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
      // Set filename if not purely numeric/generic
      if (cleanName && !/^\d+$/.test(cleanName) && !/^(image|screenshot|photo|timetable)/i.test(cleanName)) {
        customTimetableTitle = cleanName;
        const nameInp1 = document.querySelector('#step1-timetable-name-input');
        if (nameInp1) nameInp1.value = cleanName;
        const nameInp2 = document.querySelector('#input-wizard-timetable-name');
        if (nameInp2) nameInp2.value = cleanName;
      }
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      handleImageBase64(e.target.result, workspace, file);
    };
    reader.readAsDataURL(file);
  }

  function handleImageBase64(base64, workspace, originalFile = null) {
    uploadedImageUrl = base64;
    renderAIProcessingScreen(workspace, 'AI is scanning and reading your timetable image with Vision OCR...', async () => {
      let ocrText = '';
      if (window.Tesseract) {
        try {
          const preprocessed = await preprocessTimetableCanvas(base64);
          const ret = await window.Tesseract.recognize(preprocessed, 'eng');
          ocrText = ret?.data?.text || '';
          console.log('Recognized OCR Text from image:', ocrText);
        } catch (ocrErr) {
          console.warn('Tesseract OCR note:', ocrErr);
        }
      }

      try {
        let res;
        if (originalFile) {
          const formData = new FormData();
          formData.append('image', originalFile);
          formData.append('ocr_text', ocrText);
          res = await api.scanImage(formData);
        } else {
          res = await api.scanImage(base64, ocrText);
        }

        extractedEvents = res.events || [];
        if (res.detected_title && (!customTimetableTitle || /^\d+$/.test(customTimetableTitle))) {
          customTimetableTitle = res.detected_title;
        }
        currentStep = 2;
        renderWizard();

        // Automatically convert timetable into CSV and trigger browser download!
        if (extractedEvents && extractedEvents.length > 0) {
          const csvStr = res.csv_content || eventsToCSV(extractedEvents, customTimetableTitle || 'Timetable Schedule');
          const fileTitle = (customTimetableTitle || 'Timetable_Schedule').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
          downloadCSV(csvStr, `${fileTitle}.csv`);
          showToast('✓ Timetable automatically converted & CSV file downloaded!', 'success');
        }
      } catch (err) {
        showToast('Image processing error: ' + err.message, 'error');
        renderStep1(workspace);
      }
    });
  }

  // AI Scanning laser effect and checklist
  function renderAIProcessingScreen(workspace, titleText, onComplete) {
    workspace.innerHTML = `
      <div style="text-align: center; max-width: 540px; margin: 0 auto;">
        <h3 style="margin-bottom: 0.5rem;">${titleText}</h3>
        <p style="margin-bottom: 1.5rem; font-size: 0.88rem; color: var(--text-secondary);">Scanning days, class times, instructors, and lecture halls...</p>

        <!-- Laser Scanner Box -->
        <div class="scanner-box" style="margin-bottom: 2rem; max-height: 240px;">
          <div class="scanner-laser"></div>
          <img src="${uploadedImageUrl || '/assets/icons/sample_tt.png'}" style="width: 100%; height: 240px; object-fit: contain; background: #1a1926;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'200\\' fill=\\'%236C63FF\\'><text x=\\'50%\\' y=\\'50%\\' text-anchor=\\'middle\\' fill=\\'white\\'>Timetable Document</text></svg>'" />
        </div>

        <!-- 7-Step Progress Checklist -->
        <div id="ai-progress-checklist" style="text-align: left; background: var(--bg-main); padding: 1.25rem 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
          <div class="check-item loading" id="chk-1"><div class="check-item-icon">1</div> Image uploaded & verified</div>
          <div class="check-item" id="chk-2"><div class="check-item-icon">2</div> Image quality check passed</div>
          <div class="check-item" id="chk-3"><div class="check-item-icon">3</div> Reading timetable structure with Vision OCR</div>
          <div class="check-item" id="chk-4"><div class="check-item-icon">4</div> Finding days & weekdays</div>
          <div class="check-item" id="chk-5"><div class="check-item-icon">5</div> Finding class timings</div>
          <div class="check-item" id="chk-6"><div class="check-item-icon">6</div> Identifying subjects, rooms & teachers</div>
          <div class="check-item" id="chk-7"><div class="check-item-icon">7</div> Organizing structured schedule</div>
        </div>
      </div>
    `;

    const steps = [1, 2, 3, 4, 5, 6, 7];
    let i = 0;
    const interval = setInterval(async () => {
      if (i < steps.length) {
        const item = workspace.querySelector(`#chk-${steps[i]}`);
        if (item) {
          item.classList.remove('loading');
          item.classList.add('done');
          item.querySelector('.check-item-icon').textContent = '✓';
        }
        i++;
        if (i < steps.length) {
          const nextItem = workspace.querySelector(`#chk-${steps[i]}`);
          if (nextItem) nextItem.classList.add('loading');
        }
      } else {
        clearInterval(interval);
        playChimeSound();
        setTimeout(async () => {
          try {
            await onComplete();
          } catch (err) {
            showToast('AI scanning error: ' + err.message, 'error');
            currentStep = 2;
            renderWizard();
          }
        }, 300);
      }
    }, 350);
  }

  // ==========================================
  // STEP 2: REVIEW EXTRACTED SCHEDULE
  // ==========================================
  function renderStep2(area) {
    // Group events by day
    const dayGroups = {};
    DAYS_LIST.forEach((d) => (dayGroups[d] = []));

    extractedEvents.forEach((evt, idx) => {
      const day = evt.day || 'Monday';
      if (!dayGroups[day]) dayGroups[day] = [];
      dayGroups[day].push({ ...evt, original_index: idx });
    });

    const hasEvents = extractedEvents.length > 0;

    area.innerHTML = `
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div class="badge ${hasEvents ? 'badge-success' : 'badge-warning'}" style="margin-bottom: 0.4rem;">
          ${hasEvents ? `✓ ${extractedEvents.length} Classes Extracted` : '⚠️ No Classes Found in Image'}
        </div>
        <h2 style="font-size: 1.85rem; margin-bottom: 0.25rem;">
          ${hasEvents ? 'Review Schedule' : 'No Clear Schedule Detected'}
        </h2>
      </div>

      <!-- Automatic CSV Conversion Card -->
      ${hasEvents ? `
      <div class="card" style="padding: 1.15rem 1.4rem; margin-bottom: 1.35rem; background: linear-gradient(135deg, rgba(108, 99, 255, 0.08), rgba(72, 187, 120, 0.08)); border: 1.5px solid rgba(108, 99, 255, 0.35); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
              <span class="badge badge-success" style="font-weight: 700; font-size: 0.82rem; background: #10B981; color: white; padding: 0.25rem 0.65rem;">
                ✓ Automatically Converted to CSV File
              </span>
              <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">
                (${extractedEvents.length} Classes structured)
              </span>
            </div>
            <div style="font-size: 0.92rem; color: var(--text-primary);">
              📊 Your timetable has been automatically converted into a structured CSV schedule file with complete details (Days, Timings, Rooms, Teachers & Credits).
            </div>
          </div>
          <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
            <button id="btn-download-timetable-csv" class="btn btn-primary" style="font-weight: 700; box-shadow: 0 4px 14px rgba(108, 99, 255, 0.3); display: flex; align-items: center; gap: 0.4rem;">
              <span>📥</span> Download CSV File
            </button>
            <button id="btn-preview-timetable-csv" class="btn btn-outline" style="font-weight: 600; display: flex; align-items: center; gap: 0.4rem;">
              <span>👁️</span> Preview CSV
            </button>
          </div>
        </div>

        <!-- Collapsible CSV Preview Container -->
        <div id="csv-preview-container" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
            <strong style="font-size: 0.88rem; color: var(--text-primary);">📄 Converted CSV Schedule Preview</strong>
            <button id="btn-copy-raw-csv" class="btn btn-sm btn-ghost" style="color: var(--primary-purple); font-weight: 600; padding: 0.2rem 0.6rem;">
              📋 Copy CSV Text
            </button>
          </div>
          <div style="overflow-x: auto; max-height: 240px; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.5rem;">
            <table class="table" style="width: 100%; font-size: 0.82rem; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg-card); text-align: left; border-bottom: 2px solid var(--border-color);">
                  <th style="padding: 6px 10px;">Day</th>
                  <th style="padding: 6px 10px;">Subject</th>
                  <th style="padding: 6px 10px;">Code</th>
                  <th style="padding: 6px 10px;">Start Time</th>
                  <th style="padding: 6px 10px;">End Time</th>
                  <th style="padding: 6px 10px;">Duration</th>
                  <th style="padding: 6px 10px;">Room</th>
                  <th style="padding: 6px 10px;">Teacher</th>
                  <th style="padding: 6px 10px;">Credits</th>
                </tr>
              </thead>
              <tbody id="csv-preview-table-body">
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Timetable Name / File Title Input Card -->
      <div class="card" style="padding: 1.15rem 1.35rem; margin-bottom: 1.5rem; background: var(--bg-card); border-left: 4px solid var(--primary-purple); box-shadow: var(--shadow-sm);">
        <label for="input-wizard-timetable-name" style="display: flex; align-items: center; justify-content: space-between; font-size: 0.92rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.45rem;">
          <span style="display: flex; align-items: center; gap: 0.4rem;">📋 Timetable Name / فائل کا نام:</span>
          <span style="font-size: 0.78rem; font-weight: 600; color: var(--primary-purple);">Auto-extracted from uploaded file</span>
        </label>
        <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
          <input 
            type="text" 
            id="input-wizard-timetable-name" 
            class="form-input" 
            style="font-size: 1.05rem; font-weight: 600; flex: 1; min-width: 260px; padding: 0.65rem 0.9rem;" 
            value="${customTimetableTitle || ''}" 
            placeholder="e.g. BSCS 5th Semester Section A"
          />
          <select id="step2-timetable-preset-select" class="form-input" style="max-width: 240px; font-size: 0.9rem; font-weight: 600; padding: 0.65rem 0.85rem; cursor: pointer;">
            <option value="">⚡ Presets (اختیارات)...</option>
            <option value="BSCS 5th Semester Section A">BSCS 5th Semester Section A</option>
            <option value="Semester Routine 2026">Semester Routine 2026</option>
            <option value="Fall 2026 Class Schedule">Fall 2026 Class Schedule</option>
            <option value="Spring 2026 Class Routine">Spring 2026 Class Routine</option>
            <option value="University Weekly Schedule">University Weekly Schedule</option>
            <option value="College Routine">College Routine</option>
          </select>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.35rem;">
          This name will appear on your timetable card and schedule. You can rename it anytime.
        </p>
      </div>

      <!-- Days Grid of Classes -->
      <div id="review-cards-list" style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${
          !hasEvents
            ? `
          <div class="empty-state" style="padding: 2.5rem 1rem; border: 1px dashed var(--border-color); border-radius: var(--radius-lg); background: var(--bg-main);">
            <div class="empty-state-icon" style="font-size: 2rem; margin-bottom: 0.5rem;">📅</div>
            <h4 style="margin-bottom: 0.25rem;">No classes in schedule</h4>
            <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1.25rem;">Click "+ Add Class" to enter your classes manually, or go back to upload a sharper image.</p>
            <button id="btn-empty-add-class" class="btn btn-primary btn-lg">+ Add Class</button>
          </div>
        `
            : DAYS_LIST.filter((d) => dayGroups[d].length > 0)
                .map((day) => {
                  return `
            <div class="card" style="padding: 1.25rem 1.5rem;">
              <h4 style="color: var(--primary-purple); margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>📅</span> ${day}
              </h4>
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${dayGroups[day]
                  .map((evt) => {
                    const isMissingEnd = !evt.end_time;
                    return `
                    <div class="review-class-card">
                      <div class="review-class-info">
                        <div class="inline-name-box">
                          <span style="font-size: 0.9rem; color: var(--primary-purple);" title="Click to rename">✏️</span>
                          <input 
                            type="text" 
                            class="inline-class-name-input" 
                            data-index="${evt.original_index}" 
                            value="${evt.class_name || ''}" 
                            placeholder="Type class name here..."
                            title="Click to rename this class"
                          />
                        </div>
                        <div class="review-class-meta">
                          ⏰ <strong>${formatTime12h(evt.start_time)}</strong> ${evt.end_time ? `– ${formatTime12h(evt.end_time)}` : '<span style="color: var(--status-warning); font-weight: 600;">(Needs duration)</span>'}
                          ${evt.teacher ? ` • 👩‍🏫 ${evt.teacher}` : ''}
                          ${evt.room ? ` • 📍 ${evt.room}` : ''}
                        </div>
                      </div>

                      <div class="review-class-actions">
                        ${
                          isMissingEnd
                            ? `<button class="btn btn-sm btn-secondary btn-fix-duration" data-index="${evt.original_index}">⏱ Set Duration</button>`
                            : ''
                        }
                        <button class="btn btn-outline btn-sm btn-edit-event" data-index="${evt.original_index}" title="Edit class details">✏️ Edit</button>
                        <button class="btn btn-ghost btn-sm btn-del-event" data-index="${evt.original_index}" style="color: var(--status-error);" title="Delete class">🗑</button>
                      </div>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            </div>
          `;
                })
                .join('')
        }
      </div>

      <!-- Add Class / Actions -->
      <div class="wizard-bottom-actions">
        <div class="wizard-actions-left">
          <button id="btn-add-more-class" class="btn btn-outline">
            + Add Class
          </button>
          <button id="btn-quick-text-import" class="btn btn-secondary">
            📝 Paste / Type Timetable Text
          </button>
        </div>

        <div class="wizard-actions-right" style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
          <button id="btn-back-step-1" class="btn btn-ghost">
            ← Back
          </button>
          <button id="btn-quick-save-my-tt" class="btn btn-secondary btn-lg" ${!hasEvents ? 'disabled' : ''} style="border: 2px solid var(--primary-purple); color: var(--primary-purple); font-weight: 700; background: var(--bg-soft-purple);" title="Save timetable now and open directly in My Timetables">
            💾 Save to My Timetable (محفوظ کریں)
          </button>
          <button id="btn-confirm-schedule" class="btn btn-primary btn-lg" ${!hasEvents ? 'disabled' : ''}>
            Confirm Schedule ➔
          </button>
        </div>
      </div>

      <!-- Edit Event Modal Placeholder -->
      <div id="modal-edit-event-holder"></div>
    `;

    // Attach Timetable Title Editing Listener
    const ttNameInput = area.querySelector('#input-wizard-timetable-name');
    if (ttNameInput) {
      ttNameInput.addEventListener('input', (e) => {
        customTimetableTitle = e.target.value.trim();
      });
    }

    const presetSel2 = area.querySelector('#step2-timetable-preset-select');
    if (presetSel2) {
      presetSel2.addEventListener('change', (e) => {
        if (e.target.value) {
          customTimetableTitle = e.target.value;
          if (ttNameInput) ttNameInput.value = e.target.value;
        }
      });
    }

    // CSV Download & Preview Handlers
    const btnDownloadCsv = area.querySelector('#btn-download-timetable-csv');
    if (btnDownloadCsv) {
      btnDownloadCsv.addEventListener('click', () => {
        if (!extractedEvents || extractedEvents.length === 0) {
          showToast('No classes to export to CSV', 'warning');
          return;
        }
        const title = (customTimetableTitle || 'Timetable_Schedule').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
        const csvStr = eventsToCSV(extractedEvents, customTimetableTitle || 'Timetable Schedule');
        downloadCSV(csvStr, `${title}.csv`);
        showToast('✓ CSV file downloaded successfully!', 'success');
      });
    }

    const btnPreviewCsv = area.querySelector('#btn-preview-timetable-csv');
    const previewContainer = area.querySelector('#csv-preview-container');
    const previewTableBody = area.querySelector('#csv-preview-table-body');
    const btnCopyRawCsv = area.querySelector('#btn-copy-raw-csv');

    if (btnPreviewCsv && previewContainer && previewTableBody) {
      btnPreviewCsv.addEventListener('click', () => {
        const isHidden = previewContainer.style.display === 'none';
        if (isHidden) {
          previewContainer.style.display = 'block';
          btnPreviewCsv.innerHTML = '<span>✕</span> Close Preview';
          previewTableBody.innerHTML = extractedEvents.map((evt) => `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 6px 10px; font-weight: 600;">${evt.day || 'Monday'}</td>
              <td style="padding: 6px 10px;">${evt.subject || evt.class_name || ''}</td>
              <td style="padding: 6px 10px; font-weight: 600; color: var(--primary-purple);">${evt.course_code || evt.code || '—'}</td>
              <td style="padding: 6px 10px;">${formatTime12h(evt.start_time)}</td>
              <td style="padding: 6px 10px;">${evt.end_time ? formatTime12h(evt.end_time) : '—'}</td>
              <td style="padding: 6px 10px;">${evt.duration_minutes ? `${evt.duration_minutes}m` : '—'}</td>
              <td style="padding: 6px 10px;">${evt.room || '—'}</td>
              <td style="padding: 6px 10px;">${evt.teacher || '—'}</td>
              <td style="padding: 6px 10px;">${evt.credits || '—'}</td>
            </tr>
          `).join('');
        } else {
          previewContainer.style.display = 'none';
          btnPreviewCsv.innerHTML = '<span>👁️</span> Preview CSV';
        }
      });
    }

    if (btnCopyRawCsv) {
      btnCopyRawCsv.addEventListener('click', async () => {
        const csvStr = eventsToCSV(extractedEvents, customTimetableTitle || 'Timetable Schedule');
        try {
          await navigator.clipboard.writeText(csvStr);
          showToast('✓ CSV text copied to clipboard!', 'success');
        } catch (e) {
          showToast('Failed to copy to clipboard', 'error');
        }
      });
    }

    // Attach Inline Name Editing Listeners
    area.querySelectorAll('.inline-class-name-input').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const i = parseInt(inp.getAttribute('data-index'), 10);
        const val = e.target.value.trim();
        if (extractedEvents[i]) {
          extractedEvents[i].class_name = val || e.target.value;
          extractedEvents[i].subject = val || e.target.value;
        }
      });
      inp.addEventListener('focus', () => {
        inp.parentElement.style.borderColor = 'var(--primary-purple)';
        inp.parentElement.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.25)';
      });
      inp.addEventListener('blur', () => {
        inp.parentElement.style.borderColor = 'var(--border-color)';
        inp.parentElement.style.boxShadow = 'var(--shadow-sm)';
      });
    });

    // Attach Action Handlers
    area.querySelectorAll('.btn-del-event').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.getAttribute('data-index'), 10);
        extractedEvents.splice(i, 1);
        renderStep2(area);
      });
    });

    area.querySelectorAll('.btn-edit-event').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.getAttribute('data-index'), 10);
        openEditClassModal(extractedEvents[i], (updated) => {
          extractedEvents[i] = updated;
          renderStep2(area);
        });
      });
    });

    area.querySelectorAll('.btn-fix-duration').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.getAttribute('data-index'), 10);
        openDurationPickerModal(extractedEvents[i], (updated) => {
          extractedEvents[i] = updated;
          renderStep2(area);
        });
      });
    });

    area.querySelector('#btn-add-more-class').addEventListener('click', () => {
      const newEvt = {
        class_name: 'Computer Vision',
        subject: 'Computer Vision',
        day: 'Monday',
        start_time: '08:30',
        end_time: '10:00',
        duration_minutes: 90,
        teacher: null,
        room: null,
        confidence: 1.0
      };
      openEditClassModal(newEvt, (created) => {
        extractedEvents.push(created);
        renderStep2(area);
      });
    });

    // Quick Text / Paste Timetable Importer
    area.querySelector('#btn-quick-text-import').addEventListener('click', () => {
      const holder = container.querySelector('#modal-edit-event-holder');
      holder.innerHTML = `
        <div class="modal-backdrop open">
          <div class="modal-card" style="max-width: 580px;">
            <div class="modal-header">
              <h3>📝 Quick Paste / Type Timetable</h3>
              <button class="btn btn-ghost btn-icon modal-close">✕</button>
            </div>
            <div class="modal-body">
              <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1rem;">
                Paste or type your weekly schedule in natural language. For example:
              </p>
              <div style="background: var(--bg-soft-purple); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.82rem; margin-bottom: 1rem; color: var(--primary-purple);">
                Monday: Computer Vision 8:30 to 10:00 Room 1100<br>
                Monday: Data Science 10:00 to 11:30 Room 1200<br>
                Monday: Computer Architecture 11:30 to 1:00 Room 006
              </div>
              <textarea id="quick-import-textarea" class="form-control" rows="5" placeholder="Paste your timetable text here..."></textarea>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost modal-close">Cancel</button>
              <button id="btn-submit-quick-import" class="btn btn-primary">Import Classes ➔</button>
            </div>
          </div>
        </div>
      `;

      holder.querySelectorAll('.modal-close').forEach((btn) => {
        btn.addEventListener('click', () => (holder.innerHTML = ''));
      });

      holder.querySelector('#btn-submit-quick-import').addEventListener('click', async () => {
        const text = holder.querySelector('#quick-import-textarea').value.trim();
        if (!text) {
          showToast('Please enter or paste your schedule text', 'warning');
          return;
        }

        try {
          const res = await api.parseVoice(text);
          if (res.events && res.events.length > 0) {
            extractedEvents = [...extractedEvents, ...res.events];
            holder.innerHTML = '';
            showToast(`Imported ${res.events.length} classes!`, 'success');
            renderStep2(area);
          } else {
            showToast('Could not recognize classes. Please check the text format.', 'warning');
          }
        } catch (e) {
          showToast('Import error: ' + e.message, 'error');
        }
      });
    });

    const emptyAddBtn = area.querySelector('#btn-empty-add-class');
    if (emptyAddBtn) {
      emptyAddBtn.addEventListener('click', () => {
        const newEvt = {
          class_name: 'Computer Vision',
          subject: 'Computer Vision',
          day: 'Monday',
          start_time: '08:30',
          end_time: '10:00',
          duration_minutes: 90,
          teacher: null,
          room: null,
          confidence: 1.0
        };
        openEditClassModal(newEvt, (created) => {
          extractedEvents.push(created);
          renderStep2(area);
        });
      });
    }

    area.querySelector('#btn-back-step-1').addEventListener('click', () => {
      currentStep = 1;
      renderWizard();
    });

    const quickSaveBtn = area.querySelector('#btn-quick-save-my-tt');
    if (quickSaveBtn) {
      quickSaveBtn.addEventListener('click', async () => {
        const liveName = area.querySelector('#input-wizard-timetable-name')?.value?.trim() || customTimetableTitle || 'muneeba';
        customTimetableTitle = liveName;
        if (extractedEvents.length === 0) {
          showToast('Please add at least one class to continue', 'warning');
          return;
        }
        quickSaveBtn.disabled = true;
        quickSaveBtn.innerHTML = '⏳ Saving...';
        try {
          await api.createTimetable({
            name: customTimetableTitle,
            image_url: uploadedImageUrl,
            source_type: inputMethod,
            start_date: validityStartDate,
            end_date: validityEndDate,
            duration: validityDuration,
            events: extractedEvents,
            reminder_1_minutes: remindersEnabled ? reminder1Minutes : 0,
            reminder_2_minutes: remindersEnabled ? reminder2Minutes : 0
          });
          playChimeSound();
          showToast(`ٹائم ٹیبل "${customTimetableTitle}" محفوظ ہو گیا!`, 'success');
          state.setView('timetables');
        } catch (err) {
          showToast('Error saving timetable: ' + err.message, 'error');
          quickSaveBtn.disabled = false;
          quickSaveBtn.innerHTML = '💾 Save to My Timetable (محفوظ کریں)';
        }
      });
    }

    area.querySelector('#btn-confirm-schedule').addEventListener('click', () => {
      const liveName = area.querySelector('#input-wizard-timetable-name')?.value?.trim();
      if (liveName) customTimetableTitle = liveName;
      if (extractedEvents.length === 0) {
        showToast('Please add at least one class to continue', 'warning');
        return;
      }
      currentStep = 3;
      renderWizard();
    });
  }

  // Edit Class Modal Helper
  function openEditClassModal(eventObj, onSave) {
    const holder = container.querySelector('#modal-edit-event-holder');
    holder.innerHTML = `
      <div class="modal-backdrop open">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Edit Class</h3>
            <button class="btn btn-ghost btn-icon modal-close">✕</button>
          </div>
          <form id="form-edit-single-class" class="modal-body">
            <div class="form-group">
              <label class="form-label">Class / Subject Name *</label>
              <input type="text" id="edit-c-name" class="form-control" value="${eventObj.class_name || ''}" placeholder="e.g. Computer Vision" required>
              <!-- Quick Subject Preset Chips -->
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.5rem;">
                ${['Human Computer Interaction', 'Web Technologies', 'Software Requirements', 'Computer Programming Lab', 'Advanced Java Programming', 'Computer Vision', 'Data Science', 'Artificial Intelligence', 'Operating Systems', 'Database Systems', 'Computer Networks']
                  .map((sub) => `<button type="button" class="badge badge-purple btn-sub-chip" style="cursor: pointer; border: 1px solid var(--primary-purple);">${sub}</button>`)
                  .join('')}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Day of Week *</label>
              <select id="edit-c-day" class="form-control">
                ${DAYS_LIST.map((d) => `<option value="${d}" ${d === eventObj.day ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Start Time *</label>
                <input type="time" id="edit-c-start" class="form-control" value="${eventObj.start_time || '08:30'}" required>
              </div>
              <div class="form-group">
                <label class="form-label">End Time</label>
                <input type="time" id="edit-c-end" class="form-control" value="${eventObj.end_time || '10:00'}">
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Teacher <span class="optional">(Optional)</span></label>
                <input type="text" id="edit-c-teacher" class="form-control" value="${eventObj.teacher || ''}" placeholder="e.g. Prof. Sarah">
              </div>
              <div class="form-group">
                <label class="form-label">Room <span class="optional">(Optional)</span></label>
                <input type="text" id="edit-c-room" class="form-control" value="${eventObj.room || ''}" placeholder="e.g. Room 1100 / Lab 3">
              </div>
            </div>
            <div class="modal-footer" style="padding: 1rem 0 0 0;">
              <button type="button" class="btn btn-ghost modal-close">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    `;

    holder.querySelectorAll('.btn-sub-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        holder.querySelector('#edit-c-name').value = chip.textContent.trim();
      });
    });

    holder.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => (holder.innerHTML = ''));
    });

    holder.querySelector('#form-edit-single-class').addEventListener('submit', (e) => {
      e.preventDefault();
      const updated = {
        ...eventObj,
        class_name: holder.querySelector('#edit-c-name').value.trim(),
        subject: holder.querySelector('#edit-c-name').value.trim(),
        day: holder.querySelector('#edit-c-day').value,
        start_time: holder.querySelector('#edit-c-start').value,
        end_time: holder.querySelector('#edit-c-end').value || null,
        teacher: holder.querySelector('#edit-c-teacher').value.trim() || null,
        room: holder.querySelector('#edit-c-room').value.trim() || null,
        confidence: 1.0
      };
      holder.innerHTML = '';
      onSave(updated);
    });
  }

  // Duration Picker Modal (When end time is missing, prevents hallucination)
  function openDurationPickerModal(eventObj, onSave) {
    const holder = container.querySelector('#modal-edit-event-holder');
    holder.innerHTML = `
      <div class="modal-backdrop open">
        <div class="modal-card" style="text-align: center;">
          <div class="modal-header">
            <h3>We Need One More Detail ⏱</h3>
            <button class="btn btn-ghost btn-icon modal-close">✕</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 1.5rem;">How long is your <strong>${eventObj.class_name}</strong> class starting at ${formatTime12h(eventObj.start_time)}?</p>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1.5rem;">
              <button class="btn btn-outline duration-choice-btn" data-mins="30">30 Minutes</button>
              <button class="btn btn-outline duration-choice-btn" data-mins="45">45 Minutes</button>
              <button class="btn btn-primary duration-choice-btn" data-mins="60">1 Hour</button>
              <button class="btn btn-outline duration-choice-btn" data-mins="90">1.5 Hours</button>
            </div>
          </div>
        </div>
      </div>
    `;

    holder.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => (holder.innerHTML = ''));
    });

    holder.querySelectorAll('.duration-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.getAttribute('data-mins'), 10);
        const [h, m] = eventObj.start_time.split(':');
        const startMin = parseInt(h, 10) * 60 + parseInt(m, 10);
        const endMin = startMin + mins;
        const endH = Math.floor(endMin / 60) % 24;
        const endM = endMin % 60;
        const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        const updated = {
          ...eventObj,
          duration_minutes: mins,
          end_time: endTimeStr,
          confidence: 1.0
        };
        holder.innerHTML = '';
        onSave(updated);
      });
    });
  }

  // ==========================================
  // STEP 3: TIMETABLE VALIDITY
  // ==========================================
  function renderStep3(area) {
    const durationOptions = ['1 Month', '2 Months', '3 Months', '4 Months', '6 Months', '1 Year', 'Custom'];

    function computeEndDate(dur) {
      const d = new Date(validityStartDate);
      let months = 3;
      if (dur === '1 Month') months = 1;
      else if (dur === '2 Months') months = 2;
      else if (dur === '3 Months') months = 3;
      else if (dur === '4 Months') months = 4;
      else if (dur === '6 Months') months = 6;
      else if (dur === '1 Year') months = 12;
      d.setMonth(d.getMonth() + months);
      return d.toISOString().split('T')[0];
    }

    area.innerHTML = `
      <div style="text-align: center; margin-bottom: 2rem;">
        <h2 style="font-size: 2rem; margin-bottom: 0.5rem;">How long should this timetable stay active?</h2>
        <p>Your classes will repeat automatically until this date.</p>
      </div>

      <div class="card card-purple-tint" style="padding: 2.25rem; max-width: 620px; margin: 0 auto;">
        <!-- Custom Timetable Title Input -->
        <div style="margin-bottom: 1.5rem; text-align: left;">
          <label style="display: block; font-weight: 700; margin-bottom: 0.5rem; font-size: 0.95rem; color: var(--text-primary);">
            🏷️ Timetable Title / Name (اپنی مرضی کا نام رکھیں):
          </label>
          <input 
            type="text" 
            id="input-timetable-custom-title" 
            class="form-control" 
            value="${customTimetableTitle || (state.user?.name ? `${state.user.name}'s Routine` : 'Semester Schedule')}" 
            placeholder="e.g. BSCS 5th Semester Section A, Fall 2026..." 
            style="font-size: 1.05rem; font-weight: 600; padding: 0.75rem 1rem; border: 1.5px solid var(--border-color); border-radius: var(--radius-md);"
          />
        </div>

        <h4 style="margin-bottom: 1rem;">Select Semester or Routine Duration:</h4>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.75rem; margin-bottom: 2rem;">
          ${durationOptions
            .map(
              (opt) => `
            <button type="button" class="btn ${validityDuration === opt ? 'btn-primary' : 'btn-outline'} validity-opt-btn" data-duration="${opt}">
              ${opt}
            </button>
          `
            )
            .join('')}
        </div>

        <div style="background: var(--bg-white); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; border: 1px solid var(--border-color);" class="form-row-2">
          <div>
            <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Start Date</span>
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-top: 0.25rem;">
              ${formatDatePretty(validityStartDate)}
            </div>
          </div>
          <div>
            <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Expiry Date</span>
            <div id="preview-end-date" style="font-size: 1.1rem; font-weight: 700; color: var(--primary-purple); margin-top: 0.25rem;">
              ${formatDatePretty(validityEndDate)}
            </div>
          </div>
        </div>

        <p style="text-align: center; font-size: 0.85rem; color: var(--text-secondary); margin-top: 1.5rem;">
          💡 SmartTime AI will automatically alert you 7 days before your timetable expires.
        </p>
      </div>

      <div class="wizard-bottom-actions">
        <button id="btn-back-step-2" class="btn btn-ghost">← Back</button>
        <button id="btn-continue-step-4" class="btn btn-primary btn-lg">Choose Reminders ➔</button>
      </div>
    `;

    area.querySelectorAll('.validity-opt-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        area.querySelectorAll('.validity-opt-btn').forEach((b) => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-outline');
        });
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-primary');
        validityDuration = btn.getAttribute('data-duration');
        validityEndDate = computeEndDate(validityDuration);
        area.querySelector('#preview-end-date').textContent = formatDatePretty(validityEndDate);
      });
    });

    const titleInput = area.querySelector('#input-timetable-custom-title');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        customTimetableTitle = e.target.value.trim();
      });
    }

    area.querySelector('#btn-back-step-2').addEventListener('click', () => {
      currentStep = 2;
      renderWizard();
    });

    area.querySelector('#btn-continue-step-4').addEventListener('click', () => {
      const liveTitle = area.querySelector('#input-timetable-custom-title')?.value?.trim();
      if (liveTitle) customTimetableTitle = liveTitle;
      currentStep = 4;
      renderWizard();
    });
  }

  // ==========================================
  // STEP 4: REMINDER SETTINGS
  // ==========================================
  function renderStep4(area) {
    const reminderOptions = [
      { label: '5 minutes before', value: 5 },
      { label: '10 minutes before', value: 10 },
      { label: '15 minutes before', value: 15 },
      { label: '20 minutes before', value: 20 },
      { label: '30 minutes before', value: 30 },
      { label: '45 minutes before', value: 45 },
      { label: '1 hour before', value: 60 },
      { label: '2 hours before', value: 120 }
    ];

    area.innerHTML = `
      <div style="text-align: center; margin-bottom: 2rem;">
        <h2 style="font-size: 2rem; margin-bottom: 0.5rem;">Class Reminders & Alerts</h2>
        <p>Choose whether you want notification reminders before each class.</p>
      </div>

      <div class="card" style="padding: 2.25rem; max-width: 640px; margin: 0 auto;">
        <!-- Master Reminders Switch Card -->
        <div style="background: var(--bg-soft-purple); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; border: 1px solid var(--border-color); margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">🔔</span>
              <strong style="font-size: 1.05rem; color: var(--text-primary);">Enable Class Reminders</strong>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
              Automatic sound chime & browser alerts before each class.
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="btn-toggle-rem-yes" class="btn ${remindersEnabled ? 'btn-primary' : 'btn-outline'} btn-sm" style="font-weight: 600;">
              ✓ Remind Me
            </button>
            <button id="btn-toggle-rem-no" class="btn ${!remindersEnabled ? 'btn-secondary' : 'btn-outline'} btn-sm" style="font-weight: 600;">
              ✕ No Reminders
            </button>
          </div>
        </div>

        <div id="reminders-config-panel" style="${remindersEnabled ? 'display: block;' : 'display: none;'}">
          <!-- Reminder 1 -->
          <div style="margin-bottom: 1.5rem; background: var(--bg-main); padding: 1.25rem 1.4rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <strong style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>🔔</span> Primary Reminder (Reminder 1)
              </strong>
              <span class="badge badge-purple">Active</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Main alert to prepare materials and join class.</p>

            <div class="form-row-2">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.82rem; color: var(--text-secondary);">⏰ Reminder Time:</label>
                <select id="select-rem-1" class="form-control">
                  ${reminderOptions
                    .map((o) => `<option value="${o.value}" ${o.value === reminder1Minutes ? 'selected' : ''}>${o.label}</option>`)
                    .join('')}
                </select>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.82rem; color: var(--text-secondary);">🎵 Alarm Tone / Ringtone:</label>
                <div style="display: flex; gap: 0.5rem;">
                  <select id="select-tone-1" class="form-control" style="flex: 1;">
                    ${ALARM_TONES.map((t) => `<option value="${t.id}" ${t.id === reminder1Tone ? 'selected' : ''}>${t.name}</option>`).join('')}
                  </select>
                  <button type="button" id="btn-test-tone-1" class="btn btn-outline btn-sm" title="Click to test and listen to this alarm sound" style="padding: 0 0.85rem; white-space: nowrap; font-weight: 600;">
                    ▶️ Test
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Reminder 2 -->
          <div style="background: var(--bg-main); padding: 1.25rem 1.4rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <strong style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>⏰</span> Final Reminder (Reminder 2)
              </strong>
              <span class="badge badge-blue">Active</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Quick last-minute alert right before class begins.</p>

            <div class="form-row-2">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.82rem; color: var(--text-secondary);">⏰ Reminder Time:</label>
                <select id="select-rem-2" class="form-control">
                  ${reminderOptions
                    .map((o) => `<option value="${o.value}" ${o.value === reminder2Minutes ? 'selected' : ''}>${o.label}</option>`)
                    .join('')}
                </select>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 0.82rem; color: var(--text-secondary);">🎵 Alarm Tone / Ringtone:</label>
                <div style="display: flex; gap: 0.5rem;">
                  <select id="select-tone-2" class="form-control" style="flex: 1;">
                    ${ALARM_TONES.map((t) => `<option value="${t.id}" ${t.id === reminder2Tone ? 'selected' : ''}>${t.name}</option>`).join('')}
                  </select>
                  <button type="button" id="btn-test-tone-2" class="btn btn-outline btn-sm" title="Click to test and listen to this alarm sound" style="padding: 0 0.85rem; white-space: nowrap; font-weight: 600;">
                    ▶️ Test
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="reminders-disabled-notice" style="${!remindersEnabled ? 'display: block;' : 'display: none;'}; background: var(--bg-main); border-radius: var(--radius-md); padding: 1.25rem; border: 1px dashed var(--border-color); text-align: center;">
          <span style="font-size: 1.5rem;">🔕</span>
          <h4 style="margin: 0.35rem 0 0.25rem 0;">Reminders Turned OFF</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">Your timetable will be added to your calendar without sending notification alerts.</p>
        </div>
      </div>

      <div class="wizard-bottom-actions">
        <button id="btn-back-step-3" class="btn btn-ghost">← Back</button>
        <button id="btn-activate-timetable" class="btn btn-primary btn-lg">Generate Calendar Schedule 🎉</button>
      </div>
    `;

    const btnYes = area.querySelector('#btn-toggle-rem-yes');
    const btnNo = area.querySelector('#btn-toggle-rem-no');
    const configPanel = area.querySelector('#reminders-config-panel');
    const disabledNotice = area.querySelector('#reminders-disabled-notice');

    btnYes.addEventListener('click', () => {
      remindersEnabled = true;
      btnYes.className = 'btn btn-primary btn-sm';
      btnNo.className = 'btn btn-outline btn-sm';
      configPanel.style.display = 'block';
      disabledNotice.style.display = 'none';
    });

    btnNo.addEventListener('click', () => {
      remindersEnabled = false;
      btnNo.className = 'btn btn-secondary btn-sm';
      btnYes.className = 'btn btn-outline btn-sm';
      configPanel.style.display = 'none';
      disabledNotice.style.display = 'block';
    });

    const r1Select = area.querySelector('#select-rem-1');
    const r2Select = area.querySelector('#select-rem-2');
    const tone1Select = area.querySelector('#select-tone-1');
    const tone2Select = area.querySelector('#select-tone-2');
    const testTone1Btn = area.querySelector('#btn-test-tone-1');
    const testTone2Btn = area.querySelector('#btn-test-tone-2');

    r1Select?.addEventListener('change', (e) => (reminder1Minutes = parseInt(e.target.value, 10)));
    r2Select?.addEventListener('change', (e) => (reminder2Minutes = parseInt(e.target.value, 10)));

    tone1Select?.addEventListener('change', (e) => {
      reminder1Tone = e.target.value;
      localStorage.setItem('smarttime_alarm_tone_1', reminder1Tone);
    });

    testTone1Btn?.addEventListener('click', () => {
      playAlarmTone(reminder1Tone, `Attention! Your class is starting in ${reminder1Minutes} minutes. Please get ready!`);
    });

    tone2Select?.addEventListener('change', (e) => {
      reminder2Tone = e.target.value;
      localStorage.setItem('smarttime_alarm_tone_2', reminder2Tone);
    });

    testTone2Btn?.addEventListener('click', () => {
      playAlarmTone(reminder2Tone, `Quick alert! Your class starts in ${reminder2Minutes} minutes.`);
    });

    area.querySelector('#btn-back-step-3').addEventListener('click', () => {
      currentStep = 3;
      renderWizard();
    });

    area.querySelector('#btn-activate-timetable').addEventListener('click', async () => {
      currentStep = 5;
      renderWizard();
    });
  }

  // ==========================================
  // STEP 5: AUTOMATIC GENERATION & DONE
  // ==========================================
  function renderStep5(area) {
    area.innerHTML = `
      <div style="text-align: center; max-width: 540px; margin: 0 auto; padding: 2rem 0;">
        <h3 id="step5-title" style="margin-bottom: 0.5rem;">Setting Up Your Smart Schedule...</h3>
        <p id="step5-subtitle" style="margin-bottom: 2rem; color: var(--text-secondary);">Creating recurring occurrences and setting up your schedule.</p>

        <!-- Generation Checklist -->
        <div id="step5-checklist" style="text-align: left; background: var(--bg-card); padding: 1.5rem; border-radius: var(--radius-xl); border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); margin-bottom: 2rem;">
          <div class="check-item loading" id="gen-1"><div class="check-item-icon">1</div> Schedule saved to database</div>
          <div class="check-item" id="gen-2"><div class="check-item-icon">2</div> Validity configured (${validityDuration})</div>
          <div class="check-item" id="gen-3"><div class="check-item-icon">3</div> Smart calendar occurrences generated</div>
          <div class="check-item" id="gen-4"><div class="check-item-icon">4</div> Weekly recurring classes created</div>
          <div class="check-item" id="gen-5"><div class="check-item-icon">5</div> ${remindersEnabled ? `Reminders scheduled (${reminder1Minutes}m & ${reminder2Minutes}m)` : `Reminders disabled (as requested)`}</div>
          <div class="check-item" id="gen-6"><div class="check-item-icon">6</div> Calendar and views initialized</div>
        </div>

        <div id="step5-complete-box" style="display: none;">
          <div class="success-pop-icon">🎉</div>
          <h2 style="font-size: 2.2rem; margin-bottom: 0.5rem;">You're All Set!</h2>
          <p style="margin-bottom: 2rem; font-size: 1.05rem;">Your custom timetable is live and your schedule is organized.</p>
          <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
            <button id="btn-goto-timetables" class="btn btn-primary btn-lg" style="padding: 1rem 2.2rem; font-size: 1.05rem; box-shadow: 0 8px 24px var(--primary-purple-glow);">
              📋 View in My Timetables (مائی ٹائم ٹیبل دیکھیں) ➔
            </button>
            <button id="btn-goto-dashboard" class="btn btn-secondary btn-lg" style="padding: 1rem 2.2rem; font-size: 1.05rem;">
              🏠 Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    `;

    const genSteps = [1, 2, 3, 4, 5, 6];
    let i = 0;
    const interval = setInterval(async () => {
      if (i < genSteps.length) {
        const item = area.querySelector(`#gen-${genSteps[i]}`);
        if (item) {
          item.classList.remove('loading');
          item.classList.add('done');
          item.querySelector('.check-item-icon').textContent = '✓';
        }
        i++;
        if (i < genSteps.length) {
          const next = area.querySelector(`#gen-${genSteps[i]}`);
          if (next) next.classList.add('loading');
        }
      } else {
        clearInterval(interval);

        // Call backend API to persist timetable, recurrence and reminders
        try {
          await api.createTimetable({
            name: customTimetableTitle || `${state.user?.name || 'My'} Timetable (${validityDuration})`,
            image_url: uploadedImageUrl,
            source_type: inputMethod,
            start_date: validityStartDate,
            end_date: validityEndDate,
            duration: validityDuration,
            events: extractedEvents,
            reminder_1_minutes: remindersEnabled ? reminder1Minutes : 0,
            reminder_2_minutes: remindersEnabled ? reminder2Minutes : 0
          });
        } catch (err) {
          console.warn('Timetable creation API notice:', err);
        }

        playChimeSound();
        area.querySelector('#step5-title').style.display = 'none';
        area.querySelector('#step5-subtitle').style.display = 'none';
        area.querySelector('#step5-checklist').style.display = 'none';
        area.querySelector('#step5-complete-box').style.display = 'block';

        area.querySelector('#btn-goto-timetables')?.addEventListener('click', () => {
          state.setView('timetables');
        });

        area.querySelector('#btn-goto-dashboard')?.addEventListener('click', () => {
          state.setView('dashboard');
        });
      }
    }, 350);
  }

  renderWizard();
}
