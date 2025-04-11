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

// مدل کاربر (توجه به unique بودن فیلد phone)
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
}));

// مدل کاربر در حالت انتظار
const PendingUser = mongoose.model("PendingUser", new mongoose.Schema({
  name: String,
  phone: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// سرو فایل‌های استاتیک
app.use(express.static(path.join(__dirname, "public")));

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

    // ذخیره کاربر در PendingUser
    await PendingUser.create({ name, phone, username, password });

    res.json({ message: "درخواست ثبت‌نام ارسال شد." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "خطا در ارسال به تلگرام" });
  }
});

// تایید ثبت‌نام توسط ادمین
app.get("/api/approve", async (req, res) => {
  const { name, phone, username, password } = req.query;

  try {
    // چک کردن وجود کاربر در PendingUser
    const pendingUser = await PendingUser.findOne({ phone });

    if (!pendingUser) {
      return res.send("⚠️ این کاربر در حالت انتظار نیست.");
    }

    // چک کردن وجود کاربر در User
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.send("⚠️ این کاربر قبلاً ثبت‌نام کرده است.");
    }

    // انتقال کاربر از PendingUser به User
    await User.create({ name, phone, username, password });

    // حذف کاربر از PendingUser
    await PendingUser.deleteOne({ phone });

    res.send("✅ کاربر با موفقیت ثبت شد.");
  } catch (err) {
    console.error("Error during approval:", err);
    res.status(500).send("❌ خطا در تایید ثبت‌نام.");
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
