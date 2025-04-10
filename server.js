const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// اتصال به دیتابیس
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// مدل‌های دیتابیس
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

// تنظیمات میانی
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// فایل‌های استاتیک
app.use(express.static(path.join(__dirname, "public")));

// درخواست ثبت‌نام و ارسال به تلگرام
app.post("/api/register-request", async (req, res) => {
  const { name, phone, username, password } = req.body;

  try {
    // ذخیره کاربر در لیست انتظار
    await PendingUser.create({ name, phone, username, password });

    const token = process.env.BOT_TOKEN;
    const chatId = process.env.ADMIN_CHAT_ID;
    const approveUrl = `${process.env.SERVER_URL}/api/approve?phone=${encodeURIComponent(phone)}`;

    const message = `
👤 درخواست ثبت‌نام جدید:
📛 نام: ${name}
📱 شماره: ${phone}
👤 نام کاربری: ${username}

✅ برای تأیید، روی دکمه زیر کلیک کنید.
`;

    // ارسال به تلگرام
    const telegramRes = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ تأیید ثبت‌نام", url: approveUrl }]
        ]
      }
    });

    // بررسی موفقیت ارسال پیام
    if (telegramRes.data.ok) {
      res.redirect(`/pending.html?phone=${phone}`);
    } else {
      console.error("پاسخ تلگرام:", telegramRes.data);
      res.status(500).send("خطا در ارسال پیام تلگرام");
    }
  } catch (err) {
    console.error("خطا:", err.message);
    res.status(500).send("ارسال اطلاعات با خطا مواجه شد.");
  }
});

// مسیر تأیید از طرف ادمین
app.get("/api/approve", async (req, res) => {
  const { phone } = req.query;

  try {
    const pendingUser = await PendingUser.findOne({ phone });
    if (!pendingUser) return res.send("❌ کاربر در لیست انتظار یافت نشد.");

    const exists = await User.findOne({ phone });
    if (exists) return res.send("⚠️ این کاربر قبلاً ثبت‌نام کرده است.");

    await User.create({
      name: pendingUser.name,
      phone: pendingUser.phone,
      username: pendingUser.username,
      password: pendingUser.password,
    });

    await PendingUser.deleteOne({ phone });

    // بعد از تأیید، ریدایرکت به لاگین با پیام
    res.redirect(`/login.html?status=approved`);
  } catch (err) {
    console.error("خطا در تأیید:", err.message);
    res.status(500).send("❌ خطا در تأیید کاربر.");
  }
});

// fallback برای SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
