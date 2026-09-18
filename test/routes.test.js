/**
 * Integration test for the booking API.
 *
 * The Google Calendar client is replaced with an in memory fake before routes
 * are loaded, so the whole request path runs for real against a calendar we
 * control. That is the only way to exercise the double booking guard.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const express = require('express');

const googlePath = require.resolve('../booking/lib/google');

// Fake calendar state, reset between tests.
const fake = { busy: [], bookings: [], created: [], configured: true, failNext: false };

require.cache[googlePath] = {
  id: googlePath,
  filename: googlePath,
  loaded: true,
  exports: {
    SCOPES: [],
    oauthClient: () => { throw new Error('not used in tests'); },
    isConfigured: () => fake.configured,
    getBusyIntervals: async () => fake.busy,
    listOwnBookings: async () => fake.bookings,
    createBooking: async (calendarId, event, opts) => {
      if (fake.failNext) { fake.failNext = false; throw new Error('calendar exploded'); }
      const created = { ...event, id: 'evt-' + fake.created.length, hangoutLink: opts.withMeet ? 'https://meet.google.com/fake' : null };
      fake.created.push({ calendarId, event, opts });
      // Booking it makes the time busy, exactly like the real thing.
      fake.busy.push({ start: event.start.dateTime, end: event.end.dateTime });
      fake.bookings.push(created);
      return created;
    },
  },
};

const config = require('../booking/config');
// The hourly spam guard would otherwise trip partway through the suite, since
// every request here comes from the same loopback address.
config.rules.maxBookingsPerHourPerVisitor = 1000;
const routes = require('../booking/routes');

let server, base;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/booking', routes);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/booking`;
});

test.after(() => server && server.close());

test.beforeEach(() => {
  fake.busy = [];
  fake.bookings = [];
  fake.created = [];
  fake.configured = true;
  fake.failNext = false;
});

const get = (p) => fetch(base + p).then(async (r) => ({ status: r.status, body: await r.json() }));
const post = (p, payload) =>
  fetch(base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

function validBooking(start, extra = {}) {
  return {
    type: 'standard',
    start,
    name: 'Test Guest',
    email: 'guest@example.com',
    phone: '555-0100',
    location: 'meet',
    ...extra,
  };
}

async function firstOpenSlot() {
  const { body } = await get('/availability?type=standard');
  assert.ok(body.days?.length, 'expected some availability');
  return body.days[0].slots[0].start;
}

test('GET /config never leaks calendar ids or the write target', async () => {
  const { status, body } = await get('/config');
  assert.strictEqual(status, 200);
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes('@group.calendar.google.com'), 'calendar ids must stay server side');
  assert.ok(!serialized.includes(config.writeToCalendar), 'the write calendar must stay server side');
  assert.ok(Array.isArray(body.meetingTypes) && body.meetingTypes.length);
});

test('GET /config reports the connection state', async () => {
  fake.configured = false;
  assert.strictEqual((await get('/config')).body.configured, false);
});

test('GET /availability returns days with slots', async () => {
  const { status, body } = await get('/availability?type=standard');
  assert.strictEqual(status, 200);
  assert.strictEqual(body.timezone, config.profile.timezone);
  assert.ok(body.days.length > 0);
  assert.ok(body.days[0].slots[0].start.endsWith('Z'));
});

test('GET /availability rejects an unknown meeting type', async () => {
  assert.strictEqual((await get('/availability?type=bogus')).status, 400);
  assert.strictEqual((await get('/availability')).status, 400);
});

test('GET /availability reports 503 when Google is not connected', async () => {
  fake.configured = false;
  assert.strictEqual((await get('/availability?type=standard')).status, 503);
});

test('a valid booking is written to the calendar with the guest attached', async () => {
  const start = await firstOpenSlot();
  const { status, body } = await post('/book', validBooking(start));

  assert.strictEqual(status, 200);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.meetLink, 'https://meet.google.com/fake');

  assert.strictEqual(fake.created.length, 1);
  const { calendarId, event, opts } = fake.created[0];
  assert.strictEqual(calendarId, config.writeToCalendar);
  assert.strictEqual(opts.withMeet, true);
  assert.deepStrictEqual(event.attendees, [{ email: 'guest@example.com', displayName: 'Test Guest' }]);
  assert.match(event.summary, /Standard Meeting: Test Guest/);
  assert.match(event.description, /guest@example\.com/);
  assert.match(event.description, /555-0100/);

  const minutes = (new Date(event.end.dateTime) - new Date(event.start.dateTime)) / 60000;
  assert.strictEqual(minutes, 30, 'event length should match the meeting type');
});

test('the same slot cannot be booked twice', async () => {
  const start = await firstOpenSlot();
  assert.strictEqual((await post('/book', validBooking(start))).status, 200);

  const second = await post('/book', validBooking(start, { email: 'other@example.com' }));
  assert.strictEqual(second.status, 409, 'the second attempt must be rejected');
  assert.match(second.body.error, /just taken/i);
  assert.strictEqual(fake.created.length, 1, 'only one event should exist');
});

test('a booked slot disappears from the availability list', async () => {
  const start = await firstOpenSlot();
  await post('/book', validBooking(start));

  const { body } = await get('/availability?type=standard');
  const allSlots = body.days.flatMap((d) => d.slots.map((s) => s.start));
  assert.ok(!allSlots.includes(start), 'the taken slot must be gone');
});

test('a time nobody was offered cannot be booked', async () => {
  // 4am UTC on a far future date: outside every configured window.
  const forged = '2027-01-15T04:00:00.000Z';
  const { status } = await post('/book', validBooking(forged));
  assert.strictEqual(status, 409);
  assert.strictEqual(fake.created.length, 0, 'nothing should have been written');
});

test('a slot inside the minimum notice window cannot be booked', async () => {
  const soon = new Date(Date.now() + 60 * 60 * 1000); // one hour out
  soon.setUTCMinutes(0, 0, 0);
  const { status } = await post('/book', validBooking(soon.toISOString()));
  assert.strictEqual(status, 409);
  assert.strictEqual(fake.created.length, 0);
});

test('phone bookings carry the number into the event location', async () => {
  const start = await firstOpenSlot();
  const { status, body } = await post('/book', validBooking(start, { location: 'phone', phone: '555-0199' }));
  assert.strictEqual(status, 200);
  assert.strictEqual(body.meetLink, null, 'no Meet link for a phone call');
  assert.match(fake.created[0].event.location, /555-0199/);
  assert.strictEqual(fake.created[0].opts.withMeet, false);
});

test('a phone booking without a number is rejected', async () => {
  const start = await firstOpenSlot();
  const { status, body } = await post('/book', validBooking(start, { location: 'phone', phone: '' }));
  assert.strictEqual(status, 400);
  assert.match(body.error, /phone/i);
});

test('an unknown or disabled location is rejected', async () => {
  const start = await firstOpenSlot();
  assert.strictEqual((await post('/book', validBooking(start, { location: 'telepathy' }))).status, 400);
  assert.strictEqual((await post('/book', validBooking(start, { location: undefined }))).status, 400);
});

test('bad input is rejected before anything touches the calendar', async () => {
  const start = await firstOpenSlot();
  const cases = [
    [{ ...validBooking(start), name: '   ' }, /name/i],
    [{ ...validBooking(start), email: 'not-an-email' }, /email/i],
    [{ ...validBooking(start), start: 'garbage' }, /start time/i],
    [{ ...validBooking(start), type: 'nope' }, /meeting type/i],
  ];
  for (const [payload, pattern] of cases) {
    const { status, body } = await post('/book', payload);
    assert.strictEqual(status, 400, `expected 400 for ${JSON.stringify(payload).slice(0, 60)}`);
    assert.match(body.error, pattern);
  }
  assert.strictEqual(fake.created.length, 0);
});

test('an empty POST body does not crash the route', async () => {
  const { status } = await post('/book', {});
  assert.strictEqual(status, 400);
});

test('a calendar failure surfaces as a 500 and books nothing', async () => {
  const start = await firstOpenSlot();
  fake.failNext = true;
  const { status, body } = await post('/book', validBooking(start));
  assert.strictEqual(status, 500);
  assert.match(body.error, /Nothing was scheduled/);
});

test('an existing busy block removes its slots from availability', async () => {
  const before = await get('/availability?type=standard');
  const target = before.body.days[0].slots[0];

  fake.busy = [{ start: target.start, end: target.end }];
  const after = await get('/availability?type=standard');
  const allSlots = after.body.days.flatMap((d) => d.slots.map((s) => s.start));
  assert.ok(!allSlots.includes(target.start), 'a busy calendar event must remove the slot');
});

test('the hourly spam guard counts successful bookings and not rejections', async () => {
  const original = config.rules.maxBookingsPerHourPerVisitor;
  config.rules.maxBookingsPerHourPerVisitor = 2;
  routes._resetRateLimitForTests();
  try {
    // Ten rejected attempts must not consume the allowance.
    for (let i = 0; i < 10; i += 1) {
      const { status } = await post('/book', { ...validBooking('2027-01-15T04:00:00.000Z'), email: 'bad' });
      assert.strictEqual(status, 400);
    }

    // One slot per day. Adjacent slots on the same day would knock each other
    // out via the buffer, which is correct but not what this test is about.
    const { body } = await get('/availability?type=standard');
    assert.ok(body.days.length >= 3, 'need three separate days for this test');
    const slots = body.days.slice(0, 3).map((d) => d.slots[0].start);

    assert.strictEqual((await post('/book', validBooking(slots[0]))).status, 200);
    assert.strictEqual((await post('/book', validBooking(slots[1]))).status, 200);

    const blocked = await post('/book', validBooking(slots[2]));
    assert.strictEqual(blocked.status, 429, 'the third successful booking should be blocked');
    assert.match(blocked.body.error, /too many bookings/i);
  } finally {
    config.rules.maxBookingsPerHourPerVisitor = original;
    routes._resetRateLimitForTests();
  }
});
