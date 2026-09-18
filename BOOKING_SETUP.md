# Booking Setup

A public scheduling page at `/book`, backed directly by Google Calendar.

## How it works

You never open an admin panel. You block time the way you already do, by
putting events on your Google Calendar. The server:

1. Reads your **hours** from `booking/config.js` (the hard limit, the times you
   are willing to be booked at all).
2. Reads your **busy time** live from Google Calendar every time someone loads
   the page.
3. Subtracts one from the other, applies your rules (notice period, buffers,
   daily cap), and shows what is left.
4. When someone picks a slot, writes the meeting onto your calendar and invites
   them, so Google sends the confirmation and reminders. The slot disappears
   for the next visitor immediately.

Two tricks worth knowing:

- An event marked **Free** instead of **Busy** in Google Calendar does *not*
  block a slot. Use it for soft holds you would still take a meeting during.
- An **all day event marked Busy** blocks the whole day. Fastest way to go dark
  on a specific date without touching any code.

## One time setup

### 1. Create Google OAuth credentials

1. Go to https://console.cloud.google.com/ and create a project (any name).
2. **APIs & Services > Library**, search "Google Calendar API", click **Enable**.
3. **APIs & Services > OAuth consent screen**:
   - User type: **External**
   - Fill in app name, your email for both support and developer contact
   - On the **Audience** page, add `therealoneday@gmail.com` as a **Test user**
   - Leave it in Testing mode. You do not need Google to verify the app,
     because you are the only person who ever authorizes it. Visitors to your
     booking page never sign in.
4. **APIs & Services > Credentials > Create Credentials > OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI, exactly this:
     `http://localhost:3000/api/booking/oauth/callback`
   - Copy the **Client ID** and **Client secret**.

### 2. Put them in `.env`

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 3. Get your refresh token

```bash
node scripts/google-auth.js
```

Open the URL it prints, approve the access (Google will warn you the app is
unverified, click through **Advanced > Go to ...**, it is your own app), and
the script prints a refresh token. Paste it into `.env`:

```
GOOGLE_REFRESH_TOKEN=...
```

You only ever do this once. The token does not expire under normal use.

> Treat the refresh token like a password. It grants read and write access to
> your calendar. It is in `.gitignore` via `.env`, keep it that way.

### 4. Try it locally

```bash
npm start
```

Open http://localhost:3000/book

### 5. Deploy

In the Render dashboard, add the same three variables under **Environment**:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`. Then
redeploy. Your link is `https://<your-render-url>/book`.

## Editing your availability

Everything lives in **`booking/config.js`**, which is commented section by
section. The parts you will actually touch:

| Section | What it controls |
|---|---|
| `weeklyHours` | The hours you are bookable, per weekday. Empty array = never. |
| `meetingTypes` | Names and lengths of the meetings people can book. |
| `rules` | Notice period, how far ahead people can book, buffers, daily cap. |
| `busyCalendars` | Which calendars make you unavailable. |
| `locations` | Google Meet, phone, in person. |
| `form` | Which fields the booking form asks for. |

Changing this file needs a redeploy. Changing your *calendar* does not, which
is the point: day to day you only touch Google Calendar.

## Running the tests

```bash
npm test
```

Covers the slot engine: windows, buffers, notice periods, daily caps, date
overrides, daylight saving, and rejection of forged time slots.

## Known limitation

Render's free plan sleeps a service after 15 minutes idle. The first person to
open your link after a quiet stretch waits roughly 30 seconds for the page.
Either move to a paid instance or point an uptime pinger at the URL.
