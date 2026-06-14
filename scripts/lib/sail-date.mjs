/** Parse sail dates (ISO) and check expiry. */

/** @param {string|null|undefined} text */
export function parseSailDate(text) {
  if (!text || typeof text !== "string") return null;
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return localDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  return null;
}

/** @param {Date} date */
export function formatClosedSailDate(date) {
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `Отплыл (${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()})`;
}

/** Sail date day D valid through end of D; archive starting D+1. */
export function isSailDatePast(sailDate, today) {
  const end = new Date(sailDate.getFullYear(), sailDate.getMonth(), sailDate.getDate(), 23, 59, 59, 999);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return end < startToday;
}

/** Days until sail (negative if past). */
export function daysUntilSail(sailDate, today) {
  const sail = new Date(sailDate.getFullYear(), sailDate.getMonth(), sailDate.getDate());
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((sail - now) / 86400000);
}

function localDate(year, month, day) {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}
