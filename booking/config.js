/**
 * ============================================================================
 *  BOOKING CONFIG  —  this is the only file you need to edit.
 * ============================================================================
 *
 *  How the system works, in one paragraph:
 *  Your Google Calendar is the source of truth. You block time the way you
 *  already do, by putting events on your calendar. This file describes the
 *  hours you are willing to be booked AT ALL. The server takes your hours,
 *  subtracts everything your calendar says you are busy for, applies the
 *  rules below, and shows whatever is left on your public booking page.
 *
 *  Two useful tricks once this is live:
 *    - An event set to "Free" (not "Busy") in Google Calendar does NOT block
 *      a slot. Use that for soft holds you'd still take a meeting during.
 *    - An all day event set to "Busy" blocks the entire day. That is the
 *      fastest way to go dark on a specific date.
 * ============================================================================
 */

module.exports = {

  // ══════════════════════════════════════════════════════════════════════
  //  1. WHO YOU ARE  (shown on the public page)
  // ══════════════════════════════════════════════════════════════════════
  profile: {
    name: 'Eric "OneDay" Saldarriaga',
    tagline: 'Pick a time that works. Everything below is live availability.',
    timezone: 'America/New_York',
  },

  // ══════════════════════════════════════════════════════════════════════
  //  2. YOUR HOURS  —  the hard limit.
  //
  //  Times are 24 hour "HH:MM" in YOUR timezone above.
  //  An empty array means you are never bookable that day.
  //  You can list more than one window per day for a lunch break, e.g.
  //      tuesday: [{ start: '10:00', end: '12:30' }, { start: '14:00', end: '18:00' }]
  //
  //  >>> THESE ARE PLACEHOLDERS. Replace them with your real hours. <<<
  // ══════════════════════════════════════════════════════════════════════
  weeklyHours: {
    sunday:    [],
    monday:    [{ start: '11:00', end: '18:00' }],
    tuesday:   [{ start: '11:00', end: '18:00' }],
    wednesday: [{ start: '11:00', end: '18:00' }],
    thursday:  [{ start: '11:00', end: '18:00' }],
    friday:    [{ start: '11:00', end: '16:00' }],
    saturday:  [],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  3. SPECIFIC DATE OVERRIDES
  //
  //  Beats weeklyHours for that one date. Use it for a vacation week or a
  //  one off late night. Format is 'YYYY-MM-DD'.
  //  An empty array = fully unavailable that day.
  //
  //  You usually will NOT need this, because putting an all day "Busy"
  //  event on your calendar does the same thing without a deploy.
  // ══════════════════════════════════════════════════════════════════════
  dateOverrides: {
    // '2026-12-25': [],
    // '2026-10-03': [{ start: '19:00', end: '22:00' }],
  },

  // ══════════════════════════════════════════════════════════════════════
  //  4. MEETING TYPES
  //
  //  id       - shows up in the URL, keep it lowercase with no spaces
  //  label    - what the visitor sees
  //  minutes  - how long the meeting is
  //  blurb    - one line of description under the label
  //  hours    - OPTIONAL. Narrower hours just for this type. Same shape as
  //             weeklyHours. Leave it off to use your normal hours.
  //
  //  >>> PLACEHOLDERS. Rename these and set your real lengths. <<<
  // ══════════════════════════════════════════════════════════════════════
  meetingTypes: [
    {
      id: 'intro',
      label: 'Intro Call',
      minutes: 15,
      blurb: 'Quick hello to figure out if there is something here.',
    },
    {
      id: 'standard',
      label: 'Standard Meeting',
      minutes: 30,
      blurb: 'The normal one. Business, planning, follow ups.',
    },
    {
      id: 'deep',
      label: 'Working Session',
      minutes: 60,
      blurb: 'A real block of time to get into something properly.',
      // Example of locking long sessions to afternoons only:
      // hours: {
      //   sunday: [], monday: [{ start: '13:00', end: '18:00' }],
      //   tuesday: [{ start: '13:00', end: '18:00' }],
      //   wednesday: [{ start: '13:00', end: '18:00' }],
      //   thursday: [{ start: '13:00', end: '18:00' }],
      //   friday: [], saturday: [],
      // },
    },
  ],

  // ══════════════════════════════════════════════════════════════════════
  //  5. BOOKING RULES  —  tune these to taste.
  // ══════════════════════════════════════════════════════════════════════
  rules: {
    // Nobody can book a slot starting sooner than this many hours from now.
    // Stops someone grabbing 9am tomorrow while you are asleep.
    minimumNoticeHours: 24,

    // How many days of availability the page shows.
    maxDaysOut: 14,

    // Dead air held before and after every existing calendar event, in
    // minutes. Set to 0 if you are fine with back to back meetings.
    bufferMinutes: 15,

    // Hard ceiling on bookings made through this page, per day. Does not
    // count meetings you put on your calendar yourself.
    maxBookingsPerDay: 4,

    // Slots are offered on this grid. 30 gives you :00 and :30 starts only,
    // 15 also gives :15 and :45. Smaller looks messier but fills gaps better.
    slotIntervalMinutes: 30,

    // Spam guard. How many bookings one visitor can make in an hour. Only
    // successful bookings count, so someone fumbling the form is not punished.
    maxBookingsPerHourPerVisitor: 5,
  },

  // ══════════════════════════════════════════════════════════════════════
  //  6. WHICH CALENDARS MAKE YOU BUSY
  //
  //  An event on ANY calendar listed here blocks that time.
  //  Uncomment a line to start honoring that calendar.
  // ══════════════════════════════════════════════════════════════════════
  busyCalendars: [
    'therealoneday@gmail.com',                                                                    // primary
    'c_948b2c06928c2d6073d0a3f93b70dcfe9181d6ecb59f14b6f0821a4f90137a40@group.calendar.google.com', // OneDay (BeatGig)
    'a270c421c8d4010e92c41dc1ca853f761bea840dffe11e7cebddb1ea71afffe4@group.calendar.google.com',  // Colab.Hous Sessions

    // Deliberately OFF. Uncomment any you want to start blocking your time:
    // '0e90826482d932c6a7af1ce20c475a9f3148bda62a34392fd881bba9ac11c54a@group.calendar.google.com', // Landon Spring 2026 RCF
    // '677a001e9a5b57d2b354bcb1d2936f55035ddcf0c0e80444eba328ba0f21dfd5@group.calendar.google.com', // Runna
    // 'en.usa#holiday@group.v.calendar.google.com',                                                 // US Holidays
    // 'alysis@mmfbproductions.com',                                                                 // not yours, left out on purpose
  ],

  // The calendar new bookings get written onto. Keep this as your primary
  // unless you want confirmed calls living somewhere separate.
  writeToCalendar: 'therealoneday@gmail.com',

  // ══════════════════════════════════════════════════════════════════════
  //  7. WHERE MEETINGS HAPPEN
  //
  //  The visitor picks one of these on the booking form.
  //  'meet'     generates a fresh Google Meet link on every booking
  //  'phone'    uses the phone number they submit
  //  'inPerson' uses the address you set below
  // ══════════════════════════════════════════════════════════════════════
  locations: {
    meet: {
      enabled: true,
      label: 'Google Meet',
      blurb: 'A video link gets created and sent with the invite.',
    },
    phone: {
      enabled: true,
      label: 'Phone call',
      blurb: 'I will call the number you give below.',
    },
    inPerson: {
      enabled: true,
      label: 'In person',
      blurb: 'Tell me where in the notes and I will confirm.',
      // Set a fixed address here and it is used instead of their note:
      address: '',
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  //  8. THE BOOKING FORM
  //  Name and email are always required, the invite needs them.
  // ══════════════════════════════════════════════════════════════════════
  form: {
    phone:   { enabled: true,  required: true,  label: 'Phone number' },
    topic:   { enabled: true,  required: false, label: 'What is this about?' },
    social:  { enabled: true,  required: false, label: 'Instagram or social handle' },
    company: { enabled: false, required: false, label: 'Company or brand' },
  },
};
