const test = require('node:test');
const assert = require('node:assert');
const { DateTime } = require('luxon');
const {
  computeAvailability,
  isSlotStillOpen,
  windowsForDate,
} = require('../booking/lib/availability');

const ZONE = 'America/New_York';

function baseConfig(overrides = {}) {
  return {
    profile: { timezone: ZONE },
    weeklyHours: {
      sunday: [],
      monday: [{ start: '11:00', end: '15:00' }],
      tuesday: [{ start: '11:00', end: '15:00' }],
      wednesday: [{ start: '11:00', end: '15:00' }],
      thursday: [{ start: '11:00', end: '15:00' }],
      friday: [{ start: '11:00', end: '15:00' }],
      saturday: [],
    },
    dateOverrides: {},
    rules: {
      minimumNoticeHours: 24,
      maxDaysOut: 7,
      bufferMinutes: 15,
      maxBookingsPerDay: 4,
      slotIntervalMinutes: 30,
    },
    ...overrides,
  };
}

const TYPE_30 = { id: 'standard', label: 'Standard', minutes: 30 };

// A Monday, 9am Eastern.
const NOW = DateTime.fromISO('2026-09-21T09:00:00', { zone: ZONE }).toJSDate();

function run(opts = {}) {
  return computeAvailability({
    config: opts.config || baseConfig(),
    meetingType: opts.meetingType || TYPE_30,
    busyIntervals: opts.busyIntervals || [],
    bookingCountsByDate: opts.bookingCountsByDate || {},
    now: opts.now || NOW,
  });
}

function startsOn(days, isoDate) {
  const day = days.find((d) => d.date === isoDate);
  return day ? day.slots.map((s) => DateTime.fromISO(s.start).setZone(ZONE).toFormat('HH:mm')) : [];
}

