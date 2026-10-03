export const NIGHT_SCHEDULE = Object.freeze({
  'managing-editor': [21, 0, 4], 'editor-in-chief': [22],
  'visual-editor': [22, 6], 'copy-editor': [23, 3], publisher: [1, 5], 'writer-desk': [2]
});
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
export function nightClock(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('invalid night clock');
  const p = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const hour = Number(p.hour);
  const previous = new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  return { date, hour, minute: Number(p.minute), nightDate: hour < 7 ? previous : date,
    recoveryAllowed: hour >= 21 || hour <= 6, workerAllowed: hour >= 21 || hour < 7 };
}
export function nextPublicationDate(now = new Date()) {
  const { date, hour } = nightClock(now);
  // At 21:00 the next publisher is after midnight, including week/month/year boundaries.
  return hour < 6 ? date : new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}
