/**
 * Date and Time Utilities for SmartTime AI
 */

export const DAYS_LIST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function formatTime12h(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export function formatDatePretty(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function calculateDaysRemaining(endDateStr) {
  if (!endDateStr) return 0;
  const now = new Date();
  const end = new Date(endDateStr + 'T23:59:59');
  const diffMs = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function formatLocalDate(d) {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function addMonthsSafe(baseDateStrOrObj, months) {
  const d = new Date(baseDateStrOrObj);
  const originalDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, lastDay));
  return formatLocalDate(d);
}

export function computeDurationText(startDateStr, endDateStr, explicitMonths) {
  if (explicitMonths) {
    if (explicitMonths === 12) return '1 Year';
    if (explicitMonths === 1) return '1 Month';
    return `${explicitMonths} Months`;
  }
  if (!startDateStr || !endDateStr) return '3 Months';
  const s = new Date(startDateStr);
  const e = new Date(endDateStr);
  const daysDiff = Math.round((e - s) / (1000 * 60 * 60 * 24));
  
  if (daysDiff >= 350) return '1 Year';
  if (daysDiff >= 170 && daysDiff <= 190) return '6 Months';
  if (daysDiff >= 80 && daysDiff <= 100) return '3 Months';
  if (daysDiff >= 25 && daysDiff <= 35) return '1 Month';
  
  const mDiff = Math.round(daysDiff / 30.44);
  if (mDiff >= 12) {
    const yrs = Math.floor(mDiff / 12);
    const remMonths = mDiff % 12;
    return yrs === 1 && remMonths === 0 ? '1 Year' : remMonths === 0 ? `${yrs} Years` : `${yrs} Year ${remMonths} Months`;
  }
  if (mDiff > 0) {
    return mDiff === 1 ? '1 Month' : `${mDiff} Months`;
  }
  return `${daysDiff} Days`;
}

