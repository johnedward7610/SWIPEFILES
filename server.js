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

// In-memory OTP storage (demo only)
const codes = new Map();

// Generate 6-digit OTP
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email
async function sendOtpEmail(to, code) {
  const msg = {
    to,
    from: process.env.MAIL_FROM, // Must be verified in SendGrid
    subject: 'Your Verification Code',
    text: `Your verification code is: ${code}. It expires in 5 minutes.`,
    html: `<p>Your verification code is: <b>${code}</b></p><p>It expires in 5 minutes.</p>`,
  };
  try {
    await sgMail.send(msg);
    console.log(`✅ OTP sent to ${to}`);
  } catch (err) {
    console.error('❌ Failed to send OTP:', err.response ? err.response.body : err);
    throw err;
  }
}

// Route to test email sending
app.get('/test-email', async (req, res) => {
  try {
    await sendOtpEmail('your-email@example.com', '123456'); // Replace with your email
    res.send('✅ Test email sent! Check your inbox.');
  } catch (err) {
    res.status(500).send('❌ Test email failed. Check server logs.');
  }
});

// Endpoint to request OTP
app.post('/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, message: 'Email required' });

  const code = generateCode();
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
  codes.set(email, { code, expires });

  try {
    await sendOtpEmail(email, code);
    res.json({ ok: true, message: 'OTP sent' });
  } catch {
    res.status(500).json({ ok: false, message: 'Failed to send OTP' });
  }
});

// Endpoint to verify OTP
app.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ ok: false, message: 'Email and code required' });

  const record = codes.get(email);
  if (!record) return res.status(400).json({ ok: false, message: 'No OTP found for this email' });

  if (Date.now() > record.expires) {
    codes.delete(email);
    return res.status(400).json({ ok: false, message: 'OTP expired' });
  }

  if (record.code !== code) return res.status(400).json({ ok: false, message: 'Invalid OTP' });

  codes.delete(email);
  res.json({ ok: true, message: '✅ Verified successfully' });
});

// Cleanup expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, { expires }] of codes) {
    if (now > expires) codes.delete(email);
  }
}, 5 * 60 * 1000);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
