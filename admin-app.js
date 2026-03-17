(async () => {
  const auth = APP.getAuth();
  if (!auth || auth.role !== "admin") {
    location.href = "./index.html";
    return;
  }

  const state = { data: null, view: "dashboard" };
  const viewMeta = {
    dashboard: ["ダッシュボード", "全体状況を確認できます。"],
    reports: ["日報管理", "提出内容を一覧で確認できます。"],
    tasks: ["業務管理", "業務マスタと単価を管理します。"],
    monthly: ["月末チェック", "スタッフ別の月次集計を確認します。"],
    notices: ["お知らせ管理", "スタッフへの連絡を管理します。"],
    users: ["スタッフ管理", "利用者の区分を確認します。"]
  };

  function setView(view) {
    state.view = view;
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("is-active", btn.dataset.view === view));
    document.querySelectorAll("[data-panel]").forEach(panel => panel.classList.toggle("hidden", panel.dataset.panel !== view));
    const [title, subtitle] = viewMeta[view];
    document.getElementById("adminPageTitle").textContent = title;
    document.getElementById("adminPageSubtitle").textContent = subtitle;
  }

  function taskMap() {
    return Object.fromEntries((state.data.tasks || []).map(task => [task.id, task]));
  }

  function renderDashboard() {
    const month = APP.monthKey();
    document.getElementById("monthlyTargetText").textContent = `${month} の集計を確認`;
    const reports = state.data.reports || [];
    const tasks = taskMap();
    document.getElementById("adminMonthReports").textContent = `${reports.filter(report => APP.monthKey(report.date) === month).length}`;
    document.getElementById("adminActiveNotices").textContent = `${(state.data.notices || []).filter(item => item.published).length}`;
    document.getElementById("adminOverdueTasks").textContent = `${(state.data.tasks || []).filter(task => task.status === "overdue").length}`;

    const activeStaff = (state.data.users || []).filter(user => user.workerType !== "admin");
    const submittedToday = new Set(reports.filter(report => report.date === APP.todayYmd()).map(report => report.userId));
    document.getElementById("adminMissingReports").textContent = `${Math.max(activeStaff.length - submittedToday.size, 0)}`;
  }

  function renderReports() {
    const filter = document.getElementById("adminReportMonthFilter");
    if (!filter.value) filter.value = APP.monthKey();
    const month = filter.value;
    const userMap = Object.fromEntries((state.data.users || []).map(user => [user.id, user]));
    const tasks = taskMap();
    document.getElementById("adminReportTableBody").innerHTML = (state.data.reports || [])
      .filter(report => APP.monthKey(report.date) === month)
      .map(report => {
        const user = userMap[report.userId];
        const task = tasks[report.taskId];
        return `
          <tr>
            <td>${report.date}</td>
            <td>${user?.name || report.userId}</td>
            <td>${user?.workerType === "student" ? "学生" : "社会人"}</td>
            <td>${report.workMode === "office" ? "出勤" : "在宅"}</td>
            <td>${task?.name || "-"}</td>
            <td>${APP.formatWorkHours(report.workMinutes)}</td>
            <td>${report.quantity || 0}</td>
          </tr>
        `;
      }).join("") || '<tr><td colspan="7">対象月の日報はありません。</td></tr>';
  }

  function renderTasks() {
    const target = document.getElementById("adminTaskCards");
    target.innerHTML = (state.data.tasks || []).map(task => `
      <div class="stack-item">
        <strong>${task.name}</strong>
        <div>${APP.paymentLabel(task)}</div>
        <div class="muted">対象: ${task.workerType === "all" ? "全員" : task.workerType === "student" ? "学生" : "社会人"}</div>
        <div class="muted">${task.description || "説明なし"}</div>
      </div>
    `).join("") || '<div class="stack-item">業務がありません。</div>';
  }

  function renderMonthly() {
    const filter = document.getElementById("adminMonthlyFilter");
    if (!filter.value) filter.value = APP.monthKey();
    const month = filter.value;
    const users = (state.data.users || []).filter(user => user.workerType !== "admin");
    const summaries = APP.computeMonthlySummary({ reports: state.data.reports || [], users, tasks: state.data.tasks || [], month });
    const fixedMap = Object.fromEntries((state.data.monthlyClosings || []).filter(row => row.month === month).map(row => [`${row.userId}_${row.month}`, row]));
    document.getElementById("adminMonthlyTableBody").innerHTML = summaries.map(summary => {
      const fixed = fixedMap[`${summary.userId}_${month}`];
      return `
        <tr>
          <td>${summary.userName}</td>
          <td>${summary.workerType === "student" ? "学生" : "社会人"}</td>
          <td>${summary.officeHourlyAmount.toLocaleString()}円</td>
          <td>${summary.remotePieceAmount.toLocaleString()}円</td>
          <td>${summary.employeeHourlyAmount.toLocaleString()}円</td>
          <td>${summary.totalAmount.toLocaleString()}円</td>
          <td><button class="btn ${fixed?.fixedByAdmin ? "ghost" : "primary"}" data-fix-user="${summary.userId}" data-fix-month="${month}">${fixed?.fixedByAdmin ? "確定済み" : "確定する"}</button></td>
        </tr>
      `;
    }).join("") || '<tr><td colspan="7">対象データがありません。</td></tr>';
    document.querySelectorAll("[data-fix-user]").forEach(button => {
      button.addEventListener("click", async () => {
        const result = await APP.request("fixMonthlyClosing", { userId: button.dataset.fixUser, month: button.dataset.fixMonth });
        if (!result.ok) return;
        state.data = result.data;
        renderMonthly();
      });
    });
  }

  function renderNotices() {
    const target = document.getElementById("adminNoticeList");
    target.innerHTML = (state.data.notices || []).map(notice => `
      <div class="stack-item">
        <strong>${notice.title} ${notice.important ? APP.renderBadge("重要", "red") : ""}</strong>
        <div class="muted">${APP.formatDate(notice.createdAt)} / ${notice.published ? "公開中" : "下書き"}</div>
        <div>${notice.body}</div>
      </div>
    `).join("") || '<div class="stack-item">お知らせはありません。</div>';
  }

  function renderUsers() {
    document.getElementById("adminUsersTableBody").innerHTML = (state.data.users || []).filter(user => user.workerType !== "admin").map(user => `
      <tr>
        <td>${user.name}</td>
        <td>${user.id}</td>
        <td>${user.workerType === "student" ? "学生" : "社会人"}</td>
        <td>${user.useStamp ? "対象" : "対象外"}</td>
      </tr>
    `).join("");
  }

  async function bootstrap() {
    const result = await APP.request("bootstrap", {}, "GET");
    state.data = result.data;
    renderDashboard();
    renderReports();
    renderTasks();
    renderMonthly();
    renderNotices();
    renderUsers();
  }

  function bindEvents() {
    document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
    document.querySelectorAll("[data-jump-view]").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.jumpView)));
    document.getElementById("adminLogoutBtn").addEventListener("click", () => {
      APP.clearAuth();
      location.href = "./index.html";
    });
    document.getElementById("adminReportMonthFilter").addEventListener("change", renderReports);
    document.getElementById("adminMonthlyFilter").addEventListener("change", renderMonthly);

    document.getElementById("taskMasterForm").addEventListener("submit", async event => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      payload.unitPrice = Number(payload.unitPrice || 0);
      const result = await APP.request("saveTask", payload);
      const messageEl = document.getElementById("taskMasterMessage");
      if (!result.ok) return APP.showMessage(messageEl, result.error || "保存に失敗しました。", true);
      state.data = result.data;
      event.currentTarget.reset();
      renderTasks();
      renderDashboard();
      renderMonthly();
      APP.showMessage(messageEl, "業務を追加しました。");
    });

    document.getElementById("noticeForm").addEventListener("submit", async event => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      payload.important = payload.important === "true";
      payload.published = payload.published === "true";
      const result = await APP.request("saveNotice", payload);
      const messageEl = document.getElementById("noticeFormMessage");
      if (!result.ok) return APP.showMessage(messageEl, result.error || "保存に失敗しました。", true);
      state.data = result.data;
      event.currentTarget.reset();
      renderNotices();
      renderDashboard();
      APP.showMessage(messageEl, "お知らせを保存しました。");
    });
  }

  bindEvents();
  await bootstrap();
})();
