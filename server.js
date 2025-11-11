require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// --- SendGrid setup ---
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- In-memory OTP storage ---
const codes = new Map();

// --- Files ---
const USERS_FILE = path.join(__dirname, 'users.json');
const POSTS_FILE = path.join(__dirname, 'posts.json');

// --- Helper functions ---
// Load/save users
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE));
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Load/save posts
function loadPosts() {
  if (!fs.existsSync(POSTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(POSTS_FILE));
}
function savePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// Generate OTP
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email
async function sendOtpEmail(to, code) {
  const msg = {
    to,
    from: process.env.MAIL_FROM,
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

// --- Routes ---

// 1️⃣ Send OTP
app.post('/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, message: 'Email required' });

  const code = generateCode();
  const expires = Date.now() + 5 * 60 * 1000; // 5 min
  codes.set(email, { code, expires });

  try {
    await sendOtpEmail(email, code);
    res.json({ ok: true, message: 'OTP sent' });
  } catch {
    res.status(500).json({ ok: false, message: 'Failed to send OTP' });
  }
});

// 2️⃣ Verify OTP
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

// 3️⃣ Save verified user account
app.post('/save-account', (req, res) => {
  const { username, email, password, date, gender } = req.body;
  if (!username || !email || !password || !date || !gender) {
    return res.status(400).json({ ok: false, message: 'Missing required fields' });
  }

  const users = loadUsers();
  if (users.find(u => u.email === email)) {
    return res.json({ ok: false, message: 'Email already registered' });
  }

  users.push({ username, email, password, date, gender, createdAt: new Date() });
  saveUsers(users);

  console.log(`✅ User saved: ${username} (${email})`);
  res.json({ ok: true, message: 'Account saved successfully' });
});

// 4️⃣ Login route
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ ok: false, message: 'Email and password required' });

  const users = loadUsers();
  const user = users.find(u => u.email === email);

  if (!user) return res.json({ ok: false, message: 'No account found with this email.' });
  if (user.password !== password) return res.json({ ok: false, message: 'Incorrect password.' });

  console.log(`✅ ${user.username} logged in`);
  res.json({ ok: true, message: 'Login successful!', user });
});

// 5️⃣ Posts API
// Get all posts
app.get('/api/posts', (req, res) => {
  const posts = loadPosts();
  res.json(posts);
});

// Add a post
app.post('/api/posts', (req, res) => {
  const { username, content } = req.body;
  if (!username || !content) return res.status(400).json({ ok: false, message: 'Missing username or content' });

  const posts = loadPosts();
  const newPost = {
    id: Date.now(),
    username,
    content,
    time: new Date().toLocaleString()
  };
  posts.unshift(newPost);
  savePosts(posts);

  res.json({ ok: true, post: newPost });
});

// --- Cleanup expired OTPs ---
setInterval(() => {
  const now = Date.now();
  for (const [email, { expires }] of codes) {
    if (now > expires) codes.delete(email);
  }
}, 5 * 60 * 1000);

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
