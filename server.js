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
})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ Error connecting to MongoDB:", err));

// مدل کاربر
const UserSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true },
  username: String,
  password: String,
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' }, // وضعیت کاربر
});

const User = mongoose.model("User", UserSchema);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// سرو فایل‌های استاتیک
app.use(express.static(path.join(__dirname, "public")));

// لاگین کاربر
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password, status: 'approved' }); // فقط کاربران تأیید شده
    if (!user) {
      return res.json({ success: false });
    }
    res.json({ success: true, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ثبت درخواست ثبت‌نام و ارسال به تلگرام
app.post("/api/register-request", async (req, res) => {
  const { name, phone, username, password } = req.body;

  if (!name || !phone || !username || !password) {
    return res.status(400).json({ message: "لطفاً همه فیلدها را پر کنید" });
  }

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
    // ثبت‌نام در User با وضعیت "در انتظار"
    await User.create({ name, phone, username, password });

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

    res.json({ message: "درخواست ثبت‌نام ارسال شد." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "خطا در ارسال به تلگرام" });
  }
});

// تأیید ثبت‌نام توسط ادمین
app.get("/api/approve", async (req, res) => {
  const { phone } = req.query;

  try {
    // پیدا کردن کاربر با شماره تماس
    const pendingUser = await User.findOne({ phone, status: 'pending' });
    if (!pendingUser) {
      return res.send("❌ کاربر در وضعیت انتظار پیدا نشد.");
    }

    // به روز رسانی وضعیت کاربر به "approved"
    pendingUser.status = 'approved';
    await pendingUser.save();

    res.send("✅ کاربر با موفقیت ثبت شد.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطا در ثبت کاربر.");
  }
});

// fallback برای SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// اجرا
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
