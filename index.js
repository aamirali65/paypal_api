const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PayPal config
const PAYPAL_API = process.env.PAYPAL_API;
const CLIENT = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Get PayPal Access Token
async function getAccessToken() {
  const response = await axios({
    url: `${PAYPAL_API}/v1/oauth2/token`,
    method: 'post',
    auth: {
      username: CLIENT,
      password: SECRET,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: 'grant_type=client_credentials',
  });

  return response.data.access_token;
}

// ✅ Create PayPal Order
app.post('/create-order', async (req, res) => {
  const { total } = req.body;

  try {
    const accessToken = await getAccessToken();

    const order = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: total.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: 'https://paypalapi-production.up.railway.app/success',
          cancel_url: 'https://paypalapi-production.up.railway.app/cancel',
        },
        
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const approvalLink = order.data.links.find(link => link.rel === 'approve');

    if (!approvalLink) {
      return res.status(500).json({ error: 'Approval URL not found' });
    }

    res.json({ approvalUrl: approvalLink.href });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// ✅ Capture PayPal Payment
app.post('/capture-order', async (req, res) => {
  const { orderID } = req.body;

  try {
    const accessToken = await getAccessToken();

    const capture = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json(capture.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
});

// ✅ Success Page (for WebView or browser redirect)
app.get('/success', (req, res) => {
  const { token } = req.query;
  res.send(`✅ Payment approved. Order ID: ${token}`);
});

// ✅ Cancel Page
app.get('/cancel', (req, res) => {
  res.send('❌ Payment was cancelled.');
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
