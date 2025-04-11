// server.js
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

// مدل‌های پایگاه داده
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  phoneNumber: { type: String, unique: true, required: true },
  username: String,
  password: String,
}));

const PendingUser = mongoose.model("PendingUser", new mongoose.Schema({
  name: String,
  phoneNumber: { type: String, required: true },
  username: String,
  password: String,
}));

const Patient = mongoose.model("Patient", new mongoose.Schema({
  name: String,
  phone: String,
  code: String,
  visited: { type: Boolean, default: false },
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// API: ورود کاربر
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (!user) return res.json({ success: false });
    res.json({ success: true, name: user.name });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false });
  }
});

// API: ثبت‌نام اولیه و ارسال به تلگرام
app.post("/api/register-request", async (req, res) => {
  const { name, phoneNumber, username, password } = req.body;
  if (!name || !phoneNumber || !username || !password) {
    return res.status(400).json({ message: "اطلاعات ناقص است." });
  }

  try {
    const alreadyPending = await PendingUser.findOne({ phoneNumber });
    if (alreadyPending) {
      return res.status(400).json({ message: "در حال انتظار تأیید است." });
    }

    await PendingUser.create({ name, phoneNumber, username, password });

    const approveUrl = `${process.env.SERVER_URL}/api/approve?phoneNumber=${encodeURIComponent(phoneNumber)}`;

    const message = `👤 درخواست ثبت‌نام جدید:\n📛 نام: ${name}\n📱 شماره: ${phoneNumber}\n👤 نام کاربری: ${username}`;

    await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.ADMIN_CHAT_ID,
      text: message,
      reply_markup: {
        inline_keyboard: [[{ text: "✅ تأیید ثبت‌نام", url: approveUrl }]],
      },
    });

    res.json({ message: "درخواست ثبت‌نام ارسال شد." });
  } catch (err) {
    console.error("Register Request Error:", err);
    res.status(500).json({ message: "خطا در ارسال درخواست یا ذخیره اطلاعات." });
  }
});

// API: تأیید ثبت‌نام توسط ادمین
app.get("/api/approve", async (req, res) => {
  const { phoneNumber } = req.query;
  try {
    const pendingUser = await PendingUser.findOne({ phoneNumber });
    if (!pendingUser) return res.send("❌ کاربری با این شماره در انتظار نیست.");

    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) return res.send("⚠️ کاربر قبلاً ثبت شده است.");

    await User.create({
      name: pendingUser.name,
      phoneNumber: pendingUser.phoneNumber,
      username: pendingUser.username,
      password: pendingUser.password,
    });

    await PendingUser.deleteOne({ phoneNumber });

    res.send("✅ ثبت‌نام با موفقیت انجام شد.");
  } catch (err) {
    console.error("Approval Error:", err);
    res.status(500).send("❌ خطا در تأیید ثبت‌نام.");
  }
});

// API: ثبت بیمار
app.post("/api/patients", async (req, res) => {
  const { name, phone, code } = req.body;
  if (!name || !phone || !code) return res.json({ success: false, message: "اطلاعات ناقص است." });

  try {
    await Patient.create({ name, phone, code });
    res.json({ success: true });
  } catch (err) {
    console.error("Patient Save Error:", err);
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

// fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
