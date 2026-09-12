/**
 * HTTP Client for SmartTime AI API
 */

import { state } from './state.js';

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'x-user-id': state.token } : {}),
    ...(options.headers || {})
  };

  // If body is FormData, delete Content-Type to allow browser to set boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Network error occurred');
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => request('/api/auth/me'),
  updateProfile: (body) => request('/api/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  saveOnboarding: (body) => request('/api/auth/onboarding', { method: 'POST', body: JSON.stringify(body) }),

  // Dashboard
  getDashboard: () => request('/api/dashboard'),

  // AI & Schedule Processing
  scanImage: (formDataOrBase64, ocrText = '') => {
    if (formDataOrBase64 instanceof FormData) {
      if (ocrText) formDataOrBase64.append('ocr_text', ocrText);
      return request('/api/ai/scan-image', { method: 'POST', body: formDataOrBase64 });
    }
    return request('/api/ai/scan-image', {
      method: 'POST',
      body: JSON.stringify({ image_base64: formDataOrBase64, ocr_text: ocrText })
    });
  },
  parseVoice: (transcript) =>
    request('/api/ai/parse-voice', { method: 'POST', body: JSON.stringify({ transcript }) }),
  validateSchedule: (events) =>
    request('/api/ai/validate-schedule', { method: 'POST', body: JSON.stringify({ events }) }),
  generateCSV: (events, title) =>
    request('/api/ai/generate-csv', { method: 'POST', body: JSON.stringify({ events, title }) }),
  parseCSV: (csvText) =>
    request('/api/ai/parse-csv', { method: 'POST', body: JSON.stringify({ csv_text: csvText }) }),

  // Timetables
  getTimetables: () => request('/api/timetables'),
  createTimetable: (body) => request('/api/timetables', { method: 'POST', body: JSON.stringify(body) }),
  extendTimetable: (id, body) => request(`/api/timetables/${id}/extend`, { method: 'POST', body: JSON.stringify(body) }),
  renameTimetable: (id, name) => request(`/api/timetables/${id}/rename`, { method: 'PUT', body: JSON.stringify({ name }) }),
  pauseTimetable: (id) => request(`/api/timetables/${id}/pause`, { method: 'POST' }),
  deleteTimetable: (id) => request(`/api/timetables/${id}`, { method: 'DELETE' }),

  // Events
  getEvents: (startDate, endDate) =>
    request(`/api/events?start_date=${startDate || ''}&end_date=${endDate || ''}`),
  createEvent: (body) => request('/api/events', { method: 'POST', body: JSON.stringify(body) }),
  updateEvent: (id, body) => request(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteEvent: (id, deleteSeries = false) =>
    request(`/api/events/${id}${deleteSeries ? '?delete_series=true' : ''}`, { method: 'DELETE' }),

  // Notifications & Settings
  getNotifications: () => request('/api/notifications'),
  markNotificationRead: (id) => request(`/api/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => request('/api/notifications/read-all', { method: 'PUT' }),
  deleteNotification: (id) => request(`/api/notifications/${id}`, { method: 'DELETE' }),
  clearAlarmHistory: (timeframe) => request(`/api/notifications/clear-history?timeframe=${timeframe || 'all'}`, { method: 'DELETE' }),
  getSettings: () => request('/api/notifications/settings'),
  updateSettings: (body) => request('/api/notifications/settings', { method: 'PUT', body: JSON.stringify(body) }),
  testChime: () => request('/api/notifications/test-chime', { method: 'POST' }),
  triggerAlarm: () => request('/api/notifications/trigger-alarm', { method: 'POST' })
};
