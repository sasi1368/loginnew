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

// مدل‌ها
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

const PendingUser = mongoose.model("PendingUser", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

const Patient = mongoose.model("Patient", new mongoose.Schema({
  name: String,
  phone: String,
  code: String,
  visited: { type: Boolean, default: false },
}));

// میدلورها
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// API: لاگین کاربر
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

// API: ارسال درخواست ثبت‌نام به تلگرام
app.post("/api/register-request", async (req, res) => {
  const { name, phone, username, password } = req.body;

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_ID;
  const approveUrl = `${process.env.SERVER_URL}/api/approve?phone=${encodeURIComponent(phone)}`;

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

    // ذخیره در PendingUser
    await PendingUser.create({ name, phone, username, password });

    res.json({ message: "درخواست ثبت‌نام ارسال شد." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "خطا در ارسال به تلگرام یا ذخیره کاربر." });
  }
});

// API: تأیید ثبت‌نام و انتقال از PendingUser به User
app.get("/api/approve", async (req, res) => {
  const { phone } = req.query;

  try {
    const pendingUser = await PendingUser.findOne({ phone });
    if (!pendingUser) {
      return res.send("❌ کاربر موردنظر در لیست انتظار یافت نشد.");
    }

    const exists = await User.findOne({ phone });
    if (exists) {
      return res.send("⚠️ این کاربر قبلاً ثبت‌نام کرده است.");
    }

    await User.create({
      name: pendingUser.name,
      phone: pendingUser.phone,
      username: pendingUser.username,
      password: pendingUser.password,
    });

    await PendingUser.deleteOne({ phone });

    res.send("✅ کاربر با موفقیت تأیید و ثبت شد.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطا در تأیید ثبت‌نام.");
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

// API: آمار بیماران مراجعه‌کرده
app.get("/api/patients/stats", async (req, res) => {
  try {
    const visitedCount = await Patient.countDocuments({ visited: true });
    res.json({ visited: visitedCount });
  } catch (err) {
    res.status(500).json({ visited: 0 });
  }
});

// fallback برای مسیرهای ناشناس
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// اجرا
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