test('offers slots only inside the configured window', () => {
  const days = run();
  // Window is 11:00 to 15:00 with 30 min meetings on a 30 min grid.
  assert.deepStrictEqual(startsOn(days, '2026-09-22'), ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30']);
});

test('never offers a slot that would run past the end of the window', () => {
  const days = run({ meetingType: { id: 'deep', label: 'Deep', minutes: 60 } });
  const slots = startsOn(days, '2026-09-22');
  assert.strictEqual(slots[slots.length - 1], '14:00', 'a 60 min meeting cannot start at 14:30');
});

test('days with no configured hours are absent entirely', () => {
  const days = run();
  assert.ok(!days.some((d) => d.date === '2026-09-26'), 'Saturday should not appear');
  assert.ok(!days.some((d) => d.date === '2026-09-27'), 'Sunday should not appear');
});

test('minimum notice blocks anything too soon', () => {
  // Now is Monday 09:00, notice is 24h, so Monday and Tuesday before 09:00 go.
  const days = run();
  assert.deepStrictEqual(startsOn(days, '2026-09-21'), [], 'today is inside the notice window');
  assert.ok(startsOn(days, '2026-09-22').length > 0, 'tomorrow past the cutoff is fine');
});

test('minimum notice cuts partway into a day correctly', () => {
  const config = baseConfig();
  config.rules.minimumNoticeHours = 26; // cutoff lands at Tuesday 11:00
  const days = run({ config });
  assert.deepStrictEqual(startsOn(days, '2026-09-22')[0], '11:00');

  config.rules.minimumNoticeHours = 27; // cutoff lands at Tuesday 12:00
  assert.deepStrictEqual(startsOn(run({ config }), '2026-09-22')[0], '12:00');
});

test('respects the maxDaysOut horizon', () => {
  const days = run();
  const last = days[days.length - 1].date;
  assert.ok(last <= '2026-09-28', `last day ${last} should be within 7 days of Sep 21`);
});

test('a busy interval removes the overlapping slots', () => {
  const busy = [{
    start: DateTime.fromISO('2026-09-22T12:00:00', { zone: ZONE }).toUTC().toISO(),
    end: DateTime.fromISO('2026-09-22T13:00:00', { zone: ZONE }).toUTC().toISO(),
  }];
  const slots = startsOn(run({ busyIntervals: busy }), '2026-09-22');
  assert.ok(!slots.includes('12:00'));
  assert.ok(!slots.includes('12:30'));
});

test('the buffer also clears the slots touching a busy block', () => {
  const busy = [{
    start: DateTime.fromISO('2026-09-22T12:00:00', { zone: ZONE }).toUTC().toISO(),
    end: DateTime.fromISO('2026-09-22T13:00:00', { zone: ZONE }).toUTC().toISO(),
  }];
  const slots = startsOn(run({ busyIntervals: busy }), '2026-09-22');
  // 15 min buffer expands the block to 11:45 to 13:15, so these go too.
  assert.ok(!slots.includes('11:30'), '11:30 to 12:00 sits inside the leading buffer');
  assert.ok(!slots.includes('13:00'), '13:00 to 13:30 sits inside the trailing buffer');
  assert.ok(slots.includes('11:00'), '11:00 to 11:30 is clear of the buffer');
  assert.ok(slots.includes('13:30'), '13:30 is clear of the buffer');
});

test('zero buffer allows back to back meetings', () => {
  const config = baseConfig();
  config.rules.bufferMinutes = 0;
  const busy = [{
    start: DateTime.fromISO('2026-09-22T12:00:00', { zone: ZONE }).toUTC().toISO(),
    end: DateTime.fromISO('2026-09-22T13:00:00', { zone: ZONE }).toUTC().toISO(),
  }];
  const slots = startsOn(run({ config, busyIntervals: busy }), '2026-09-22');
  assert.ok(slots.includes('11:30'));
  assert.ok(slots.includes('13:00'));
});

test('an all day busy event clears the whole day', () => {
  const busy = [{
    start: DateTime.fromISO('2026-09-22T00:00:00', { zone: ZONE }).toUTC().toISO(),
    end: DateTime.fromISO('2026-09-23T00:00:00', { zone: ZONE }).toUTC().toISO(),
  }];
  const days = run({ busyIntervals: busy });
  assert.ok(!days.some((d) => d.date === '2026-09-22'));
});

test('the per day cap removes a day once it is hit', () => {
  const days = run({ bookingCountsByDate: { '2026-09-22': 4 } });
  assert.ok(!days.some((d) => d.date === '2026-09-22'));
  assert.ok(days.some((d) => d.date === '2026-09-23'), 'other days are untouched');
});

test('a day under the cap is still offered', () => {
  const days = run({ bookingCountsByDate: { '2026-09-22': 3 } });
  assert.ok(days.some((d) => d.date === '2026-09-22'));
});

test('a date override replaces the weekly hours', () => {
  const config = baseConfig({ dateOverrides: { '2026-09-22': [{ start: '19:00', end: '21:00' }] } });
  assert.deepStrictEqual(startsOn(run({ config }), '2026-09-22'), ['19:00', '19:30', '20:00', '20:30']);
});

test('an empty date override blacks the day out', () => {
  const config = baseConfig({ dateOverrides: { '2026-09-22': [] } });
  assert.ok(!run({ config }).some((d) => d.date === '2026-09-22'));
});

test('a date override opens a day that is normally closed', () => {
  const config = baseConfig({ dateOverrides: { '2026-09-26': [{ start: '12:00', end: '13:00' }] } });
  assert.deepStrictEqual(startsOn(run({ config }), '2026-09-26'), ['12:00', '12:30']);
});

test('multiple windows in a day leave the gap between them closed', () => {
  const config = baseConfig();
  config.weeklyHours.tuesday = [{ start: '10:00', end: '11:00' }, { start: '14:00', end: '15:00' }];
  const slots = startsOn(run({ config }), '2026-09-22');
  assert.deepStrictEqual(slots, ['10:00', '10:30', '14:00', '14:30']);
});

test('a per type hours override narrows only that type', () => {
  const longType = {
    id: 'deep', label: 'Deep', minutes: 60,
    hours: { ...baseConfig().weeklyHours, tuesday: [{ start: '13:00', end: '15:00' }] },
  };
  // 60 min meetings on a 30 min grid: 14:30 would end at 15:30, past the window.
  assert.deepStrictEqual(startsOn(run({ meetingType: longType }), '2026-09-22'), ['13:00', '13:30', '14:00']);
  assert.deepStrictEqual(startsOn(run(), '2026-09-22')[0], '11:00', 'the default type is unaffected');
});

test('hours stay put in wall clock time across a daylight saving change', () => {
  // US DST ends Sunday Nov 1 2026. Check a date on each side.
  const beforeDst = DateTime.fromISO('2026-10-28T09:00:00', { zone: ZONE }).toJSDate();
  const afterDst = DateTime.fromISO('2026-11-04T09:00:00', { zone: ZONE }).toJSDate();
  const config = baseConfig();
  config.rules.maxDaysOut = 3;

  assert.strictEqual(startsOn(run({ config, now: beforeDst }), '2026-10-29')[0], '11:00');
  assert.strictEqual(startsOn(run({ config, now: afterDst }), '2026-11-05')[0], '11:00');
});

test('slot boundaries are exported as valid UTC instants', () => {
  const day = run().find((d) => d.date === '2026-09-22');
  const slot = day.slots[0];
  assert.ok(slot.start.endsWith('Z'), 'start should be a UTC ISO string');
  const minutes = DateTime.fromISO(slot.end).diff(DateTime.fromISO(slot.start), 'minutes').minutes;
  assert.strictEqual(minutes, 30, 'the slot length should match the meeting length');
});

test('isSlotStillOpen agrees with the computed list', () => {
  const days = run();
  const open = days[0].slots[0].start;
  assert.strictEqual(isSlotStillOpen({
    config: baseConfig(), meetingType: TYPE_30, busyIntervals: [],
    bookingCountsByDate: {}, now: NOW, startISO: open,
  }), true);
});

test('isSlotStillOpen rejects a slot that just got taken', () => {
  const days = run();
  const target = days[0].slots[0].start;
  const busy = [{ start: target, end: DateTime.fromISO(target).plus({ minutes: 30 }).toUTC().toISO() }];
  assert.strictEqual(isSlotStillOpen({
    config: baseConfig(), meetingType: TYPE_30, busyIntervals: busy,
    bookingCountsByDate: {}, now: NOW, startISO: target,
  }), false);
});

test('isSlotStillOpen rejects an off grid or fabricated time', () => {
  const forged = DateTime.fromISO('2026-09-22T03:00:00', { zone: ZONE }).toUTC().toISO();
  assert.strictEqual(isSlotStillOpen({
    config: baseConfig(), meetingType: TYPE_30, busyIntervals: [],
    bookingCountsByDate: {}, now: NOW, startISO: forged,
  }), false, 'a 3am time outside the window must not be bookable');
});

test('isSlotStillOpen rejects garbage input', () => {
  assert.strictEqual(isSlotStillOpen({
    config: baseConfig(), meetingType: TYPE_30, busyIntervals: [],
    bookingCountsByDate: {}, now: NOW, startISO: 'not-a-date',
  }), false);
});

test('a malformed window is skipped rather than throwing', () => {
  const config = baseConfig();
  config.weeklyHours.tuesday = [{ start: '15:00', end: '11:00' }]; // end before start
  assert.deepStrictEqual(startsOn(run({ config }), '2026-09-22'), []);
});

test('windowsForDate maps each weekday to the right config key', () => {
  const config = baseConfig();
  config.weeklyHours.saturday = [{ start: '09:00', end: '10:00' }];
  const saturday = DateTime.fromISO('2026-09-26', { zone: ZONE });
  assert.deepStrictEqual(windowsForDate(config, TYPE_30, saturday), [{ start: '09:00', end: '10:00' }]);

  const sunday = DateTime.fromISO('2026-09-27', { zone: ZONE });
  assert.deepStrictEqual(windowsForDate(config, TYPE_30, sunday), []);
});
