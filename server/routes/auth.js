const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const isString = (v) => typeof v === 'string';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, try again later' },
});

const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many MFA attempts, try again later' },
});

function signSession(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function signMfaChallenge(user) {
  return jwt.sign({ id: user._id, mfa: 'pending' }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!isString(username) || !isString(email) || !isString(password))
    return res.status(400).json({ message: 'Invalid input' });

  if (!username || !email || !password)
    return res.status(400).json({ message: 'All fields are required' });

  if (password.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters' });

  try {
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing)
      return res.status(409).json({ message: 'Username or email already in use' });

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, password: hash, role: 'user' });

    const token = signSession(user);
    res.status(201).json({ token, username: user.username, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!isString(email) || !isString(password))
    return res.status(400).json({ message: 'Invalid input' });

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: 'Invalid credentials' });

    if (user.mfaEnabled) {
      const mfaToken = signMfaChallenge(user);
      return res.json({ mfaRequired: true, mfaToken });
    }

    const token = signSession(user);
    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login/mfa
router.post('/login/mfa', mfaLimiter, async (req, res) => {
  const { mfaToken, code } = req.body || {};
  if (!isString(mfaToken) || !isString(code))
    return res.status(400).json({ message: 'mfaToken and code required' });

  let payload;
  try {
    payload = jwt.verify(mfaToken, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired challenge' });
  }
  if (payload.mfa !== 'pending')
    return res.status(401).json({ message: 'Invalid challenge token' });

  try {
    const user = await User.findById(payload.id).select('+mfaSecret');
    if (!user || !user.mfaEnabled || !user.mfaSecret)
      return res.status(401).json({ message: 'MFA not configured' });

    const ok = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code.replace(/\s/g, ''),
      window: 1,
    });
    if (!ok)
      return res.status(401).json({ message: 'Invalid code' });

    const token = signSession(user);
    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/mfa/setup -- generate pending secret + QR
router.post('/mfa/setup', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('+mfaSecret');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.mfaEnabled) return res.status(409).json({ message: 'MFA already enabled' });

    const secret = speakeasy.generateSecret({
      name: `DealQuest (${user.username})`,
      issuer: 'DealQuest',
      length: 20,
    });

    user.mfaSecret = secret.base32;
    await user.save();

    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url, qrDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/mfa/enable -- verify code, flip enabled flag
router.post('/mfa/enable', auth, mfaLimiter, async (req, res) => {
  const { code } = req.body || {};
  if (!isString(code)) return res.status(400).json({ message: 'code required' });

  try {
    const user = await User.findById(req.userId).select('+mfaSecret');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.mfaEnabled) return res.status(409).json({ message: 'MFA already enabled' });
    if (!user.mfaSecret) return res.status(400).json({ message: 'Run setup first' });

    const ok = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code.replace(/\s/g, ''),
      window: 1,
    });
    if (!ok) return res.status(401).json({ message: 'Invalid code' });

    user.mfaEnabled = true;
    await user.save();
    res.json({ mfaEnabled: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/mfa/disable -- requires current code
router.post('/mfa/disable', auth, mfaLimiter, async (req, res) => {
  const { code } = req.body || {};
  if (!isString(code)) return res.status(400).json({ message: 'code required' });

  try {
    const user = await User.findById(req.userId).select('+mfaSecret');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.mfaEnabled) return res.status(409).json({ message: 'MFA not enabled' });

    const ok = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code.replace(/\s/g, ''),
      window: 1,
    });
    if (!ok) return res.status(401).json({ message: 'Invalid code' });

    user.mfaEnabled = false;
    user.mfaSecret = null;
    await user.save();
    res.json({ mfaEnabled: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/mfa/status
router.get('/mfa/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('mfaEnabled');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ mfaEnabled: !!user.mfaEnabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
