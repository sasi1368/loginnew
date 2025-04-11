const express = require('express');
const router = express.Router();
const User = require('./models/User'); // مسیر رو با توجه به ساختار پروژه تنظیم کن

router.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user || user.password !== password) {
      return res.json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است' });
    }

    // ورود موفق
    return res.json({ success: true });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'خطای سرور' });
  }
});

module.exports = router;
