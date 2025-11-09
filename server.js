require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// Serve frontend files (index.html etc.)
app.use(express.static(path.join(__dirname)));

// Store codes in memory (for demo)
const codes = new Map();

// Generate 6-digit OTP
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create transporter for sending emails
// ✅ Gmail Example
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // must be false for port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Optional: SendGrid Example (uncomment if using SendGrid)
/*
const transporter = nodemailer.createTransport({
  service: 'SendGrid',
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});
*/

async function sendOtpEmail(to, code) {
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject: 'Your verification code',
      text: `Your verification code is: ${code}. It expires in 5 minutes.`,
    });
    console.log('Email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('Failed to send email:', err);
    throw err;
  }
}

// Send OTP endpoint
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

// Verify OTP endpoint
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
