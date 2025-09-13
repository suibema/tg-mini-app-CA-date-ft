const TZ = "Europe/Moscow";

const TBL_DATES = "m60n1xw5ca838ww";  
const COL_DATE_ID = "Id";             
const COL_DATE_TEXT = "Дата";       
const COL_DATE_COUNT = "ctcb6airzyxpc1z";   

const TBL_REG = "moqj9txmglwy87u";
const COL_REG_TGID = "tg-id";
const COL_REG_DATE_ID = "ckdjzf4b3zcob72";   
const COL_REG_DATE_TEXT = "cmieby5rtwr3u20";

const TBL_LOG = "mwss4su9ytdjlln";
const COL_LOG_TGID = "tg-id";
const COL_LOG_TYPE = "cxycz4oxpv3yxf7";
const COL_LOG_SLOT_DATE = "c737rnaz0h5ks4k";

const USE_SQL_FUNCTIONS = false;

// NocoDB Configuration
const NOCODB_BASE_URL = "https://ndb.fut.ru";
const NOCODB_API_TOKEN = "crDte8gB-CSZzNujzSsy9obQRqZYkY3SNp8wre88";

// Helper function for NocoDB API requests
async function nocodbRequest(method, endpoint, body = null) {
  const headers = {
    "accept": "application/json",
    "xc-token": NOCODB_API_TOKEN,
    "Content-Type": "application/json",
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${NOCODB_BASE_URL}/api/v2/tables${endpoint}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(`NocoDB API error: ${response.status} - ${error.message}`);
  }
  return response.json();
}

// DOM Elements
const slotSelect = document.getElementById("slotSelect");
const submitBtn = document.getElementById("submitBtn");
const msg = document.getElementById("msg");
const currentBox = document.getElementById("currentBox");
const currentText = document.getElementById("currentText");
const rebookBtn = document.getElementById("rebookBtn");
const selectBox = document.getElementById("selectBox");

Telegram.WebApp.ready();
const tgUser = Telegram.WebApp?.initDataUnsafe?.user || null;
const tgId = tgUser.id;

