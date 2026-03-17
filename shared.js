const APP = (() => {
  const STORAGE_KEY = "workapp_auth";
  const API_URL_KEY = "workapp_api_url";

  const fallbackData = {
    users: [
      { id: "student01", name: "学生スタッフ", workerType: "student", useStamp: true },
      { id: "employee01", name: "社会人スタッフ", workerType: "employee", useStamp: false }
    ],
    tasks: [
      { id: "task-input", name: "データ入力", priceType: "piece", unitPrice: 250, workerType: "student", description: "在宅時の入力業務" },
      { id: "task-support", name: "出勤サポート", priceType: "hourly", unitPrice: 1100, workerType: "all", description: "出勤時の補助業務" }
    ],
    reports: [],
    notices: [
      { id: "n1", title: "テスト運用中", body: "まずは日報入力と月末チェックを確認してください。", important: true, published: true, createdAt: new Date().toISOString() }
    ],
    monthlyClosings: []
  };

  function getApiUrl() {
    return window.APP_CONFIG?.DEFAULT_API_URL || localStorage.getItem(API_URL_KEY) || "";
  }

  function setApiUrl(url) {
    localStorage.setItem(API_URL_KEY, url);
  }

  function saveAuth(auth) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  }

  function getAuth() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function clearAuth() {
    localStorage.removeItem(STORAGE_KEY);
  }

  async function request(action, payload = {}, method = "POST") {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      return { ok: true, offline: true, data: structuredClone(fallbackData) };
    }
    const auth = getAuth();
    if (method === "GET") {
      const url = new URL(apiUrl);
      url.searchParams.set("action", action);
      if (auth?.token) url.searchParams.set("token", auth.token);
      const resp = await fetch(url.toString(), { redirect: "follow" });
      return resp.json();
    }
    const body = { _action: action, ...payload };
    if (auth?.token) body.token = auth.token;
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
      redirect: "follow"
    });
    return resp.json();
  }

  function showMessage(el, text, isError = false) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove("hidden");
    el.style.background = isError ? "#fef2f2" : "#eff6ff";
    el.style.borderColor = isError ? "#fecaca" : "#bfdbfe";
    el.style.color = isError ? "#b91c1c" : "#1d4ed8";
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("ja-JP");
  }

  function todayYmd() {
    const d = new Date();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function monthKey(value) {
    return (value || todayYmd()).slice(0, 7);
  }

  function computeWorkMinutes(startTime, endTime, breakMinutes) {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const total = (eh * 60 + em) - (sh * 60 + sm) - Number(breakMinutes || 0);
    return Math.max(total, 0);
  }

  function formatWorkHours(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }

  function paymentLabel(task) {
    if (!task) return "-";
    return task.priceType === "piece" ? `単価 ${task.unitPrice}円` : `時給 ${task.unitPrice}円`;
  }

  function computeMonthlySummary({ reports, users, tasks, month }) {
    const taskMap = Object.fromEntries(tasks.map(task => [task.id, task]));
    return users.map(user => {
      const row = {
        userId: user.id,
        userName: user.name,
        workerType: user.workerType,
        officeHourlyAmount: 0,
        remotePieceAmount: 0,
        employeeHourlyAmount: 0,
        totalAmount: 0
      };
      reports.filter(report => report.userId === user.id && monthKey(report.date) === month).forEach(report => {
        const task = taskMap[report.taskId];
        const minutes = Number(report.workMinutes || 0);
        const quantity = Number(report.quantity || 0);
        if (user.workerType === "student") {
          if (report.workMode === "office") {
            row.officeHourlyAmount += Math.round((minutes / 60) * Number(task?.unitPrice || 0));
          } else {
            row.remotePieceAmount += quantity * Number(task?.unitPrice || 0);
          }
        } else {
          row.employeeHourlyAmount += Math.round((minutes / 60) * Number(task?.unitPrice || 0));
        }
      });
      row.totalAmount = row.officeHourlyAmount + row.remotePieceAmount + row.employeeHourlyAmount;
      return row;
    });
  }

  function renderBadge(text, tone = "blue") {
    return `<span class="badge ${tone}">${text}</span>`;
  }

  return {
    getApiUrl,
    setApiUrl,
    saveAuth,
    getAuth,
    clearAuth,
    request,
    showMessage,
    formatDate,
    todayYmd,
    monthKey,
    computeWorkMinutes,
    formatWorkHours,
    paymentLabel,
    computeMonthlySummary,
    renderBadge
  };
})();
