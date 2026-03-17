var PROP = PropertiesService.getScriptProperties();
var TOKEN_TTL_SECONDS = 6 * 60 * 60;
var DATA_FILE_NAME = "workapp_refactored_data.json";

var DEFAULT_ADMIN = { id: "admin", pw: "admin123" };
var DEFAULT_STAFF = {
  student01: { pw: "pass123", name: "学生スタッフ", workerType: "student", useStamp: true },
  employee01: { pw: "pass123", name: "社会人スタッフ", workerType: "employee", useStamp: false }
};

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function safeParse_(text) {
  try { return JSON.parse(text); } catch (e) { return {}; }
}

function getDataFile_() {
  var fileId = PROP.getProperty("WORKAPP_DATA_FILE_ID");
  if (fileId) {
    try { return DriveApp.getFileById(fileId); } catch (e) {}
  }
  var file = DriveApp.createFile(DATA_FILE_NAME, JSON.stringify(defaultData_()), MimeType.PLAIN_TEXT);
  PROP.setProperty("WORKAPP_DATA_FILE_ID", file.getId());
  return file;
}

function defaultData_() {
  return {
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
      { id: "notice-1", title: "初期設定", body: "まずは日報入力と月末チェックを試してください。", important: true, published: true, createdAt: new Date().toISOString() }
    ],
    monthlyClosings: []
  };
}

function readData_() {
  var raw = getDataFile_().getBlob().getDataAsString();
  try {
    var data = JSON.parse(raw);
    if (!data.users) return defaultData_();
    return data;
  } catch (e) {
    return defaultData_();
  }
}

function writeData_(data) {
  getDataFile_().setContent(JSON.stringify(data));
  return data;
}

function issueToken_(payload) {
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put("auth:" + token, JSON.stringify(payload), TOKEN_TTL_SECONDS);
  return token;
}

function getAuth_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get("auth:" + token);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function getRequestToken_(e, body) {
  return (body && body.token) || (e && e.parameter && e.parameter.token) || "";
}

function requireAuth_(e, body) {
  var payload = getAuth_(getRequestToken_(e, body));
  if (!payload) return { ok: false, error: "unauthorized" };
  return { ok: true, auth: payload };
}

function requireAdmin_(e, body) {
  var gate = requireAuth_(e, body);
  if (!gate.ok) return gate;
  if (gate.auth.role !== "admin") return { ok: false, error: "forbidden" };
  return gate;
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "bootstrap";
  if (action === "bootstrap") {
    var gate = requireAuth_(e, null);
    if (!gate.ok) return out_(gate);
    return out_({ ok: true, data: readData_() });
  }
  if (action === "ping") return out_({ ok: true, now: new Date().toISOString() });
  return out_({ ok: false, error: "unknown action" });
}

function doPost(e) {
  var body = safeParse_(e.postData && e.postData.contents || "{}");
  var action = body._action || "";
  var data;

  if (action === "loginAdmin") {
    if (String(body.id || "") !== DEFAULT_ADMIN.id || String(body.pw || "") !== DEFAULT_ADMIN.pw) {
      return out_({ ok: false, error: "invalid credentials" });
    }
    return out_({ ok: true, token: issueToken_({ role: "admin" }), user: { id: DEFAULT_ADMIN.id, name: "管理者" } });
  }

  if (action === "loginStaff") {
    var staff = DEFAULT_STAFF[String(body.id || "")];
    if (!staff || staff.pw !== String(body.pw || "")) {
      return out_({ ok: false, error: "invalid credentials" });
    }
    return out_({ ok: true, token: issueToken_({ role: "staff", userId: String(body.id || "") }), user: { id: String(body.id || ""), name: staff.name, workerType: staff.workerType, useStamp: staff.useStamp } });
  }

  if (action === "saveReport") {
    var gate = requireAuth_(e, body);
    if (!gate.ok) return out_(gate);
    data = readData_();
    data.reports = data.reports || [];
    data.reports.push({
      id: Utilities.getUuid(),
      userId: gate.auth.userId,
      date: String(body.date || ""),
      workMode: String(body.workMode || "office"),
      startTime: String(body.startTime || "09:00"),
      endTime: String(body.endTime || "18:00"),
      breakMinutes: Number(body.breakMinutes || 0),
      workMinutes: Number(body.workMinutes || 0),
      transportCost: Number(body.transportCost || 0),
      taskId: String(body.taskId || ""),
      quantity: Number(body.quantity || 0),
      summary: String(body.summary || ""),
      memo: String(body.memo || ""),
      createdAt: new Date().toISOString()
    });
    writeData_(data);
    return out_({ ok: true, data: data });
  }

  if (action === "saveTask") {
    var gateAdminTask = requireAdmin_(e, body);
    if (!gateAdminTask.ok) return out_(gateAdminTask);
    data = readData_();
    data.tasks = data.tasks || [];
    data.tasks.push({
      id: "task-" + new Date().getTime(),
      name: String(body.name || ""),
      priceType: String(body.priceType || "hourly"),
      unitPrice: Number(body.unitPrice || 0),
      workerType: String(body.workerType || "all"),
      description: String(body.description || "")
    });
    writeData_(data);
    return out_({ ok: true, data: data });
  }

  if (action === "saveNotice") {
    var gateAdminNotice = requireAdmin_(e, body);
    if (!gateAdminNotice.ok) return out_(gateAdminNotice);
    data = readData_();
    data.notices = data.notices || [];
    data.notices.unshift({
      id: "notice-" + new Date().getTime(),
      title: String(body.title || ""),
      body: String(body.body || ""),
      important: !!body.important,
      published: !!body.published,
      createdAt: new Date().toISOString()
    });
    writeData_(data);
    return out_({ ok: true, data: data });
  }

  if (action === "markStamp") {
    var gateStamp = requireAuth_(e, body);
    if (!gateStamp.ok) return out_(gateStamp);
    data = readData_();
    data.users = data.users || [];
    for (var i = 0; i < data.users.length; i++) {
      if (data.users[i].id === gateStamp.auth.userId) {
        data.users[i].lastStampedAt = String(body.date || "");
      }
    }
    writeData_(data);
    return out_({ ok: true, data: data });
  }

  if (action === "fixMonthlyClosing") {
    var gateAdminFix = requireAdmin_(e, body);
    if (!gateAdminFix.ok) return out_(gateAdminFix);
    data = readData_();
    data.monthlyClosings = data.monthlyClosings || [];
    data.monthlyClosings = data.monthlyClosings.filter(function(row) {
      return !(row.userId === String(body.userId || "") && row.month === String(body.month || ""));
    });
    data.monthlyClosings.push({
      userId: String(body.userId || ""),
      month: String(body.month || ""),
      fixedByAdmin: true,
      fixedAt: new Date().toISOString()
    });
    writeData_(data);
    return out_({ ok: true, data: data });
  }

  return out_({ ok: false, error: "unknown action" });
}
