/**
 * Public booking API.
 *
 *   GET  /api/booking/config              what the page needs to render itself
 *   GET  /api/booking/availability?type=  open slots for one meeting type
 *   POST /api/booking/book                claim a slot
 */

const express = require('express');
const { DateTime } = require('luxon');
const config = require('./config');
const google = require('./lib/google');
const {
  computeAvailability,
  isSlotStillOpen,
  searchWindow,
  countBookingsByDate,
  getMeetingType,
} = require('./lib/availability');

const router = express.Router();

// Simple in memory rate limit. Single Render instance, so a Map is enough to
// stop someone scripting a hundred junk holds onto the calendar.
//
// Only SUCCESSFUL bookings count against the limit. A visitor who mistypes
// their email five times should not be locked out for an hour, and a rejected
// request never reaches the calendar anyway.
const recentBookings = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function liveHits(ip) {
  const now = Date.now();
  return (recentBookings.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
}

function rateLimited(ip) {
  const hits = liveHits(ip);
  recentBookings.set(ip, hits);
  return hits.length >= config.rules.maxBookingsPerHourPerVisitor;
}

function recordBooking(ip) {
  const hits = liveHits(ip);
  hits.push(Date.now());
  recentBookings.set(ip, hits);
}

// Keep the Map from growing without bound on a long lived process.
setInterval(() => {
  for (const ip of recentBookings.keys()) {
    const live = liveHits(ip);
    if (live.length) recentBookings.set(ip, live);
    else recentBookings.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

/** Everything the public page is allowed to know. Calendar ids stay private. */
router.get('/config', (req, res) => {
  res.json({
    profile: config.profile,
    meetingTypes: config.meetingTypes.map(({ id, label, minutes, blurb }) => ({
      id, label, minutes, blurb,
    })),
    locations: Object.entries(config.locations)
      .filter(([, loc]) => loc.enabled)
      .map(([key, loc]) => ({ key, label: loc.label, blurb: loc.blurb })),
    form: config.form,
    configured: google.isConfigured(),
  });
});

router.get('/availability', async (req, res) => {
  const meetingType = getMeetingType(config, req.query.type);
  if (!meetingType) return res.status(400).json({ error: 'Unknown meeting type.' });

  if (!google.isConfigured()) {
    return res.status(503).json({ error: 'Booking is not connected to Google Calendar yet.' });
  }

  try {
    const now = new Date();
    const { timeMin, timeMax } = searchWindow(config, now);

    const [busyIntervals, ownBookings] = await Promise.all([
      google.getBusyIntervals(config.busyCalendars, timeMin, timeMax),
      google.listOwnBookings(config.writeToCalendar, timeMin, timeMax),
    ]);

    const days = computeAvailability({
      config,
      meetingType,
      busyIntervals,
      bookingCountsByDate: countBookingsByDate(ownBookings, config.profile.timezone),
      now,
    });

    res.json({ timezone: config.profile.timezone, meetingType, days });
  } catch (error) {
    console.error('[booking] availability failed:', error.message);
    res.status(500).json({ error: 'Could not load availability. Try again in a moment.' });
  }
});

router.post('/book', async (req, res) => {
  if (rateLimited(req.ip)) {
    return res.status(429).json({ error: 'Too many bookings from here in the last hour. Try again later.' });
  }

  const { type, start, name, email, phone, topic, social, company, location } = req.body || {};

  const meetingType = getMeetingType(config, type);
  if (!meetingType) return res.status(400).json({ error: 'Unknown meeting type.' });

  const startTime = DateTime.fromISO(String(start || ''), { zone: 'utc' });
  if (!startTime.isValid) return res.status(400).json({ error: 'Invalid start time.' });

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  const locationChoice = config.locations[location];
  if (!locationChoice || !locationChoice.enabled) {
    return res.status(400).json({ error: 'Pick where the meeting should happen.' });
  }
  if (location === 'phone' && !String(phone || '').trim()) {
    return res.status(400).json({ error: 'A phone number is required for a phone call.' });
  }
  if (config.form.phone.enabled && config.form.phone.required && !String(phone || '').trim()) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  if (!google.isConfigured()) {
    return res.status(503).json({ error: 'Booking is not connected to Google Calendar yet.' });
  }

  try {
    const now = new Date();
    const { timeMin, timeMax } = searchWindow(config, now);

    // Re-check against live calendar data. The slot list the visitor clicked
    // may be stale, and this is the only thing standing between two people
    // and the same slot.
    const [busyIntervals, ownBookings] = await Promise.all([
      google.getBusyIntervals(config.busyCalendars, timeMin, timeMax),
      google.listOwnBookings(config.writeToCalendar, timeMin, timeMax),
    ]);

    const stillOpen = isSlotStillOpen({
      config,
      meetingType,
      busyIntervals,
      bookingCountsByDate: countBookingsByDate(ownBookings, config.profile.timezone),
      now,
      startISO: startTime.toISO(),
    });

    if (!stillOpen) {
      return res.status(409).json({ error: 'That time was just taken. Pick another slot.' });
    }

    const endTime = startTime.plus({ minutes: meetingType.minutes });
    const guestName = String(name).trim();

    const details = [
      `${meetingType.label} booked through onelifeday.`,
      '',
      `Name: ${guestName}`,
      `Email: ${String(email).trim()}`,
      phone ? `Phone: ${String(phone).trim()}` : null,
      company ? `Company: ${String(company).trim()}` : null,
      social ? `Social: ${String(social).trim()}` : null,
      '',
      topic ? `What it is about:\n${String(topic).trim()}` : null,
    ].filter((line) => line !== null).join('\n');

    let locationText = locationChoice.label;
    if (location === 'phone') locationText = `Phone: ${String(phone).trim()}`;
    if (location === 'inPerson') locationText = locationChoice.address || 'In person, location to confirm';

    const created = await google.createBooking(
      config.writeToCalendar,
      {
        summary: `${meetingType.label}: ${guestName}`,
        description: details,
        start: { dateTime: startTime.toISO(), timeZone: 'UTC' },
        end: { dateTime: endTime.toISO(), timeZone: 'UTC' },
        attendees: [{ email: String(email).trim(), displayName: guestName }],
        location: location === 'meet' ? undefined : locationText,
        reminders: { useDefault: true },
      },
      { withMeet: location === 'meet' }
    );

    recordBooking(req.ip);

    res.json({
      ok: true,
      start: startTime.toISO(),
      end: endTime.toISO(),
      meetLink: created.hangoutLink || null,
      timezone: config.profile.timezone,
    });
  } catch (error) {
    console.error('[booking] book failed:', error.message);
    res.status(500).json({ error: 'Could not complete the booking. Nothing was scheduled.' });
  }
});

// Test seam. The limiter keeps per IP state in memory, and every request in a
// test run arrives from the same loopback address, so tests need a way to
// start clean. Not used in production.
router._resetRateLimitForTests = () => recentBookings.clear();

module.exports = router;
