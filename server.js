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

// مدل کاربر تایید شده
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

// مدل کاربر در حالت انتظار
const PendingUser = mongoose.model("PendingUser", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// سرو فایل‌های استاتیک (مثلاً index.html)
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

// تایید ثبت‌نام و انتقال به User
app.get("/api/approve", async (req, res) => {
  const { name, phone, username, password } = req.query;

  try {
    // چک کردن وجود کاربر در PendingUser
    const pendingUser = await PendingUser.findOne({ phone });
    if (!pendingUser) {
      return res.send("⚠️ این کاربر در حالت انتظار نیست.");
    }

    // فقط ثبت کاربر جدید در User
    await User.create({ name, phone, username, password });

    res.send("✅ کاربر با موفقیت ثبت شد.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطا در تایید ثبت‌نام.");
  }
});

// مسیر دیگر برای صفحه داشبورد (در صورت نیاز)
app.get("/dashboard", (req, res) => {
  // اطلاعات را از دیتابیس به صفحه داشبورد ارسال می‌کنید
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// fallback برای مسیرهای ناشناس
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// اجرا
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