function fmt(tsLike) {
  const d = new Date(tsLike);
  if (isNaN(+d)) return tsLike;
  return d.toLocaleString('ru-RU', {
    timeZone: TZ, weekday: 'short',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function showView({ hasBooking }) {
  if (hasBooking) {
    currentBox.style.display = "";
    selectBox.style.display = "none";
  } else {
    currentBox.style.display = "none";
    selectBox.style.display = "";
  }
}

function setMsg(text, cls = "muted") {
  msg.className = cls;
  msg.textContent = text;
}

async function checkUserExists() {
  if (!tgId) {
    setMsg("Не удалось определить Telegram ID.", "err");
    return false;
  }

  try {
    const data = await nocodbRequest("GET", `/${TBL_REG}/records/count?where=(${COL_REG_TGID},eq,${tgId})`);
    if (data.count === 0) {
      setMsg("Не получилось найти тебя в базе регистрации! Попробуй позже или напиши нам в боте.", "err");
      return false;
    }
    return true;
  } catch (error) {
    console.error("checkUserExists:", error);
    setMsg("Ошибка сервера при проверке регистрации.", "err");
    return false;
  }
}

async function loadDates() {
  try {
    const data = await nocodbRequest("GET", `/${TBL_DATES}/records?sort=${COL_DATE_TEXT}`);
    slotSelect.innerHTML = "";

    if (!data.list || data.list.length === 0) {
      slotSelect.innerHTML = `<option value="">Нет доступных дат</option>`;
      setMsg("Слоты пока не заданы.", "muted");
      return [];
    }

    slotSelect.appendChild(new Option("— выбрать —", ""));
    data.list.forEach(row => {
      const id = row[COL_DATE_ID];
      const txt = row[COL_DATE_TEXT];
      slotSelect.appendChild(new Option(`${fmt(txt)}`, String(id)));
    });
    return data.list;
  } catch (error) {
    console.error("loadDates:", error);
    setMsg("Не удалось загрузить даты.", "err");
    slotSelect.innerHTML = `<option value="">Ошибка загрузки</option>`;
    return null;
  }
}

async function loadCurrentBooking() {
  if (!tgId) return { has: false };

  try {
    const data = await nocodbRequest("GET", `/${TBL_REG}/records?where=(${COL_REG_TGID},eq,${tgId})&limit=1`);
    if (data.list && data.list.length > 0 && data.list[0][COL_REG_DATE_ID]) {
      return {
        has: true,
        dateId: data.list[0][COL_REG_DATE_ID],
        text: data.list[0][COL_REG_DATE_TEXT]
      };
    }
    return { has: false };
  } catch (error) {
    console.error("loadCurrentBooking:", error);
    return { has: false };
  }
}

async function insertLog(dateText) {
  try {
    await nocodbRequest("POST", `/${TBL_LOG}/records`, {
      [COL_LOG_TGID]: tgId,
      [COL_LOG_SLOT_DATE]: dateText,
      [COL_LOG_TYPE]: 'ЦО'
    });
  } catch (error) {
    console.warn("insertLog:", error);
  }
}

async function setRegistration(dateId, dateText) {
  try {
    const existing = await nocodbRequest("GET", `/${TBL_REG}/records?where=(${COL_REG_TGID},eq,${tgId})&limit=1`);
    
    if (existing.list && existing.list.length > 0) {
      await nocodbRequest("PATCH", `/${TBL_REG}/records`, {
        "Id": existing.list[0].Id,
        [COL_REG_DATE_ID]: dateId,
        [COL_REG_DATE_TEXT]: dateText
      });
      return true;
    } else {
      await nocodbRequest("POST", `/${TBL_REG}/records`, {
        [COL_REG_TGID]: tgId,
        [COL_REG_DATE_ID]: dateId,
        [COL_REG_DATE_TEXT]: dateText
      });
      return true;
    }
  } catch (error) {
    console.error("setRegistration:", error);
    return false;
  }
}

async function incCountFallback(id) {
  try {
    const data = await nocodbRequest("GET", `/${TBL_DATES}/records?where=(${COL_DATE_ID},eq,${id})&limit=1`);
    if (!data.list || data.list.length === 0) {
      console.error(`incCountFallback: No record found for id ${id}`);
      return false;
    }

    const oldVal = data.list[0][COL_DATE_COUNT] ?? 0;
    const newVal = oldVal + 1;

    await nocodbRequest("PATCH", `/${TBL_DATES}/records`, {
      "Id": data.list[0].Id,
      [COL_DATE_COUNT]: newVal
    });
    return true;
  } catch (error) {
    console.error("incCountFallback:", error);
    return false;
  }
}

async function decCountFallback(id) {
  try {
    const data = await nocodbRequest("GET", `/${TBL_DATES}/records?where=(${COL_DATE_ID},eq,${id})&limit=1`);
    if (!data.list || data.list.length === 0) {
      console.error(`decCountFallback: No record found for id ${id}`);
      return false;
    }

    const oldVal = data.list[0][COL_DATE_COUNT] ?? 0;
    const newVal = Math.max(0, oldVal - 1);

    await nocodbRequest("PATCH", `/${TBL_DATES}/records`, {
      "Id": data.list[0].Id,
      [COL_DATE_COUNT]: newVal
    });
    console.log(`decCountFallback: Successfully decremented count for id ${id} from ${oldVal} to ${newVal}`);
    return true;
  } catch (error) {
    console.error("decCountFallback:", error);
    return false;
  }
}

async function safeInc(id) {
  return await incCountFallback(id);
}

async function safeDec(id) {
  const result = await decCountFallback(id);
  if (!result) {
    console.error(`safeDec: Failed to decrement count for id ${id}`);
  }
  return result;
}

async function bookSelected() {
  const dateId = slotSelect.value;
  if (!tgId) { setMsg("Не удалось определить Telegram ID.", "err"); return; }
  if (!dateId) { setMsg("Сначала выбери дату.", "err"); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = "Отправляем…";
  setMsg("");

  const opt = slotSelect.options[slotSelect.selectedIndex];
  const humanText = opt.text.replace(/\s*\(\d+\)\s*$/, "");

  const current = await loadCurrentBooking();
  const oldDateId = current.has ? current.dateId : null;

  if (oldDateId && String(oldDateId) !== String(dateId)) {
    console.log(`bookSelected: Attempting to decrement count for old date ID ${oldDateId}`);
    const decOk = await safeDec(oldDateId);
    if (!decOk) {
      console.error(`bookSelected: Failed to decrement count for old date ID ${oldDateId}`);
      submitBtn.disabled = false;
      submitBtn.textContent = "Записаться";
      setMsg("Не удалось обновить счётчик старой даты. Попробуй ещё раз.", "err");
      return;
    }
  }

  console.log(`bookSelected: Attempting to increment count for new date ID ${dateId}`);
  const incOk = await safeInc(dateId);
  if (!incOk) {
    if (oldDateId && String(oldDateId) !== String(dateId)) {
      console.log(`bookSelected: Rolling back increment for old date ID ${oldDateId}`);
      await safeInc(oldDateId);
    }
    submitBtn.disabled = false;
    submitBtn.textContent = "Записаться";
    setMsg("Не удалось обновить счётчик новой даты. Выбери другую или попробуй позже.", "err");
    return;
  }

  const regOk = await setRegistration(dateId, humanText);
  if (!regOk) {
    console.log(`bookSelected: Rolling back decrement for new date ID ${dateId}`);
    await safeDec(dateId);
    if (oldDateId && String(oldDateId) !== String(dateId)) {
      console.log(`bookSelected: Rolling back increment for old date ID ${oldDateId}`);
      await safeInc(oldDateId);
    }
    submitBtn.disabled = false;
    submitBtn.textContent = "Записаться";
    setMsg("Не удалось сохранить запись. Попробуй ещё раз.", "err");
    return;
  }

  await insertLog(humanText);

  submitBtn.disabled = false;
  submitBtn.textContent = "Записаться";
  setMsg(`Готово! Ты записан на ${humanText}.`, "ok");

  currentText.textContent = humanText;
  showView({ hasBooking: true });

  await loadDates();
}

rebookBtn.addEventListener("click", async () => {
  await loadDates();
  showView({ hasBooking: false });
});

async function initUI() {
  if (!tgId) { setMsg("Не удалось определить Telegram ID.", "err"); return; }

  const exists = await checkUserExists();
  if (!exists) {
    currentBox.style.display = "none";
    selectBox.style.display = "none";
    return;
  }

  const current = await loadCurrentBooking();
  if (current.has) {
    currentText.textContent = current.text;
    showView({ hasBooking: true });
  } else {
    await loadDates();
    showView({ hasBooking: false });
  }
}

submitBtn.addEventListener("click", bookSelected);

initUI();


