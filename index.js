(() => {
  const staffForm = document.getElementById("staffLoginForm");
  const adminForm = document.getElementById("adminLoginForm");
  const messageEl = document.getElementById("loginMessage");
  const tabButtons = [...document.querySelectorAll("[data-auth-tab]")];

  function switchTab(tab) {
    tabButtons.forEach(btn => btn.classList.toggle("is-active", btn.dataset.authTab === tab));
    staffForm.classList.toggle("hidden", tab !== "staff");
    adminForm.classList.toggle("hidden", tab !== "admin");
    messageEl.classList.add("hidden");
  }

  tabButtons.forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.authTab)));

  async function handleLogin(role, form) {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const action = role === "admin" ? "loginAdmin" : "loginStaff";
    try {
      const result = await APP.request(action, payload);
      if (!result.ok) {
        APP.showMessage(messageEl, result.error || "ログインに失敗しました。", true);
        return;
      }
      APP.saveAuth({ token: result.token || "offline-token", role, user: result.user || null });
      location.href = role === "admin" ? "./admin.html" : "./staff.html";
    } catch (error) {
      APP.showMessage(messageEl, error.message || "通信エラーが発生しました。", true);
    }
  }

  staffForm.addEventListener("submit", event => {
    event.preventDefault();
    handleLogin("staff", staffForm);
  });
  adminForm.addEventListener("submit", event => {
    event.preventDefault();
    handleLogin("admin", adminForm);
  });
})();
