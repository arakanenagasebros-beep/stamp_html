(async () => {
  const auth = APP.getAuth();
  if (!auth || auth.role !== "staff") {
    location.href = "./index.html";
    return;
  }

  const state = {
    data: null,
    currentUser: null,
    currentView: "dashboard"
  };

  const viewMeta = {
    dashboard: ["ダッシュボード", "今日やることを確認できます。"],
    "report-form": ["日報入力", "本日の業務を記録します。"],
    "report-list": ["日報履歴", "自分の提出履歴を確認できます。"],
    "task-list": ["業務一覧", "登録されている業務を確認できます。"],
    notices: ["お知らせ", "管理者からの連絡を確認できます。"]
  };

  function getTaskMap() {
    return Object.fromEntries((state.data.tasks || []).map(task => [task.id, task]));
  }

  function currentMonthReports() {
    const month = APP.monthKey();
    return (state.data.reports || []).filter(report => report.userId === state.currentUser.id && APP.monthKey(report.date) === month);
  }

  function todayReport() {
    const today = APP.todayYmd();
    return (state.data.reports || []).find(report => report.userId === state.currentUser.id && report.date === today);
  }

  function setView(viewName) {
    state.currentView = viewName;
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("is-active", btn.dataset.view === viewName));
    document.querySelectorAll("[data-panel]").forEach(panel => panel.classList.toggle("hidden", panel.dataset.panel !== viewName));
    const [title, subtitle] = viewMeta[viewName];
    document.getElementById("staffPageTitle").textContent = title;
    document.getElementById("staffPageSubtitle").textContent = subtitle;
  }

  function renderDashboard() {
    const report = todayReport();
    document.getElementById("todayStatusTitle").textContent = report ? "本日の日報入力済み" : "本日の日報が未入力です";
    document.getElementById("todayStatusText").textContent = report
      ? `勤務形態: ${report.workMode === "office" ? "出勤" : "在宅"} / 稼働 ${APP.formatWorkHours(report.workMinutes)}`
      : "勤務形態と業務内容を入力してください。";
    document.getElementById("todayWorkMode").textContent = report ? (report.workMode === "office" ? "出勤" : "在宅") : "未入力";

    const reports = currentMonthReports();
    document.getElementById("monthReportCount").textContent = `${reports.length}`;
    const monthMinutes = reports.reduce((sum, row) => sum + Number(row.workMinutes || 0), 0);
    document.getElementById("monthWorkHours").textContent = APP.formatWorkHours(monthMinutes);
    const notices = (state.data.notices || []).filter(item => item.published);
    document.getElementById("noticeCount").textContent = `${notices.length}`;

    const stampArea = document.getElementById("studentStampArea");
    stampArea.innerHTML = "";
    if (state.currentUser.workerType === "student" && state.currentUser.useStamp) {
      const stamped = Boolean(state.currentUser.lastStampedAt === APP.todayYmd());
      stampArea.innerHTML = `
        <div class="stamp-card">
          <strong>学生向けの開始確認</strong>
          <p class="muted">勤怠確定ではなく、出勤した日の打刻忘れ防止用です。</p>
          <button type="button" class="btn ${stamped ? "ghost" : "warning"}" id="studentStampBtn">${stamped ? "本日は確認済み" : "本日の開始を記録"}</button>
        </div>
      `;
      const btn = document.getElementById("studentStampBtn");
      btn.disabled = stamped;
      btn.addEventListener("click", async () => {
        const result = await APP.request("markStamp", { date: APP.todayYmd() });
        if (!result.ok) return;
        state.currentUser.lastStampedAt = APP.todayYmd();
        renderDashboard();
      });
    }

    const taskMap = getTaskMap();
    const dashboardTasks = document.getElementById("staffDashboardTasks");
    const myTasks = (state.data.tasks || []).filter(task => task.workerType === "all" || task.workerType === state.currentUser.workerType).slice(0, 4);
    dashboardTasks.innerHTML = myTasks.length ? myTasks.map(task => `
      <div class="stack-item">
        <strong>${task.name}</strong>
        <div>${APP.paymentLabel(task)}</div>
        <div class="muted">${task.description || "説明なし"}</div>
      </div>
    `).join("") : '<div class="stack-item">表示できる業務がありません。</div>';

    const dashboardNotices = document.getElementById("staffDashboardNotices");
    dashboardNotices.innerHTML = notices.slice(0, 3).map(notice => `
      <div class="stack-item">
        <strong>${notice.title}</strong>
        <div class="muted">${notice.body}</div>
      </div>
    `).join("") || '<div class="stack-item">お知らせはありません。</div>';
  }

  function renderTaskOptions() {
    const select = document.getElementById("staffTaskSelect");
    const availableTasks = (state.data.tasks || []).filter(task => task.workerType === "all" || task.workerType === state.currentUser.workerType);
    select.innerHTML = availableTasks.map(task => `<option value="${task.id}">${task.name} (${APP.paymentLabel(task)})</option>`).join("");
  }

  function renderReportList() {
    const filter = document.getElementById("staffReportMonthFilter");
    if (!filter.value) filter.value = APP.monthKey();
    const month = filter.value;
    const taskMap = getTaskMap();
    const rows = (state.data.reports || []).filter(report => report.userId === state.currentUser.id && APP.monthKey(report.date) === month);
    document.getElementById("staffReportTableBody").innerHTML = rows.map(report => {
      const task = taskMap[report.taskId];
      return `
        <tr>
          <td>${report.date}</td>
          <td>${report.workMode === "office" ? "出勤" : "在宅"}</td>
          <td>${task?.name || "-"}</td>
          <td>${APP.formatWorkHours(report.workMinutes)}</td>
          <td>${report.quantity || 0}</td>
          <td>${APP.paymentLabel(task)}</td>
        </tr>
      `;
    }).join("") || '<tr><td colspan="6">対象月の日報はありません。</td></tr>';
  }

  function renderTaskCards() {
    const target = document.getElementById("staffTaskCards");
    const tasks = (state.data.tasks || []).filter(task => task.workerType === "all" || task.workerType === state.currentUser.workerType);
    target.innerHTML = tasks.map(task => `
      <div class="stack-item">
        <strong>${task.name}</strong>
        <div>${APP.paymentLabel(task)}</div>
        <div class="muted">対象: ${task.workerType === "all" ? "全員" : task.workerType === "student" ? "学生" : "社会人"}</div>
        <div class="muted">${task.description || "説明なし"}</div>
      </div>
    `).join("") || '<div class="stack-item">業務がありません。</div>';
  }

  function renderNotices() {
    const target = document.getElementById("staffNoticeList");
    const notices = (state.data.notices || []).filter(item => item.published);
    target.innerHTML = notices.map(notice => `
      <div class="stack-item">
        <strong>${notice.title} ${notice.important ? APP.renderBadge("重要", "red") : ""}</strong>
        <div class="muted">${APP.formatDate(notice.createdAt)}</div>
        <div>${notice.body}</div>
      </div>
    `).join("") || '<div class="stack-item">お知らせはありません。</div>';
  }

  async function bootstrap() {
    const result = await APP.request("bootstrap", {}, "GET");
    state.data = result.data;
    state.currentUser = (state.data.users || []).find(user => user.id === auth.user?.id) || auth.user;
    document.getElementById("staffNameLabel").textContent = state.currentUser.name;
    document.getElementById("workerTypeBadge").textContent = state.currentUser.workerType === "student" ? "学生" : "社会人";
    renderTaskOptions();
    const reportForm = document.getElementById("dailyReportForm");
    reportForm.date.value = APP.todayYmd();
    reportForm.startTime.value = "09:00";
    reportForm.endTime.value = "18:00";
    reportForm.breakMinutes.value = 60;
    reportForm.workHoursLabel.value = APP.formatWorkHours(APP.computeWorkMinutes(reportForm.startTime.value, reportForm.endTime.value, reportForm.breakMinutes.value));
    renderDashboard();
    renderReportList();
    renderTaskCards();
    renderNotices();
  }

  function bindEvents() {
    document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
    document.querySelectorAll("[data-jump-view]").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.jumpView)));
    document.getElementById("staffLogoutBtn").addEventListener("click", () => {
      APP.clearAuth();
      location.href = "./index.html";
    });
    const form = document.getElementById("dailyReportForm");
    [form.startTime, form.endTime, form.breakMinutes].forEach(field => {
      field.addEventListener("input", () => {
        form.workHoursLabel.value = APP.formatWorkHours(APP.computeWorkMinutes(form.startTime.value, form.endTime.value, form.breakMinutes.value));
      });
    });
    document.getElementById("reportFormResetBtn").addEventListener("click", () => form.reset());
    document.getElementById("staffReportMonthFilter").addEventListener("change", renderReportList);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      payload.workMinutes = APP.computeWorkMinutes(payload.startTime, payload.endTime, payload.breakMinutes);
      payload.quantity = Number(payload.quantity || 0);
      payload.transportCost = Number(payload.transportCost || 0);
      const result = await APP.request("saveReport", payload);
      const messageEl = document.getElementById("reportFormMessage");
      if (!result.ok) {
        APP.showMessage(messageEl, result.error || "保存に失敗しました。", true);
        return;
      }
      state.data = result.data;
      renderDashboard();
      renderReportList();
      APP.showMessage(messageEl, "日報を保存しました。");
      setView("report-list");
    });
  }

  bindEvents();
  await bootstrap();
})();
