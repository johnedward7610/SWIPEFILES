require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// Serve frontend files (index.html etc.)
app.use(express.static(path.join(__dirname)));

// Store OTP codes in memory (demo)
const codes = new Map();

// Generate 6-digit OTP
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create transporter with proper SSL and timeout
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),          // 465 for SSL
  secure: process.env.SMTP_SECURE === 'true',   // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,                // App password
  },
  logger: true,      // logs SMTP info
  debug: true,       // shows debug info
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
});

// Verify transporter immediately (helpful to catch connection issues)
transporter.verify((err, success) => {
  if (err) {
    console.error('SMTP connection failed:', err);
  } else {
    console.log('SMTP connection successful!');
  }
});

// Temporary test route to check email sending
app.get('/test-email', async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.SMTP_USER,
      subject: 'Render Test Email',
      text: 'This is a test email from your Render server.',
    });
    console.log('Test email sent:', info.messageId);
    res.send('Test email sent! Check your inbox.');
  } catch (err) {
    console.error('Test email failed:', err);
    res.status(500).send('Test email failed. Check logs.');
  }
});

// Send OTP email
async function sendOtpEmail(to, code) {
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: 'Your verification code',
      text: `Your verification code is: ${code}. It expires in 5 minutes.`,
    });
    console.log('OTP email sent:', info.messageId);
    return info;
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
