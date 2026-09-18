/**
 * One time setup. Run locally:  node scripts/google-auth.js
 *
 * Opens a Google consent screen, catches the redirect, and prints the refresh
 * token to paste into your environment. You should never need to run this
 * again unless you revoke access or change scopes.
 */

require('dotenv').config();
const http = require('http');
const { URL } = require('url');
const { SCOPES, oauthClient } = require('../booking/lib/google');

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/api/booking/oauth/callback`;

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('\nSet GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
  console.error('See BOOKING_SETUP.md step 1.\n');
  process.exit(1);
}

process.env.GOOGLE_REDIRECT_URI = REDIRECT_URI;
const client = oauthClient();

const authUrl = client.generateAuthUrl({
  access_type: 'offline',   // this is what produces a refresh token
  prompt: 'consent',        // forces a fresh one even if you approved before
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/api/booking/oauth/callback') {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('No code returned. Close this and run the script again.');
    return;
  }

  try {
    const { tokens } = await client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Done.</h2><p>Go back to your terminal for the token.</p>');

    if (!tokens.refresh_token) {
      console.error('\nGoogle did not return a refresh token.');
      console.error('Revoke access at https://myaccount.google.com/permissions and rerun.\n');
    } else {
      console.log('\n' + '='.repeat(72));
      console.log('  Add this to your .env locally AND to Render env vars:');
      console.log('='.repeat(72));
      console.log(`\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      console.log('='.repeat(72));
      console.log('  Treat it like a password. It grants access to your calendar.');
      console.log('='.repeat(72) + '\n');
    }
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Token exchange failed. Check the terminal.');
    console.error('\nToken exchange failed:', error.message, '\n');
  } finally {
    server.close(() => process.exit(0));
  }
});

server.listen(PORT, () => {
  console.log('\nMake sure this exact URI is an authorized redirect on your OAuth client:');
  console.log(`  ${REDIRECT_URI}\n`);
  console.log('Now open this URL in your browser and approve:\n');
  console.log(authUrl + '\n');
});
