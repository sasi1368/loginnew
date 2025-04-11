const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// اتصال به MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// مدل کاربران تایید شده
const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

// وارد کردن مدل PendingUser
const PendingUser = require('./models/PendingUser');

// تنظیمات express
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ثبت درخواست ثبت‌نام و ارسال به تلگرام
app.post("/api/register-request", async (req, res) => {
  const { name, phone, username, password } = req.body;

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_ID;

  const approveUrl = `${process.env.SERVER_URL}/api/approve?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  const message = `
  👤 درخواست ثبت‌نام جدید:
  📛 نام: ${name}
  📱 شماره: ${phone}
  👤 نام کاربری: ${username}

  برای تأیید، روی دکمه زیر کلیک کنید:
  `;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ تأیید ثبت‌نام", url: approveUrl }],
        ],
      },
    });

    // ذخیره درخواست ثبت‌نام در PendingUser
    const pendingUser = new PendingUser({ name, phone, username, password });
    await pendingUser.save();

    res.json({ message: "درخواست ثبت‌نام ارسال شد." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "خطا در ارسال به تلگرام" });
  }
});

// تأیید ثبت‌نام توسط ادمین
app.get("/api/approve", async (req, res) => {
  const { name, phone, username, password } = req.query;

  try {
    // بررسی وجود کاربر در PendingUser
    const pendingUser = await PendingUser.findOne({ phone });
    if (!pendingUser) {
      return res.send("⚠️ این کاربر در حالت انتظار نیست.");
    }

    // بررسی وجود کاربر در کاربران تایید شده
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.send("⚠️ این کاربر قبلاً ثبت‌نام کرده است.");
    }

    // انتقال اطلاعات از PendingUser به User
    const newUser = new User({ name, phone, username, password });
    await newUser.save();

    // حذف کاربر از PendingUser
    await PendingUser.deleteOne({ phone });

    res.send("✅ کاربر با موفقیت ثبت شد.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطا در ثبت کاربر.");
  }
});

// اجرا
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
