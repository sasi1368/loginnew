const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const axios = require("axios");
const XLSX = require("xlsx");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const excelFilePath = path.join(__dirname, "patients.xlsx");

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ Error connecting to MongoDB:", err));

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
});

const User = mongoose.model("User", UserSchema);
const PendingUser = mongoose.model("PendingUser", PendingUserSchema);
const Patient = mongoose.model("Patient", PatientSchema);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (user) {
      return res.json({ success: true, name: user.name, username: user.username });
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

app.post("/api/register-request", async (req, res) => {
  const { name, phone, username, password, fingerprint, deviceId } = req.body;

  if (!name || !phone || !username || !password || !fingerprint || !deviceId) {
    return res.status(400).json({ message: "لطفاً همه فیلدها را پر کنید" });
  }

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_ID;
  const approveUrl = `${process.env.SERVER_URL}/api/approve?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&fingerprint=${encodeURIComponent(fingerprint)}&deviceId=${encodeURIComponent(deviceId)}`;

  const message = `👤 درخواست ثبت‌نام جدید:\n📛 نام: ${name}\n📱 شماره: ${phone}\n👤 نام کاربری: ${username}\n\nبرای تأیید، روی دکمه زیر کلیک کنید:`;

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

app.post("/api/patients", async (req, res) => {
  const { name, phone, code, username } = req.body;

  if (!name || !phone || !code || !username) {
    return res.status(400).json({ success: false, message: "همه فیلدها الزامی است." });
  }

  try {
    const newPatient = await Patient.create({ name, phone, code });

    let workbook, worksheet, data = [];
    if (fs.existsSync(excelFilePath)) {
      workbook = XLSX.readFile(excelFilePath);
      worksheet = workbook.Sheets[workbook.SheetNames[0]];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else {
      workbook = XLSX.utils.book_new();
    }

    data.push({
      name,
      phone,
      code,
      username,
      approved: false,
      visited: false,
      createdAt: new Date().toISOString(),
    });

    const newWorksheet = XLSX.utils.json_to_sheet(data);
    workbook.Sheets["Patients"] = newWorksheet;
    XLSX.writeFile(workbook, excelFilePath);

    res.json({ success: true, patient: newPatient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "خطا در ذخیره بیمار" });
  }
});

app.get("/api/patients/stats", async (req, res) => {
  try {
    const visitedCount = await Patient.countDocuments({ visited: true });
    res.json({ visited: visitedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ visited: 0 });
  }
});

app.get("/api/patients/list", async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });
    res.json(patients);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
