/**
 * Dates, in local time.
 *
 * A brief is for a day, and "a day" is the one you are standing in - not UTC.
 * `toISOString().slice(0, 10)` is the obvious way to do this and is wrong for
 * anyone east of Greenwich for part of every evening: at 01:00 in Stockholm it
 * hands back yesterday, so the morning brief would look stale at breakfast.
 */

/** @param {number} at */
export function localDate(at) {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * "today", "yesterday", or the date itself.
 *
 * @param {string} date `YYYY-MM-DD`
 * @param {number} now
 */
export function relativeDay(date, now) {
  const today = localDate(now);
  if (date === today) {
    return 'today';
  }
  if (date === localDate(now - 24 * 60 * 60 * 1000)) {
    return 'yesterday';
  }
  return date;
}
