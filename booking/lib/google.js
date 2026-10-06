/**
 * Thin wrapper around the Google Calendar API.
 *
 * Auth model: a one time OAuth consent (see scripts/google-auth.js) produces a
 * long lived refresh token. That token lives in the GOOGLE_REFRESH_TOKEN env
 * var and the library mints short lived access tokens from it as needed, so
 * there is nothing to re-authorize under normal operation.
 */

const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Booking is not configured yet. See BOOKING_SETUP.md.`
    );
  }
  return value;
}

function oauthClient(redirectUri) {
  return new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
    redirectUri ||
      process.env.GOOGLE_REDIRECT_URI ||
      'http://localhost:3000/api/booking/oauth/callback'
  );
}

/** True once a refresh token exists, which permanently closes browser setup. */
function hasRefreshToken() {
  return Boolean(process.env.GOOGLE_REFRESH_TOKEN);
}

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

function calendarClient() {
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: requireEnv('GOOGLE_REFRESH_TOKEN') });
  return google.calendar({ version: 'v3', auth });
}

/**
 * Busy intervals across every configured calendar, merged into one flat list.
 *
 * freebusy honors event transparency, so an event the user marked "Free" is
 * correctly absent here. Calendars that error (deleted, access revoked) are
 * skipped rather than failing the whole request, otherwise one stale calendar
 * id would take the booking page down.
 */
async function getBusyIntervals(calendarIds, timeMinISO, timeMaxISO) {
  const calendar = calendarClient();
  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      items: calendarIds.map((id) => ({ id })),
    },
  });

  const intervals = [];
  for (const [id, entry] of Object.entries(data.calendars || {})) {
    if (entry.errors?.length) {
      console.warn(`[booking] skipping calendar ${id}:`, entry.errors.map((e) => e.reason).join(', '));
      continue;
    }
    for (const period of entry.busy || []) {
      intervals.push({ start: period.start, end: period.end });
    }
  }
  return intervals;
}

/**
 * Bookings previously made through this page, within a window. Used to enforce
 * the per day cap. Tagged with a private extended property so meetings the
 * user schedules themselves are not counted against the cap.
 */
async function listOwnBookings(calendarId, timeMinISO, timeMaxISO) {
  const calendar = calendarClient();
  const { data } = await calendar.events.list({
    calendarId,
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: true,
    maxResults: 2500,
    privateExtendedProperty: 'onelifeday_booking=true',
  });
  return (data.items || []).filter((e) => e.status !== 'cancelled');
}

async function createBooking(calendarId, event, { withMeet }) {
  const calendar = calendarClient();
  const requestBody = {
    ...event,
    extendedProperties: { private: { onelifeday_booking: 'true' } },
  };

  if (withMeet) {
    requestBody.conferenceData = {
      createRequest: {
        requestId: `olf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const { data } = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: withMeet ? 1 : 0,
    sendUpdates: 'all',
    requestBody,
  });
  return data;
}

module.exports = {
  SCOPES, oauthClient, isConfigured, hasRefreshToken,
  getBusyIntervals, listOwnBookings, createBooking,
};
