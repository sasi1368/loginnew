document.addEventListener("DOMContentLoaded", () => {
  const userName = localStorage.getItem("name");
  const userPhone = localStorage.getItem("phone");

  // اگر کاربر لاگین نکرده بود، هدایت به صفحه ورود
  if (!userName || !userPhone) {
    window.location.href = "/";
    return;
  }

  // نمایش پیام خوش‌آمدگویی
  const welcomeMessage = document.getElementById("welcomeMessage");
  if (welcomeMessage) {
    welcomeMessage.textContent = `خوش آمدید ${userName} عزیز!`;
  }

  // دکمه خروج
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "/";
    });
  }

  // فرم ثبت بیمار
  const patientForm = document.getElementById("patientForm");
  if (patientForm) {
    patientForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("patientName").value;
      const phone = document.getElementById("patientPhone").value;
      const code = generateRandomCode();

      try {
        const response = await fetch("/api/patients", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name,
            phone,
            code,
            userPhone
          })
        });

        const data = await response.json();

        if (data.success) {
          alert("✅ بیمار با موفقیت ثبت شد.");
          patientForm.reset();
        } else {
          alert("❌ خطا: " + data.message);
        }
      } catch (error) {
        console.error(error);
        alert("❌ خطا در ارتباط با سرور.");
      }
    });
  }

  function generateRandomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
});
