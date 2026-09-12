const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const { processTimetableImage, parseVoiceTranscript } = require('../services/aiService');
const { analyzeScheduleConflicts } = require('../services/conflictDetector');
const { generateTimetableCSV } = require('../services/academicTimetableParser');
const { timeToMinutes } = require('../services/recurrenceEngine');

// Setup upload folder
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `timetable_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedExts = /jpeg|jpg|png|webp|gif|csv/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mime = file.mimetype;
    if (allowedExts.test(ext) || mime === 'text/csv' || mime === 'application/vnd.ms-excel') {
      return cb(null, true);
    }
    cb(new Error('Only image files (JPG, PNG, WEBP) or CSV files are supported'));
  }
});

/**
 * Parses CSV text into schedule event objects
 */
function parseTimetableCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const getCol = (patterns) => headers.findIndex((h) => patterns.some((p) => h.includes(p)));

  const dayIdx = getCol(['day', 'weekday']);
  const subjIdx = getCol(['subject', 'class', 'course', 'title', 'name']);
  const codeIdx = getCol(['code']);
  const startIdx = getCol(['start', 'from', 'begintime']);
  const endIdx = getCol(['end', 'to', 'stoptime']);
  const durIdx = getCol(['duration']);
  const roomIdx = getCol(['room', 'loc', 'hall', 'lab']);
  const teacherIdx = getCol(['teacher', 'instructor', 'prof']);
  const creditsIdx = getCol(['credit', 'crhr']);

  const normalizeTimeStr = (str) => {
    if (!str) return null;
    const clean = str.trim().toUpperCase();
    const ampmMatch = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = ampmMatch[2] || '00';
      if (ampmMatch[3] === 'PM' && h < 12) h += 12;
      if (ampmMatch[3] === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${m}`;
    }
    const h24Match = clean.match(/^(\d{1,2}):(\d{2})$/);
    if (h24Match) {
      return `${String(parseInt(h24Match[1], 10)).padStart(2, '0')}:${h24Match[2]}`;
    }
    return null;
  };

  const events = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (!cols || cols.length === 0 || cols.every((c) => !c)) continue;

    const day = dayIdx >= 0 && cols[dayIdx] ? cols[dayIdx] : 'Monday';
    const subj = subjIdx >= 0 && cols[subjIdx] ? cols[subjIdx] : `Class ${i}`;
    const code = codeIdx >= 0 && cols[codeIdx] ? cols[codeIdx] : null;
    const rawStart = startIdx >= 0 && cols[startIdx] ? cols[startIdx] : '09:00';
    const rawEnd = endIdx >= 0 && cols[endIdx] ? cols[endIdx] : null;
    const room = roomIdx >= 0 && cols[roomIdx] ? cols[roomIdx] : null;
    const teacher = teacherIdx >= 0 && cols[teacherIdx] ? cols[teacherIdx] : null;
    const credits = creditsIdx >= 0 && cols[creditsIdx] ? cols[creditsIdx] : null;

    const start = normalizeTimeStr(rawStart) || rawStart;
    const end = rawEnd ? (normalizeTimeStr(rawEnd) || rawEnd) : null;
    const dur = start && end ? timeToMinutes(end) - timeToMinutes(start) : 60;

    events.push({
      class_name: subj,
      subject: subj,
      course_code: code,
      day,
      start_time: start,
      end_time: end,
      duration_minutes: dur > 0 ? dur : 60,
      room,
      teacher,
      credits,
      confidence: 1.0
    });
  }

  return events;
}

