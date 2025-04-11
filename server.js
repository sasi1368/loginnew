const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  phone: String,
  username: String,
  password: String,
  approved: { type: Boolean, default: false }, // افزودن فیلد approved
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// سرو فایل‌های استاتیک (مثلاً index.html)
app.use(express.static(path.join(__dirname, "public")));

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

  const approveUrl = `${process.env.SERVER_URL}/api/approve?phone=${encodeURIComponent(phone)}`;

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
  const { phone } = req.query;

  try {
    // جستجو برای کاربر بر اساس شماره تلفن
    const user = await User.findOne({ phone });

    if (!user) {
      return res.send("⚠️ این کاربر پیدا نشد.");
    }

    // تغییر وضعیت تایید
    user.approved = true;
    await user.save();

    // ارسال پیغام تایید به تلگرام و تغییر وضعیت صفحه
    res.redirect(`${process.env.FRONTEND_URL}/confirmation.html?status=approved`);
  } catch (err) {
    console.error("خطا در تایید ثبت‌نام:", err);
    res.status(500).send("❌ خطا در تایید ثبت‌نام.");
  }
});

// fallback برای مسیرهای ناشناس (در صورت SPA نبودن لازم نیست)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
