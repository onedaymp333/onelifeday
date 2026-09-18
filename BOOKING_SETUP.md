# Booking Setup

Your booking page lives at `/book`. This guide connects it to Google Calendar.

**You do not need a terminal.** Everything below happens in a browser.
Set aside about 15 minutes. You do this once, ever.

---

## What you are actually doing

Google will not let a website touch your calendar unless you give it
permission. These steps create that permission and hand your site the key.

Three values come out of it, and they go into Render as environment variables:

| Value | Where it comes from |
|---|---|
| `GOOGLE_CLIENT_ID` | Step 2 |
| `GOOGLE_CLIENT_SECRET` | Step 2 |
| `GOOGLE_REFRESH_TOKEN` | Step 5 |

---

## Step 1: Find your Render URL

Open https://dashboard.render.com, click your **onelifeday** service. The URL
is at the top, something like `https://onelifeday.onrender.com`.

Write it down. You need it twice below. Everywhere this guide says
`YOUR-URL`, paste that in.

---

## Step 2: Create Google credentials

1. Go to https://console.cloud.google.com/
2. Top left, click the project dropdown, then **New Project**. Name it
   `onelifeday`. Click **Create**. Wait, then make sure it is selected.
3. In the search bar at the top, type **Google Calendar API**, open it, click
   **Enable**.
4. Left sidebar, **APIs & Services** > **OAuth consent screen**. Click
   **Get started**.
   - App name: `OneLifeDay Booking`
   - User support email: your Gmail
   - Audience: **External**
   - Developer contact: your Gmail
   - Click through to **Create**.
5. Left sidebar, **Audience**. Under **Test users**, click **Add users**, enter
   `therealoneday@gmail.com`, save.

   > Leave the app in Testing mode. You never need Google to verify it,
   > because you are the only person who ever signs in. People booking you
   > never sign in to anything.

6. Left sidebar, **Clients**, then **Create client**.
   - Application type: **Web application**
   - Name: `onelifeday web`
   - Under **Authorized redirect URIs**, click **Add URI** and paste exactly:

     ```
     YOUR-URL/api/booking/oauth/callback
     ```

     So if your URL is `https://onelifeday.onrender.com`, that becomes
     `https://onelifeday.onrender.com/api/booking/oauth/callback`

     This has to match character for character. No trailing slash.
   - Click **Create**.
7. A box appears with **Client ID** and **Client secret**. Keep this tab open,
   you need both in the next step.

---

## Step 3: Put those into Render

1. Render dashboard > your service > **Environment** in the left sidebar.
2. Click **Add Environment Variable** three times and add:

   | Key | Value |
   |---|---|
   | `GOOGLE_CLIENT_ID` | the Client ID from step 2 |
   | `GOOGLE_CLIENT_SECRET` | the Client secret from step 2 |
   | `BOOKING_SETUP_KEY` | any random string you make up |

   `BOOKING_SETUP_KEY` is a temporary password so a stranger cannot run this
   setup on your site. Make up something long and messy. You use it once in
   step 4 and never again.

3. **Save changes.** Render redeploys. Wait for it to finish.

---

## Step 4: Approve the connection

In your browser, go to:

```
YOUR-URL/api/booking/oauth/start?key=YOUR-SETUP-KEY
```

Google asks you to sign in and approve.

> It will warn you the app is not verified. That is expected, it is your own
> app. Click **Advanced**, then **Go to OneLifeDay Booking (unsafe)**.

Approve the calendar access.

---

## Step 5: Copy the token back

You land on a page that says **Connected** with a long value and a **Copy
token** button.

1. Copy it.
2. Render > **Environment** > add one more variable:

   | Key | Value |
   |---|---|
   | `GOOGLE_REFRESH_TOKEN` | the value you just copied |

3. **Save changes** and let it redeploy.

Treat this value like a password. It grants access to your calendar. Never put
it in a message, a screenshot, or a commit.

The moment this variable exists, the setup URL from step 4 shuts itself off
permanently. You can delete `BOOKING_SETUP_KEY` if you like.

---

## Step 6: Try it

Open `YOUR-URL/book`

You should see your name, three meeting types, and real open times pulled from
your calendar. Book one yourself as a test. It should appear on your Google
Calendar within seconds with a Meet link.

Done. Hand that link to people.

---

## Day to day

You never come back here. You block time by putting events on Google Calendar
the way you already do, and the page updates itself.

- An event marked **Free** instead of **Busy** does **not** block a slot. Use
  it for soft holds you would still take a meeting during.
- An **all day event marked Busy** blocks that whole day. Fastest way to go
  dark on a date.

---

## Changing your hours or meeting types

Everything is in **`booking/config.js`**, commented section by section.

| Section | What it controls |
|---|---|
| 2. `weeklyHours` | The hours you are bookable, per weekday. Empty = never. |
| 3. `dateOverrides` | Special hours or blackouts for one specific date. |
| 4. `meetingTypes` | Names and lengths of bookable meetings. |
| 5. `rules` | Notice period, how far ahead, buffers, daily cap. |
| 6. `busyCalendars` | Which calendars make you unavailable. |
| 7. `locations` | Google Meet, phone, in person. |
| 8. `form` | Which fields the booking form asks for. |

Editing this file needs a redeploy. Editing your *calendar* does not.

---

## If something goes wrong

**"redirect_uri_mismatch" from Google**
The URI in step 2.6 does not exactly match your site. Check for a missing
`https://`, a typo, or a trailing slash.

**The booking page says it is not connected**
One of the three variables is missing or misspelled in Render, or the deploy
has not finished.

**"No refresh token came back"**
Google only issues one on a first approval. Go to
https://myaccount.google.com/permissions, remove **OneLifeDay Booking**, then
redo step 4.

**The page takes 30 seconds to load**
Render's free plan sleeps a service after 15 minutes idle. The first visitor
after a quiet stretch waits for it to wake. Upgrade to a paid instance, or
point a free uptime pinger at the URL.

**No times show up at all**
Check `weeklyHours` in `booking/config.js` is not all empty, and that your
calendar is not fully booked across the window. Remember the 24 hour minimum
notice hides today and part of tomorrow.

---

## For the terminal path instead

If you would rather run setup locally: put `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` in a `.env` file, add
`http://localhost:3000/api/booking/oauth/callback` as a second authorized
redirect URI in step 2.6, then run `node scripts/google-auth.js` and follow it.

Run the test suite with `npm test`.
