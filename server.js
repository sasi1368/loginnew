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

// مدل یوزر
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ارائه فایل‌های استاتیک مثل index.html از پوشه public
app.use(express.static(path.join(__dirname, "public")));

// ➕ API: ارسال درخواست ثبت‌نام به تلگرام
app.post("/api/register-request", async (req, res) => {
  const { name, phone, username, password } = req.body;

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_ID;
  const serverUrl = process.env.SERVER_URL;

  const message = `
👤 درخواست ثبت‌نام جدید:
📛 نام: ${name}
📱 شماره: ${phone}
👤 نام کاربری: ${username}

برای تأیید، روی دکمه زیر کلیک کنید:
`;

  const approveUrl = `${serverUrl}/api/approve?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

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

    res.json({ message: "درخواست ثبت‌نام ارسال شد، منتظر تأیید ادمین باشید." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ خطا در ارسال اطلاعات به تلگرام" });
  }
});

// ✅ API: تأیید ثبت‌نام از سمت ادمین
app.get("/api/approve", async (req, res) => {
  const { name, phone, username, password } = req.query;

  try {
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.send("⚠️ این کاربر قبلاً ثبت‌نام کرده است.");
    }

    await User.create({ name, phone, username, password });
    res.send("✅ کاربر با موفقیت ثبت شد.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطا در ثبت کاربر.");
  }
});

// 🟡 API: بررسی وضعیت تأیید کاربر
app.get("/api/check-status", async (req, res) => {
  const { phone } = req.query;

  try {
    const user = await User.findOne({ phone });

    if (user) {
      return res.json({ status: "approved" });
    } else {
      return res.json({ status: "pending" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: "خطا در بررسی وضعیت." });
  }
});

// fallback برای SPA یا صفحات دیگر
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// اجرای سرور
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
