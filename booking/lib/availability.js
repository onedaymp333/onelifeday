/**
 * Slot computation.
 *
 * Everything here is pure: given config, a "now", and a list of busy
 * intervals, it returns the slots that survive. No network calls, which is
 * what makes it testable.
 *
 * All arithmetic happens in the owner's timezone (config.profile.timezone) so
 * that "11:00 on Tuesday" stays 11:00 across a daylight saving boundary.
 * Slots are handed to the browser as UTC ISO strings and rendered in each
 * visitor's own local time.
 */

const { DateTime, Interval } = require('luxon');

const WEEKDAY_NAMES = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

function getMeetingType(config, typeId) {
  return config.meetingTypes.find((t) => t.id === typeId) || null;
}

/** Windows that apply on one calendar date, override beating weekly default. */
function windowsForDate(config, meetingType, date) {
  const isoDate = date.toISODate();
  if (Object.prototype.hasOwnProperty.call(config.dateOverrides || {}, isoDate)) {
    return config.dateOverrides[isoDate] || [];
  }
  // luxon weekday is 1=Monday through 7=Sunday
  const dayName = WEEKDAY_NAMES[date.weekday - 1];
  const source = meetingType.hours || config.weeklyHours;
  return source[dayName] || [];
}

function parseTimeOnDate(date, hhmm) {
  const [hour, minute] = hhmm.split(':').map(Number);
  return date.set({ hour, minute, second: 0, millisecond: 0 });
}

/**
 * Busy periods padded by the configured buffer on both sides, so a slot that
 * merely touches a meeting is excluded too.
 */
function padBusy(busyIntervals, bufferMinutes) {
  return busyIntervals
    .map(({ start, end }) =>
      Interval.fromDateTimes(
        DateTime.fromISO(start, { zone: 'utc' }).minus({ minutes: bufferMinutes }),
        DateTime.fromISO(end, { zone: 'utc' }).plus({ minutes: bufferMinutes })
      )
    )
    .filter((interval) => interval.isValid);
}

/**
 * @returns {Array<{date, weekday, slots: Array<{start, end}>}>} Only days that
 *          have at least one open slot. ISO strings throughout.
 */
function computeAvailability({ config, meetingType, busyIntervals, bookingCountsByDate = {}, now }) {
  const zone = config.profile.timezone;
  const rules = config.rules;
  const current = (now ? DateTime.fromJSDate(now) : DateTime.now()).setZone(zone);

  const earliestStart = current.plus({ hours: rules.minimumNoticeHours });
  const lastDay = current.plus({ days: rules.maxDaysOut }).endOf('day');
  const blocked = padBusy(busyIntervals, rules.bufferMinutes);

  const days = [];

  for (let cursor = current.startOf('day'); cursor <= lastDay; cursor = cursor.plus({ days: 1 })) {
    const isoDate = cursor.toISODate();

    // Day already at its cap, skip the whole thing.
    if ((bookingCountsByDate[isoDate] || 0) >= rules.maxBookingsPerDay) continue;

    const slots = [];

    for (const window of windowsForDate(config, meetingType, cursor)) {
      const windowStart = parseTimeOnDate(cursor, window.start);
      const windowEnd = parseTimeOnDate(cursor, window.end);
      if (!windowStart.isValid || !windowEnd.isValid || windowEnd <= windowStart) continue;

      for (
        let slotStart = windowStart;
        slotStart.plus({ minutes: meetingType.minutes }) <= windowEnd;
        slotStart = slotStart.plus({ minutes: rules.slotIntervalMinutes })
      ) {
        const slotEnd = slotStart.plus({ minutes: meetingType.minutes });

        // Too soon.
        if (slotStart < earliestStart) continue;

        // Overlaps something on the calendar.
        const slot = Interval.fromDateTimes(slotStart, slotEnd);
        if (blocked.some((busy) => busy.overlaps(slot))) continue;

        slots.push({ start: slotStart.toUTC().toISO(), end: slotEnd.toUTC().toISO() });
      }
    }

    if (slots.length) {
      days.push({ date: isoDate, weekday: cursor.toFormat('cccc'), slots });
    }
  }

  return days;
}

/**
 * Re-validation at booking time. The availability list a visitor is looking at
 * can be seconds or minutes stale, so the requested slot is recomputed against
 * fresh calendar data before anything is written.
 */
function isSlotStillOpen({ config, meetingType, busyIntervals, bookingCountsByDate, now, startISO }) {
  const days = computeAvailability({ config, meetingType, busyIntervals, bookingCountsByDate, now });
  const target = DateTime.fromISO(startISO, { zone: 'utc' });
  if (!target.isValid) return false;
  return days.some((day) =>
    day.slots.some((slot) => DateTime.fromISO(slot.start, { zone: 'utc' }).equals(target))
  );
}

/** Window to query the calendar for, matching the range slots can fall in. */
function searchWindow(config, now) {
  const zone = config.profile.timezone;
  const current = (now ? DateTime.fromJSDate(now) : DateTime.now()).setZone(zone);
  return {
    timeMin: current.startOf('day').toUTC().toISO(),
    // Padded a day so a buffer reaching past the final midnight is still seen.
    timeMax: current.plus({ days: config.rules.maxDaysOut + 1 }).endOf('day').toUTC().toISO(),
  };
}

function countBookingsByDate(events, zone) {
  const counts = {};
  for (const event of events) {
    const startISO = event.start?.dateTime || event.start?.date;
    if (!startISO) continue;
    const date = DateTime.fromISO(startISO, { zone }).toISODate();
    counts[date] = (counts[date] || 0) + 1;
  }
  return counts;
}

module.exports = {
  computeAvailability,
  isSlotStillOpen,
  searchWindow,
  countBookingsByDate,
  getMeetingType,
  windowsForDate,
};
