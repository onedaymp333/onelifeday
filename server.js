require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ── Plaid Setup ──
const config = new Configuration({
  basePath: PlaidEnvironments.sandbox, // Change to 'production' when ready to go live
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(config);

// Store access tokens in memory for now (later we'll use a database)
let accessTokenStore = {};

// ── STEP 1: Create a Link Token ──
// This starts the Plaid connect flow in your app
app.post('/api/create_link_token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.body.userId || 'onelifeday-user' },
      client_name: 'OneLifeDay',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// ── STEP 2: Exchange Public Token for Access Token ──
// After user connects their bank, Plaid gives us a public token
// We swap it for a permanent access token
app.post('/api/exchange_token', async (req, res) => {
  try {
    const { public_token, userId } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = response.data.access_token;
    // Save it (in production, save this to a database)
    accessTokenStore[userId || 'onelifeday-user'] = accessToken;
    res.json({ success: true, message: 'Bank connected successfully!' });
  } catch (error) {
    console.error('Error exchanging token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to connect bank' });
  }
});

// ── STEP 3: Get Transactions ──
// Fetches the last 30 days of transactions from the connected bank
app.post('/api/transactions', async (req, res) => {
  try {
    const userId = req.body.userId || 'onelifeday-user';
    const accessToken = accessTokenStore[userId];
    if (!accessToken) {
      return res.status(400).json({ error: 'No bank connected. Please connect your bank first.' });
    }
    // Get last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
    });

    // Format transactions for OneLifeDay
    const transactions = response.data.transactions.map(txn => ({
      id: txn.transaction_id,
      name: txn.name,
      amount: txn.amount,
      date: txn.date,
      category: txn.category?.[0] || 'Other',
      logo: txn.logo_url || null,
    }));

    res.json({ transactions, total: transactions.length });
  } catch (error) {
    console.error('Error fetching transactions:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ── STEP 4: Get Account Balance ──
app.post('/api/balance', async (req, res) => {
  try {
    const userId = req.body.userId || 'onelifeday-user';
    const accessToken = accessTokenStore[userId];
    if (!accessToken) {
      return res.status(400).json({ error: 'No bank connected.' });
    }
    const response = await plaidClient.accountsBalanceGet({ access_token: accessToken });
    const accounts = response.data.accounts.map(acc => ({
      name: acc.name,
      type: acc.type,
      balance: acc.balances.current,
      available: acc.balances.available,
    }));
    res.json({ accounts });
  } catch (error) {
    console.error('Error fetching balance:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// ── Root redirect ──
app.get('/', (req, res) => {
  res.redirect('/onelifeday.html');
});

// ── Start Server ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 OneLifeDay server running on port ${PORT}`);
  console.log(`🔗 Open http://localhost:${PORT} to test`);
});