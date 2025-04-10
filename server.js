const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// اتصال به MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// مدل کاربر موقت
const PendingUser = mongoose.model("PendingUser", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

// مدل کاربر اصلی
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// سرو فایل‌های استاتیک (مثلاً index.html)
app.use(express.static(path.join(__dirname, "public")));

// ثبت‌نام کاربر و ارسال به تلگرام برای تأیید ادمین
app.post("/api/register-request", async (req, res) => {
  const { name, phone, username, password } = req.body;

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_ID;

  const message = `
👤 درخواست ثبت‌نام جدید:
📛 نام: ${name}
📱 شماره: ${phone}
👤 نام کاربری: ${username}

برای تأیید، روی دکمه زیر کلیک کنید:
`;

  const approveUrl = `${process.env.SERVER_URL}/api/approve?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  try {
    // ذخیره موقت کاربر
    await PendingUser.create({ name, phone, username, password });

    // ارسال پیام به تلگرام
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ تأیید ثبت‌نام", url: approveUrl }],
        ],
      },
    });

    res.json({ message: "درخواست ثبت‌نام ارسال شد، منتظر تأیید ادمین باشید." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "خطا در ارسال به تلگرام" });
  }
});

// مسیر تأیید که ادمین از طریق لینک در تلگرام می‌زند
app.get("/api/approve", async (req, res) => {
  const { phone, name, username, password } = req.query;

  try {
    // چک کردن وجود کاربر موقت
    const pendingUser = await PendingUser.findOne({ phone });
    if (!pendingUser) {
      return res.send("❌ اطلاعات موقت پیدا نشد.");
    }

    // چک کردن اینکه کاربر قبلاً ثبت شده باشد
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.send("⚠️ این کاربر قبلاً ثبت‌نام کرده است.");
    }

    // ثبت کاربر در دیتابیس اصلی
    await User.create({
      name: pendingUser.name,
      phone: pendingUser.phone,
      username: pendingUser.username,
      password: pendingUser.password,
    });

    // حذف اطلاعات موقت کاربر
    await PendingUser.deleteOne({ phone });

    res.send("✅ کاربر با موفقیت ثبت شد.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطا در ثبت کاربر.");
  }
});

// fallback برای مسیرهای ناشناس (در صورت SPA نبودن لازم نیست)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// شروع سرور
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
