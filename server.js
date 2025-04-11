const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// اتصال به MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// مدل کاربر
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

// مدل بیمار
const Patient = mongoose.model("Patient", new mongoose.Schema({
  name: String,
  phone: String,
  code: String,
  visited: { type: Boolean, default: false },
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// سرو فایل‌های استاتیک
app.use(express.static(path.join(__dirname, "public")));

// لاگین کاربر
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.json({ success: false });
    }
    res.json({ success: true, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

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
    const exists = await User.findOne({ phone });
    if (exists) {
      return res.send("⚠️ این کاربر قبلاً ثبت‌نام کرده است.");
    }

    await User.create({ name, phone, username, password });
    res.send("✅ کاربر با موفقیت ثبت شد.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطا در ثبت کاربر.");
  }
});

// ثبت بیمار و تولید کد
app.post("/api/patients", async (req, res) => {
  const { name, phone, code } = req.body;

  if (!name || !phone || !code) {
    return res.json({ success: false, message: "اطلاعات ناقص است." });
  }

  try {
    await Patient.create({ name, phone, code });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "خطا در ذخیره بیمار." });
  }
});

// آمار بیماران مراجعه‌کرده
app.get("/api/patients/stats", async (req, res) => {
  try {
    const visitedCount = await Patient.countDocuments({ visited: true });
    res.json({ visited: visitedCount });
  } catch (err) {
    res.status(500).json({ visited: 0 });
  }
});

// fallback برای SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// اجرا
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
