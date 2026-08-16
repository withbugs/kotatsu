const PUBLISH_TIME_ZONE = 'Asia/Tokyo';
const MAX_ROUTINE_DELAY_DAYS = 7;
const LAST_PUBLISHER_HOUR_JST = 17;
const DAY_MS = 24 * 60 * 60 * 1000;

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PUBLISH_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23'
});

function parts(date) {
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

export function jstDateKey(date) {
  const value = parts(date);
  return `${value.year}-${value.month}-${value.day}`;
}

export function localDateReferenceVariants(date) {
  const dateKey = jstDateKey(date);
  const [year, paddedMonth, paddedDay] = dateKey.split('-');
  const month = String(Number(paddedMonth));
  const day = String(Number(paddedDay));

  return [
    dateKey,
    `${year}-${month}-${day}`,
    `${year}/${paddedMonth}/${paddedDay}`,
    `${year}/${month}/${day}`,
    `${year}.${paddedMonth}.${paddedDay}`,
    `${year}.${month}.${day}`,
    `${year}年${paddedMonth}月${paddedDay}日`,
    `${year}年${month}月${day}日`
  ];
}

export function containsLocalDateReference(value, date) {
  const content = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return localDateReferenceVariants(date).some((variant) => content.includes(variant));
}

function dateKeyAsUtc(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function addDays(dateKey, days) {
  return new Date(dateKeyAsUtc(dateKey) + days * DAY_MS).toISOString().slice(0, 10);
}

function validDate(value) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function earliestRecoveryDateKey(now = new Date()) {
  const value = parts(now);
  const today = `${value.year}-${value.month}-${value.day}`;
  return Number(value.hour) >= LAST_PUBLISHER_HOUR_JST ? addDays(today, 1) : today;
}

export function validateRecoveryTarget({
  originalPublishAt,
  currentPublishAt,
  nextPublishAt,
  now = new Date(),
  editorialRevalidatedAt
}) {
  const errors = [];
  const original = validDate(originalPublishAt);
  const current = validDate(currentPublishAt);
  const next = validDate(nextPublishAt);

  if (!original) errors.push('originalPublishAt must be a valid date');
  if (!current) errors.push('current publishAt must be a valid date');
  if (!next) errors.push('next publishAt must be a valid date');
  if (errors.length) return { errors, requiresEditorialRevalidation: false };

  if (current > now) errors.push('article is not overdue; use the normal schedule instead');
  if (next <= current) errors.push('recovery publishAt must be later than the current publishAt');

  const nextDateKey = jstDateKey(next);
  const earliestDateKey = earliestRecoveryDateKey(now);
  if (nextDateKey < earliestDateKey) {
    errors.push(`recovery publishAt must leave time for the next publisher run on or after ${earliestDateKey}`);
  }

  const originalDateKey = jstDateKey(original);
  const delayDays = Math.round((dateKeyAsUtc(nextDateKey) - dateKeyAsUtc(originalDateKey)) / DAY_MS);
  const monthChanged = originalDateKey.slice(0, 7) !== nextDateKey.slice(0, 7);
  const requiresEditorialRevalidation = delayDays > MAX_ROUTINE_DELAY_DAYS || monthChanged;

  if (requiresEditorialRevalidation && !/^\d{4}-\d{2}-\d{2}$/.test(String(editorialRevalidatedAt || ''))) {
    errors.push('delay over 7 days or across a month requires --editorial-revalidated-at=YYYY-MM-DD');
  }

  return {
    errors,
    requiresEditorialRevalidation,
    originalDateKey,
    nextDateKey,
    delayDays,
    monthChanged
  };
}
