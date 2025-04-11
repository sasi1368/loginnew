const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// اتصال به دیتابیس MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ارسال درخواست ثبت‌نام به تلگرام
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

  const approveUrl = `${process.env.SERVER_URL}/api/approve?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

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
    res.status(500).json({ message: "خطا در ارسال به تلگرام" });
  }
});

// تایید ثبت‌نام توسط ادمین
app.get("/api/approve", async (req, res) => {
  const { name, phone, username, password } = req.query;

  try {
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.send("⚠️ این کاربر قبلاً ثبت‌نام کرده است.");
    }

    // ثبت کاربر جدید در دیتابیس
    await User.create({ name, phone, username, password });
    // ریدایرکت به صفحه تایید در سایت
    res.redirect(`${process.env.CLIENT_URL}/?status=approved`);
  } catch (err) {
    res.status(500).send("❌ خطا در ثبت کاربر.");
  }
});

// fallback برای مسیرهای ناشناس
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
