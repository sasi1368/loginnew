const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// اتصال به دیتابیس MongoDB
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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ثبت‌نام: ارسال به تلگرام و ذخیره در pending
app.post("/api/register-request", async (req, res) => {
  const { name, phone, username, password } = req.body;

  try {
    await PendingUser.create({ name, phone, username, password });

    const token = process.env.BOT_TOKEN;
    const chatId = process.env.ADMIN_CHAT_ID;
    const approveUrl = `${process.env.SERVER_URL}/api/approve?phone=${encodeURIComponent(phone)}`;

    const message = `
👤 درخواست ثبت‌نام جدید:
📛 نام: ${name}
📱 شماره: ${phone}
👤 نام کاربری: ${username}

برای تأیید روی دکمه زیر کلیک کنید:
    `;

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ تأیید ثبت‌نام", url: approveUrl }],
        ],
      },
    });

    // بعد از ارسال به تلگرام، کاربر به صفحه pending هدایت شود
    res.redirect(`/pending.html?phone=${encodeURIComponent(phone)}`);
  } catch (err) {
    console.error("خطا در ارسال:", err);
    res.status(500).send("خطا در ارسال اطلاعات ثبت‌نام");
  }
});

// بررسی تأیید شدن توسط ادمین (برای pending.html)
app.get("/api/check-status", async (req, res) => {
  const { phone } = req.query;
  try {
    const user = await User.findOne({ phone });
    res.json({ approved: !!user });
  } catch (err) {
    console.error("خطا در بررسی وضعیت:", err);
    res.status(500).json({ approved: false });
  }
});

// مسیر تأیید توسط ادمین از تلگرام
app.get("/api/approve", async (req, res) => {
  const { phone } = req.query;

  try {
    const pending = await PendingUser.findOne({ phone });
    if (!pending) return res.send("❌ اطلاعات موقت یافت نشد.");

    const exists = await User.findOne({ phone });
    if (exists) return res.send("⚠️ کاربر قبلاً ثبت‌نام کرده است.");

    await User.create({
      name: pending.name,
      phone: pending.phone,
      username: pending.username,
      password: pending.password,
    });

    await PendingUser.deleteOne({ phone });

    // ریدایرکت به login با پیام
    res.redirect("/login.html?message=approved");
  } catch (err) {
    console.error("خطا در تأیید کاربر:", err);
    res.status(500).send("❌ خطا در تأیید.");
  }
});

// fallback برای SPA یا فایل‌های ناشناس
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
