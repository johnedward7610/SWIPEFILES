require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// Serve your frontend files
app.use(express.static(path.join(__dirname))); // serves index.html and any other files in the same folder

// Store codes in memory (demo)
const codes = new Map();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sendOtpEmail(to, code) {
  const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: 'Your verification code',
    text: `Your verification code is: ${code}. It expires in 5 minutes.`
  });
}

// Send code endpoint
app.post('/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, message: 'Email required' });

  const code = generateCode();
  const expires = Date.now() + 5*60*1000; // 5 min
  codes.set(email, { code, expires });

  try {
    await sendOtpEmail(email, code);
    res.json({ ok: true, message: 'Code sent' });
  } catch(err) {
    console.error(err);
    res.status(500).json({ ok:false, message:'Failed to send code' });
  }
});

// Verify code endpoint
app.post('/verify-code', (req,res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ ok:false, message:'Email and code required' });

  const record = codes.get(email);
  if (!record) return res.status(400).json({ ok:false, message:'No code sent for this email' });

  if (Date.now() > record.expires) {
    codes.delete(email);
    return res.status(400).json({ ok:false, message:'Code expired' });
  }

  if (record.code !== code) return res.status(400).json({ ok:false, message:'Invalid code' });

  codes.delete(email);
  res.json({ ok:true, message:'Verified' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
