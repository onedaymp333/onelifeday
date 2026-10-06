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

// ══════════════════════════════════════════════════════════════════════════
//  One time setup, done from a browser.
//
//  Running an OAuth flow normally means a terminal. These two routes let the
//  whole thing happen in a browser instead: visit /oauth/start, approve on
//  Google, and the callback prints the refresh token to paste into the host's
//  environment variables.
//
//  Locked down three ways, because this flow hands out a calendar credential:
//    1. BOOKING_SETUP_KEY must be set, and the request must carry it.
//    2. The moment GOOGLE_REFRESH_TOKEN exists, both routes go dark for good.
//    3. The token is shown once, in the browser. It is never written to disk
//       or logged.
// ══════════════════════════════════════════════════════════════════════════

function setupUnavailable(res) {
  if (google.hasRefreshToken()) {
    res.status(404).send(setupPage('Setup is already done',
      'This booking page is connected to Google Calendar, so setup is closed. ' +
      'To reconnect, clear GOOGLE_REFRESH_TOKEN in your host environment first.'));
    return true;
  }
  if (!process.env.BOOKING_SETUP_KEY) {
    res.status(503).send(setupPage('Setup key missing',
      'Set a BOOKING_SETUP_KEY environment variable on your host, redeploy, ' +
      'then open this link again with ?key=your-key on the end.'));
    return true;
  }
  return false;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setupPage(heading, body, token) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(heading)}</title>
<style>
  body { background:#0e0f13; color:#f2f3f5; font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
         margin:0; padding:48px 16px; }
  .card { max-width:640px; margin:0 auto; background:#17191f; border:1px solid #2a2e38;
          border-radius:14px; padding:28px; }
  h1 { font-size:22px; margin:0 0 14px; }
  p { color:#9aa1ad; }
  code { display:block; background:#0e0f13; border:1px solid #2a2e38; border-radius:10px;
         padding:16px; margin:18px 0; word-break:break-all; color:#e8c547;
         font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; }
  .warn { color:#ff6b6b; font-size:14px; }
  button { background:#e8c547; color:#14151a; border:none; border-radius:10px;
           padding:12px 18px; font:inherit; font-weight:700; cursor:pointer; }
</style></head><body><div class="card">
<h1>${escapeHtml(heading)}</h1>
<p>${escapeHtml(body)}</p>
${token ? `<code id="t">${escapeHtml(token)}</code>
<button onclick="navigator.clipboard.writeText(document.getElementById('t').textContent).then(()=>this.textContent='Copied')">Copy token</button>
<p class="warn">Treat this like a password. It grants access to your calendar. Paste it into your host as GOOGLE_REFRESH_TOKEN, then close this tab.</p>` : ''}
</div></body></html>`;
}

/** The URI Google redirects back to, derived from how this request arrived. */
function callbackUri(req) {
  return `${req.protocol}://${req.get('host')}/api/booking/oauth/callback`;
}

router.get('/oauth/start', (req, res) => {
  if (setupUnavailable(res)) return;

  if (req.query.key !== process.env.BOOKING_SETUP_KEY) {
    return res.status(403).send(setupPage('Wrong key',
      'Add ?key=your-setup-key to the end of this URL, matching the ' +
      'BOOKING_SETUP_KEY you set on your host.'));
  }

  try {
    const client = google.oauthClient(callbackUri(req));
    res.redirect(client.generateAuthUrl({
      access_type: 'offline',  // this is what produces a refresh token
      prompt: 'consent',       // force a fresh one even on a repeat approval
      scope: google.SCOPES,
      state: process.env.BOOKING_SETUP_KEY,
    }));
  } catch (error) {
    res.status(503).send(setupPage('Google credentials missing', error.message));
  }
});

router.get('/oauth/callback', async (req, res) => {
  if (setupUnavailable(res)) return;

  if (req.query.state !== process.env.BOOKING_SETUP_KEY) {
    return res.status(403).send(setupPage('Setup link expired',
      'Start again from the /oauth/start link with your key.'));
  }
  if (!req.query.code) {
    return res.status(400).send(setupPage('Google sent no code',
      'Start again from the /oauth/start link with your key.'));
  }

  try {
    const client = google.oauthClient(callbackUri(req));
    const { tokens } = await client.getToken(String(req.query.code));

    if (!tokens.refresh_token) {
      return res.status(500).send(setupPage('No refresh token came back',
        'Google only issues one on a first approval. Remove this app at ' +
        'myaccount.google.com/permissions, then run setup again.'));
    }

    res.send(setupPage(
      'Connected',
      'Copy the value below, add it to your host environment variables as ' +
      'GOOGLE_REFRESH_TOKEN, and redeploy. That is the last setup step.',
      tokens.refresh_token
    ));
  } catch (error) {
    console.error('[booking] oauth callback failed:', error.message);
    res.status(500).send(setupPage('Could not finish connecting',
      'Google rejected the exchange. The usual cause is a redirect URI on your ' +
      'OAuth client that does not exactly match this page address.'));
  }
});

// Test seam. The limiter keeps per IP state in memory, and every request in a
// test run arrives from the same loopback address, so tests need a way to
// start clean. Not used in production.
router._resetRateLimitForTests = () => recentBookings.clear();

module.exports = router;
