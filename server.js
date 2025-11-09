require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sgMail = require('@sendgrid/mail');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Store OTP codes in memory (demo)
const codes = new Map();

// Generate 6-digit OTP
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Temporary test route to check email sending
app.get('/test-email', async (req, res) => {
  try {
    const msg = {
      to: 'your-email@example.com', // replace with your email
      from: process.env.MAIL_FROM,
      subject: 'Render Test Email via SendGrid',
      text: 'This is a test email sent using SendGrid from your Render server.',
    };
    await sgMail.send(msg);
    res.send('Test email sent! Check your inbox.');
  } catch (err) {
    console.error('Test email failed:', err);
    res.status(500).send('Test email failed. Check logs.');
  }
});

// Send OTP email
async function sendOtpEmail(to, code) {
  try {
    const msg = {
      to,
      from: process.env.MAIL_FROM,
      subject: 'Your verification code',
      text: `Your verification code is: ${code}. It expires in 5 minutes.`,
    };
    await sgMail.send(msg);
    console.log('OTP email sent to', to);
  } catch (err) {
    console.error('Failed to send OTP email:', err);
    throw err;
  }
}

// Endpoint to send OTP
app.post('/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, message: 'Email required' });

  const code = generateCode();
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
  codes.set(email, { code, expires });

  try {
    await sendOtpEmail(email, code);
    res.json({ ok: true, message: 'Code sent' });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Failed to send code' });
  }
});

// Endpoint to verify OTP
app.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ ok: false, message: 'Email and code required' });

  const record = codes.get(email);
  if (!record) return res.status(400).json({ ok: false, message: 'No code sent for this email' });

  if (Date.now() > record.expires) {
    codes.delete(email);
    return res.status(400).json({ ok: false, message: 'Code expired' });
  }

  if (record.code !== code) return res.status(400).json({ ok: false, message: 'Invalid code' });

  codes.delete(email);
  res.json({ ok: true, message: 'Verified' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
