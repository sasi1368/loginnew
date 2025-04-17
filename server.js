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

// مدل‌ها
const UserSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true },
  username: String,
  password: String,
  fingerprint: String,
  deviceId: String,
});

const PendingUserSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, unique: true },
  username: String,
  password: String,
  fingerprint: String,
  deviceId: String,
});

const PatientSchema = new mongoose.Schema({
  name: String,
  phone: String,
  code: String,
  approved: { type: Boolean, default: false },
  visited: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  createdBy: String
});

const User = mongoose.model("User", UserSchema);
const PendingUser = mongoose.model("PendingUser", PendingUserSchema);
const Patient = mongoose.model("Patient", PatientSchema);

// میانی‌ها
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ورود
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (user) {
      return res.json({ success: true, name: user.name, username });
    }

    const pending = await PendingUser.findOne({ username, password });
    if (pending) {
      return res.json({ success: false, message: "حساب شما هنوز تایید نشده است." });
    }

    res.json({ success: false, message: "نام کاربری یا رمز اشتباه است." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "خطای سرور" });
  }
});

// ثبت درخواست ثبت‌نام
app.post("/api/register-request", async (req, res) => {
  const { name, phone, username, password, fingerprint, deviceId } = req.body;
  if (!name || !phone || !username || !password || !fingerprint || !deviceId) {
    return res.status(400).json({ message: "لطفاً همه فیلدها را پر کنید" });
  }

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_ID;
  const approveUrl = `${process.env.SERVER_URL}/api/approve?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&fingerprint=${encodeURIComponent(fingerprint)}&deviceId=${encodeURIComponent(deviceId)}`;

  const message = `
👤 درخواست ثبت‌نام جدید:
📛 نام: ${name}
📱 شماره: ${phone}
👤 نام کاربری: ${username}

برای تأیید، روی دکمه زیر کلیک کنید:
  `;

  try {
    await PendingUser.create({ name, phone, username, password, fingerprint, deviceId });

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ تأیید ثبت‌نام", url: approveUrl }],
        ],
      },
    });

    res.json({ message: "درخواست ثبت‌نام به ادمین ارسال شد." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "درخواست ثبت‌نام قبلاً ارسال شده است یا خطای دیگر." });
  }
});

// تأیید ثبت‌نام
app.get("/api/approve", async (req, res) => {
  const { name, phone, username, password, fingerprint, deviceId } = req.query;

  try {
    const exists = await User.findOne({ phone });
    if (exists) {
      return res.send("⚠️ این کاربر قبلاً ثبت‌نام کرده است.");
    }

    await PendingUser.deleteOne({ phone });
    await User.create({ name, phone, username, password, fingerprint, deviceId });
    res.send("✅ کاربر با موفقیت ثبت شد.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطا در ثبت کاربر.");
  }
});

// ثبت بیمار
app.post("/api/patients", async (req, res) => {
  const { name, phone, code, username } = req.body;

  if (!name || !phone || !code || !username) {
    return res.status(400).json({ success: false, message: "همه فیلدها الزامی است." });
  }

  try {
    const newPatient = await Patient.create({ name, phone, code, createdBy: username });

    // ارسال اطلاعات به تلگرام
    const token = process.env.BOT_TOKEN;
    const chatId = process.env.ADMIN_CHAT_ID;
    const approveUrl = `${process.env.SERVER_URL}/api/approve-patient?phone=${encodeURIComponent(phone)}`;

    const message = `
👤 بیمار جدید ثبت‌شده:
📛 نام: ${name}
📱 شماره: ${phone}
🩺 کد: ${code}
👤 نام کاربری ثبت‌کننده: ${username}

برای تأیید، روی دکمه زیر کلیک کنید:
  `;

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ تایید بیمار", url: approveUrl }],
        ],
      },
    });

    res.json({ success: true, patient: newPatient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "خطا در ذخیره بیمار" });
  }
});

// تایید بیمار (تغییر فیلد approved)
app.get("/api/approve-patient", async (req, res) => {
  const { phone } = req.query;

  try {
    const patient = await Patient.findOne({ phone });
    if (!patient) {
      return res.status(404).send("❌ بیمار پیدا نشد.");
    }

    patient.approved = true;
    await patient.save();

    res.send("✅ بیمار تایید شد.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطا در تایید بیمار.");
  }
});

// علامت‌گذاری به عنوان مراجعه‌شده
app.post("/api/patients/mark-visited", async (req, res) => {
  const { phone } = req.body;

  try {
    const patient = await Patient.findOne({ phone });
    if (!patient || !patient.approved) {
      return res.status(404).json({ success: false, message: "بیمار یافت نشد یا تایید نشده است." });
    }

    patient.visited = true;
    await patient.save();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// لیست بیماران تأییدشده و مراجعه‌شده
app.get("/api/patients/visited-list", async (req, res) => {
  const { username } = req.query;

  try {
    const patients = await Patient.find({ username, approved: true, visited: true }).sort({ createdAt: -1 });
    res.json(patients);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// لیست بیماران متعلق به کاربر
app.get("/api/patients/list", async (req, res) => {
  const { username } = req.query;

  try {
    const patients = await Patient.find({ createdBy: username }).sort({ createdAt: -1 });
    res.json(patients);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// اجرا
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
