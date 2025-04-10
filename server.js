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

// مدل کاربر
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

// مدل کاربر موقت برای تأیید از طریق تلگرام
const PendingUser = mongoose.model("PendingUser", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// سرو فایل‌های استاتیک (مثلاً index.html و pending.html)
app.use(express.static(path.join(__dirname, "public")));

// ارسال اطلاعات به تلگرام برای تأیید
app.post("/api/register-request", async (req, res) => {
  const { name, phone, username, password } = req.body;

  try {
    // ذخیره موقت اطلاعات در PendingUser
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

    // ارسال پیام به تلگرام
    const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ تأیید ثبت‌نام", url: approveUrl }],
        ],
      },
    });

    // اگر پیام با موفقیت ارسال شد، ریدایرکت به صفحه انتظار
    if (response.data.ok) {
      return res.redirect(`/pending.html?phone=${phone}`);
    } else {
      console.error("پاسخ تلگرام:", response.data);
      return res.status(500).send("❌ خطا در ارسال پیام تلگرام");
    }
  } catch (err) {
    console.error("خطا در ثبت‌نام یا ارسال:", err.message);
    return res.status(500).send("❌ ارسال اطلاعات با خطا مواجه شد.");
  }
});

// مسیر تأیید که ادمین از طریق دکمه می‌زنه
app.get("/api/approve", async (req, res) => {
  const { phone } = req.query;

  try {
    // پیدا کردن اطلاعات موقت کاربر
    const pendingUser = await PendingUser.findOne({ phone });
    if (!pendingUser) return res.send("❌ اطلاعات موقت پیدا نشد.");

    // چک کردن اینکه کاربر قبلاً ثبت شده باشد
    const existing = await User.findOne({ phone });
    if (existing) return res.send("⚠️ این کاربر قبلاً ثبت‌نام کرده است.");

    // ثبت کاربر در دیتابیس اصلی
    await User.create({
      name: pendingUser.name,
      phone: pendingUser.phone,
      username: pendingUser.username,
      password: pendingUser.password,
    });

    // حذف اطلاعات موقت
    await PendingUser.deleteOne({ phone });

    res.send("✅ کاربر با موفقیت ثبت شد.");
  } catch (err) {
    res.status(500).send("❌ خطا در ثبت کاربر.");
  }
});

// fallback برای مسیرهای ناشناس (در صورت SPA نبودن لازم نیست)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// راه‌اندازی سرور
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
