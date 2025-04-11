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

// مدل کاربر نهایی
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  phoneNumber: { type: String, unique: true },
  username: String,
  password: String,
}));

// مدل کاربر در انتظار تأیید
const PendingUser = mongoose.model("PendingUser", new mongoose.Schema({
  name: String,
  phoneNumber: String,
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
app.use(express.static(path.join(__dirname, "public")));

// API: لاگین
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

// API: ارسال درخواست ثبت‌نام
app.post("/api/register-request", async (req, res) => {
  const { name, phoneNumber, username, password } = req.body;

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_ID;

  const approveUrl = `${process.env.SERVER_URL}/api/approve?name=${encodeURIComponent(name)}&phoneNumber=${encodeURIComponent(phoneNumber)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  const message = `
👤 درخواست ثبت‌نام جدید:
📛 نام: ${name}
📱 شماره: ${phoneNumber}
👤 نام کاربری: ${username}

برای تأیید، روی دکمه زیر کلیک کنید:
  `;

  try {
    await PendingUser.create({ name, phoneNumber, username, password });

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
    res.status(500).json({ message: "خطا در ارسال به تلگرام یا ذخیره‌سازی." });
  }
});

// API: تأیید توسط ادمین
app.get("/api/approve", async (req, res) => {
  const { phoneNumber } = req.query;

  try {
    const pendingUser = await PendingUser.findOne({ phoneNumber });
    if (!pendingUser) {
      return res.send("❌ کاربری با این شماره در حالت انتظار نیست.");
    }

    // بررسی وجود قبلی در کاربران نهایی
    const exists = await User.findOne({ phoneNumber });
    if (exists) {
      return res.send("⚠️ این کاربر قبلاً ثبت‌نام کرده است.");
    }

    // ایجاد کاربر و حذف از PendingUser
    await User.create({
      name: pendingUser.name,
      phoneNumber: pendingUser.phoneNumber,
      username: pendingUser.username,
      password: pendingUser.password,
    });

    await PendingUser.deleteOne({ phoneNumber });

    res.send("✅ ثبت‌نام با موفقیت انجام شد.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطا در ثبت کاربر.");
  }
});

// API: ثبت بیمار
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

// API: آمار بیماران
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

// شروع سرور
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
