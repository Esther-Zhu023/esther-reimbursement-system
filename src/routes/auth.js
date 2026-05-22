const express = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

const router = express.Router();

// Google OAuth 配置
// 在 Google Cloud Console 创建 OAuth 2.0 凭证：
// https://console.cloud.google.com/apis/credentials
//
// 配置要求：
//   已获授权的 JavaScript 来源: http://localhost:3456
//   已获授权的重定向 URI:       http://localhost:3456/auth/google/callback
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3456/auth/google/callback';

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    scope: ['profile', 'email'],
  }, (accessToken, refreshToken, profile, done) => {
    const user = {
      id: profile.id,
      email: profile.emails?.[0]?.value || '',
      name: profile.displayName || profile.name?.givenName || '未知用户',
      photo: profile.photos?.[0]?.value || '',
      provider: 'google',
    };
    return done(null, user);
  }));
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// 登录状态检查中间件
function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ success: false, error: '请先登录' });
}

// 路由
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=login_failed' }),
  (req, res) => {
    res.redirect('/');
  }
);

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.redirect('/');
  });
});

router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({ success: true, data: req.user });
  } else {
    res.json({ success: false, data: null });
  }
});

// Mock 登录（开发测试用）
router.post('/mock-login', (req, res) => {
  const mockUser = {
    id: 'mock-google-id',
    email: req.body.email || 'demo@company.com',
    name: req.body.name || '演示用户',
    photo: '',
    provider: 'mock',
  };
  req.login(mockUser, (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: mockUser });
  });
});

module.exports = { router, ensureAuth };