// POST /api/ai/scan-image
router.post('/scan-image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    let imageBuffer = null;
    let imageUrl = null;
    let isCsvUpload = false;

    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext === '.csv' || req.file.mimetype === 'text/csv') {
        isCsvUpload = true;
      } else {
        imageBuffer = fs.readFileSync(req.file.path);
      }
    } else if (req.body.image_base64) {
      const base64Data = req.body.image_base64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
      const filename = `timetable_${Date.now()}.png`;
      const filePath = path.join(UPLOAD_DIR, filename);
      fs.writeFileSync(filePath, imageBuffer);
      imageUrl = `/uploads/${filename}`;
    } else if (!req.body.csv_text) {
      return res.status(400).json({ error: 'Please upload an image/CSV file or provide base64 data' });
    }

    // Handle direct CSV upload
    if (isCsvUpload || req.body.csv_text) {
      const csvContent = isCsvUpload ? fs.readFileSync(req.file.path, 'utf8') : req.body.csv_text;
      const events = parseTimetableCSV(csvContent);
      const conflictAnalysis = analyzeScheduleConflicts(events);

      const csvFilename = `timetable_${Date.now()}.csv`;
      const csvFilePath = path.join(UPLOAD_DIR, csvFilename);
      fs.writeFileSync(csvFilePath, csvContent, 'utf8');

      return res.json({
        success: true,
        image_url: imageUrl,
        total_classes: events.length,
        detected_days: Array.from(new Set(events.map((e) => e.day))),
        confidence_avg: 1.0,
        events,
        conflicts: conflictAnalysis.conflicts,
        duplicates: conflictAnalysis.duplicates,
        detected_title: req.file ? req.file.originalname.replace(/\.csv$/i, '') : 'Imported Schedule',
        csv_content: csvContent,
        csv_filename: csvFilename,
        csv_url: `/uploads/${csvFilename}`
      });
    }

    // Process image with Vision OCR & Academic Timetable Parser
    const ocrText = req.body.ocr_text || '';
    const aiResult = await processTimetableImage(imageBuffer, { ocr_text: ocrText });

    // Automatically convert extracted timetable to CSV
    const csvContent = generateTimetableCSV(aiResult.events, aiResult.detected_title || 'Timetable Schedule');
    const csvFilename = `timetable_${Date.now()}.csv`;
    const csvFilePath = path.join(UPLOAD_DIR, csvFilename);
    fs.writeFileSync(csvFilePath, csvContent, 'utf8');

    res.json({
      success: true,
      image_url: imageUrl,
      total_classes: aiResult.total_classes,
      detected_days: aiResult.detected_days,
      confidence_avg: aiResult.confidence_avg,
      events: aiResult.events,
      conflicts: aiResult.conflicts,
      duplicates: aiResult.duplicates,
      detected_title: aiResult.detected_title || null,
      csv_content: csvContent,
      csv_filename: csvFilename,
      csv_url: `/uploads/${csvFilename}`
    });
  } catch (err) {
    console.error('Image OCR / CSV error:', err);
    res.status(500).json({ error: 'Failed to process timetable file. Please try a clearer photo or CSV file.' });
  }
});

// POST /api/ai/generate-csv
router.post('/generate-csv', authMiddleware, (req, res) => {
  try {
    const { events, title } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    const timetableTitle = title || 'Timetable Schedule';
    const csvContent = generateTimetableCSV(events, timetableTitle);
    const csvFilename = `timetable_${Date.now()}.csv`;
    const csvFilePath = path.join(UPLOAD_DIR, csvFilename);
    fs.writeFileSync(csvFilePath, csvContent, 'utf8');

    res.json({
      success: true,
      csv_content: csvContent,
      csv_filename: csvFilename,
      csv_url: `/uploads/${csvFilename}`
    });
  } catch (err) {
    console.error('CSV generation error:', err);
    res.status(500).json({ error: 'Failed to generate CSV file' });
  }
});

// POST /api/ai/parse-csv
router.post('/parse-csv', authMiddleware, (req, res) => {
  try {
    const { csv_text } = req.body;
    if (!csv_text || typeof csv_text !== 'string') {
      return res.status(400).json({ error: 'csv_text string is required' });
    }

    const events = parseTimetableCSV(csv_text);
    const conflictAnalysis = analyzeScheduleConflicts(events);

    res.json({
      success: true,
      total_classes: events.length,
      events,
      conflicts: conflictAnalysis.conflicts,
      duplicates: conflictAnalysis.duplicates
    });
  } catch (err) {
    console.error('CSV parsing error:', err);
    res.status(500).json({ error: 'Failed to parse CSV schedule' });
  }
});

// POST /api/ai/parse-voice
router.post('/parse-voice', authMiddleware, async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide a voice transcript' });
    }

    const events = parseVoiceTranscript(transcript);
    const conflictAnalysis = analyzeScheduleConflicts(events);

    res.json({
      success: true,
      transcript: transcript.trim(),
      total_classes: events.length,
      events,
      conflicts: conflictAnalysis.conflicts,
      duplicates: conflictAnalysis.duplicates
    });
  } catch (err) {
    console.error('Voice NLU error:', err);
    res.status(500).json({ error: 'Failed to parse voice schedule. Please try speaking clearly.' });
  }
});

// POST /api/ai/validate-schedule
router.post('/validate-schedule', authMiddleware, (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    const conflictAnalysis = analyzeScheduleConflicts(events);

    // Identify missing information
    const missingInfo = [];
    events.forEach((evt, idx) => {
      if (!evt.start_time) {
        missingInfo.push({ index: idx, field: 'start_time', class_name: evt.class_name, message: `Start time missing for ${evt.class_name}` });
      }
      if (!evt.end_time && !evt.duration_minutes) {
        missingInfo.push({ index: idx, field: 'end_time', class_name: evt.class_name, message: `How long is your ${evt.class_name} class?` });
      }
    });

    res.json({
      valid: conflictAnalysis.conflicts.length === 0 && missingInfo.length === 0,
      conflicts: conflictAnalysis.conflicts,
      duplicates: conflictAnalysis.duplicates,
      missing_info: missingInfo
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to validate schedule' });
  }
});

router.parseTimetableCSV = parseTimetableCSV;
module.exports = router;
