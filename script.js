const COST_CENTERS = ["HRDGA", "Operasional & network development", "Legal", "Finance & Accounting"];
const LOCATIONS = ["Head Office", "Lw. Liang 1", "Lw. Liang 2", "Lw. Liang 3", "Cianjur 1", "Cianjur 2", "Cigudeg 1", "Cigudeg 2", "Jasinga 1", "Jasinga 2", "Dadali", "Cimanggu", "Kemang", "Pasir Angin 1", "Cipayung", "Cibogo", "Cigombong", "Cijeruk", "Rumpin 1", "Rumpin 2", "Klapanunggal 1", "Klapanunggal 2", "Tanjungsari 1", "Tanjungsari 2", "Sukamakmur", "Tanjungkerta", "Kuningan 1", "Kuningan 2", "Muara Sanding 1", "Muara Sanding 2", "Cabang Bungin 1", "Cabang Bungin 2"];
const RANKS = ["Worker", "Staff", "Supervisor", "Manager", "General Manager"];
const CURRENCIES = ["IDR", "USD", "SGD", "EUR", "JPY"];
const CAR_TYPES = ["Vendor", "Uang Muka", "Reimburse"];
const DEPARTMENT_CODES = {
  "HRDGA": "HRDGA",
  "Operasional & network development": "OPNET",
  "Legal": "LEGAL",
  "Finance & Accounting": "FINAC"
};
const DEPARTMENT_HEADS = {
  "HRDGA": "Khaona Rachmanda",
  "Operasional & network development": "Fabyan Al Razby S.",
  "Legal": "Sakti Teguh Alfianto",
  "Finance & Accounting": "Ernie"
};
const FIXED_SIGNERS = {
  finance: "Mujahidin",
  generalManager: "Marchyandi Rayi",
  director: "Henry Tjahjadi"
};
const FORM_TITLES = {
  PO: "Purchase Order",
  SPK: "Surat Perintah Kerja",
  CAR: "Cash Advance Request",
  PR: "Request for Payment",
  CAC: "Cash Advance Completion"
};
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const STORAGE_KEY = "ppp-procurement-system-v1";

let state = loadState();
let activePrintId = null;
let activeVendorTarget = null;
let cloudReady = false;
let appStarted = false;
let currentUser = { email: "", role: "guest" };

function loadState() {
  const fallback = { records: [], sequence: {}, vendors: [] };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || fallback;
    return { records: stored.records || [], sequence: stored.sequence || {}, vendors: stored.vendors || [] };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderMonthFilters();
  renderDashboard();
  renderRecords();
  renderVendors();
  updateCloudStatus(cloudReady ? "Menyimpan online..." : "Mode lokal");
  if (window.ProcurementCloud?.enabled()) {
    window.ProcurementCloud.save(state)
      .then(saved => updateCloudStatus(saved ? "Tersimpan online" : "Mode lokal"))
      .catch(() => updateCloudStatus("Cloud gagal menyimpan, data lokal aman"));
  }
}

function updateCloudStatus(text) {
  const target = byId("cloudStatus");
  if (target) target.textContent = text;
}

function normalizeState(input) {
  return {
    records: input?.records || [],
    sequence: input?.sequence || {},
    vendors: input?.vendors || []
  };
}

async function loadCloudState() {
  if (!window.ProcurementCloud?.enabled()) {
    updateCloudStatus("Mode lokal");
    return;
  }
  updateCloudStatus("Memuat data online...");
  try {
    const cloudState = await window.ProcurementCloud.load();
    if (cloudState) {
      state = normalizeState(cloudState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateCloudStatus("Data online aktif");
    } else {
      await window.ProcurementCloud.persist(state);
      updateCloudStatus("Cloud aktif, data lokal diunggah");
    }
    cloudReady = true;
  } catch {
    cloudReady = false;
    updateCloudStatus("Cloud tidak tersambung, memakai data lokal");
  }
}

function setLoginMessage(message, isError = true) {
  const target = byId("loginMessage");
  if (!target) return;
  target.textContent = message || "";
  target.style.color = isError ? "var(--danger)" : "var(--accent)";
}

function showLogin() {
  byId("loginScreen").classList.remove("auth-hidden");
  byId("appShell").classList.add("auth-hidden");
}

function showApp(session) {
  byId("loginScreen").classList.add("auth-hidden");
  byId("appShell").classList.remove("auth-hidden");
  const user = session?.user?.email || "";
  currentUser = {
    email: user,
    role: window.ProcurementCloud?.roleForSession?.(session) || (user ? "user" : "admin")
  };
  if (byId("adminUser")) {
    const label = currentUser.role === "admin" ? "Administrator" : "User";
    byId("adminUser").textContent = user ? `${label}: ${user}` : "";
  }
  document.body.classList.toggle("is-admin", currentUser.role === "admin");
}

function authIsRequired() {
  return Boolean(window.ProcurementCloud?.enabled() && window.ProcurementCloud?.authRequired());
}

async function startApp(session = window.ProcurementCloud?.getSession?.()) {
  if (appStarted) {
    showApp(session);
    rebuildReferenceForms();
    renderMonthFilters();
    renderDashboard();
    renderRecords();
    renderVendors();
    return;
  }
  appStarted = true;
  showApp(session);
  await loadCloudState();
  initForms();
  renderMonthFilters();
  renderDashboard();
  renderRecords();
  renderVendors();
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  setLoginMessage("Memeriksa login...", false);
  try {
    const session = await window.ProcurementCloud.signIn(email, password);
    setLoginMessage("");
    form.reset();
    await startApp(session);
  } catch (error) {
    setLoginMessage(error.message || "Login gagal.");
  }
}

function handleLogout() {
  window.ProcurementCloud?.signOut?.();
  cloudReady = false;
  currentUser = { email: "", role: "guest" };
  document.body.classList.remove("is-admin");
  showLogin();
  updateCloudStatus("Silakan login");
}

function nextRegister(type, dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  const department = document.querySelector(`form[data-type="${type}"] [name="department"]`)?.value || "HRDGA";
  const departmentCode = DEPARTMENT_CODES[department] || "HRDGA";
  const key = `${type}-${departmentCode}-${year}`;
  state.sequence[key] = (state.sequence[key] || 0) + 1;
  return `${String(state.sequence[key]).padStart(6, "0")}/${departmentCode}-PPP/${type}/${ROMAN[month]}/${year}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function money(value) {
  const number = Number(value || 0);
  return number.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
}

function formatCurrencyValue(value, currency = "IDR") {
  const maximumFractionDigits = currency === "IDR" || currency === "JPY" ? 0 : 2;
  return Number(value || 0).toLocaleString("id-ID", { style: "currency", currency, maximumFractionDigits });
}

function parseMoney(value) {
  const cleaned = String(value || "").replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(cleaned || 0);
}

function formatMoneyInput(input) {
  const number = parseMoney(input.value);
  input.value = number ? plainNumber(number) : "";
}

function plainNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function monthKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  if (!key) return "";
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function availableMonths() {
  const keys = new Set(state.records.map(record => monthKey(record.date)).filter(Boolean));
  keys.add(monthKey(new Date().toISOString()));
  return [...keys].sort().reverse();
}

function monthOptions(selected) {
  return `<option value="ALL">Semua Bulan</option>${availableMonths().map(key => `<option value="${key}" ${key === selected ? "selected" : ""}>${escapeHtml(monthLabel(key))}</option>`).join("")}`;
}

function filterByMonth(records, selectedMonth) {
  if (!selectedMonth || selectedMonth === "ALL") return records;
  return records.filter(record => monthKey(record.date) === selectedMonth);
}

function isAdmin() {
  return currentUser.role === "admin";
}

function canSeeRecord(record) {
  if (isAdmin()) return true;
  if (!currentUser.email) return true;
  return String(record.createdByEmail || "").toLowerCase() === currentUser.email.toLowerCase();
}

function visibleRecords() {
  return state.records.filter(canSeeRecord);
}

function exportableState() {
  if (isAdmin()) return state;
  return {
    records: visibleRecords(),
    sequence: state.sequence,
    vendors: state.vendors
  };
}

function renderMonthFilters() {
  const dashboardMonth = byId("dashboardMonth");
  const recordMonth = byId("recordMonth");
  if (dashboardMonth) {
    const selected = dashboardMonth.value || "ALL";
    dashboardMonth.innerHTML = monthOptions(selected);
    dashboardMonth.value = [...dashboardMonth.options].some(option => option.value === selected) ? selected : "ALL";
  }
  if (recordMonth) {
    const selected = recordMonth.value || "ALL";
    recordMonth.innerHTML = monthOptions(selected);
    recordMonth.value = [...recordMonth.options].some(option => option.value === selected) ? selected : "ALL";
  }
}

function departmentPrintLabel(department) {
  return department === "Operasional & network development" ? "OND" : department;
}

function byId(id) {
  return document.getElementById(id);
}

function makeId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function optionList(items, selected = "") {
  return items.map(item => `<option value="${escapeHtml(item)}" ${item === selected ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function totalItems(items, mode = "normal") {
  return items.reduce((sum, item) => {
    const price = Number(item.price || item.payment || 0);
    const qty = Number(item.qty || 0);
    const realization = Number(item.realization || 0);
    if (mode === "completion") return sum + (price - realization);
    return sum + (price * qty);
  }, 0);
}

function taxSummary(record) {
  const subtotal = totalItems(record.items || [], record.type === "CAC" ? "completion" : "normal");
  const ppn = Number(record.ppn || 0);
  const pph = Number(record.pph || 0);
  return { subtotal, ppn, pph, total: subtotal + ppn - pph };
}

function terbilang(value) {
  const angka = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  const n = Math.abs(Math.floor(Number(value || 0)));
  function spell(num) {
    if (num < 12) return angka[num];
    if (num < 20) return `${spell(num - 10)} belas`;
    if (num < 100) return `${spell(Math.floor(num / 10))} puluh ${spell(num % 10)}`.trim();
    if (num < 200) return `seratus ${spell(num - 100)}`.trim();
    if (num < 1000) return `${spell(Math.floor(num / 100))} ratus ${spell(num % 100)}`.trim();
    if (num < 2000) return `seribu ${spell(num - 1000)}`.trim();
    if (num < 1000000) return `${spell(Math.floor(num / 1000))} ribu ${spell(num % 1000)}`.trim();
    if (num < 1000000000) return `${spell(Math.floor(num / 1000000))} juta ${spell(num % 1000000)}`.trim();
    return `${spell(Math.floor(num / 1000000000))} miliar ${spell(num % 1000000000)}`.trim();
  }
  if (n === 0) return "Nol rupiah";
  const text = `${value < 0 ? "Minus " : ""}${spell(n)} rupiah`;
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/\s+/g, " ");
}

function baseForm(type, config) {
  const target = byId(type.toLowerCase());
  target.innerHTML = `
    <form class="panel request-form" data-type="${type}">
      <div class="panel-head">
        <h2>${config.heading}</h2>
        <span class="mini">Nomor dibuat otomatis saat disimpan</span>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Tanggal</label>
          <input name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}">
        </div>
        <div class="field">
          <label>Yang Mengajukan</label>
          <input name="requestor" required placeholder="Nama user">
        </div>
        <div class="field">
          <label>Rank</label>
          <select name="rank">${optionList(RANKS, "Staff")}</select>
        </div>
        <div class="field">
          <label>Cost Center</label>
          <select name="costCenter">${optionList(COST_CENTERS, "HRDGA")}</select>
        </div>
        <div class="field">
          <label>Departemen</label>
          <select name="department">${optionList(COST_CENTERS, "HRDGA")}</select>
        </div>
        <div class="field">
          <label>Lokasi</label>
          <select name="location">${optionList(LOCATIONS, "Head Office")}</select>
        </div>
        <div class="field">
          <label>Mata Uang</label>
          <select name="currency">${optionList(CURRENCIES, "IDR")}</select>
        </div>
        <div class="field">
          <label>Kurs</label>
          <input name="exchangeRate" class="money-input" data-money value="1" placeholder="Kurs">
        </div>
        ${config.extra || ""}
        <div class="field full">
          <label>Keterangan</label>
          <textarea name="description" placeholder="Keterangan pengajuan"></textarea>
        </div>
      </div>
      ${config.reference || ""}
      ${config.locationBlock || ""}
      ${itemEditor(config.itemMode || "normal")}
      <div class="form-grid">
        <div class="field">
          <label>PPN</label>
          <input name="ppn" class="money-input" data-money placeholder="Opsional">
        </div>
        <div class="field">
          <label>PPh</label>
          <input name="pph" class="money-input" data-money placeholder="Opsional">
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Department Head</label>
          <input name="deptHead" value="${DEPARTMENT_HEADS.HRDGA}" readonly>
        </div>
        <div class="field">
          <label>Finance</label>
          <input name="finance" value="${FIXED_SIGNERS.finance}" readonly required>
        </div>
        <div class="field">
          <label>General Manager</label>
          <input name="generalManager" value="${FIXED_SIGNERS.generalManager}" readonly>
        </div>
        <div class="field">
          <label>Direksi</label>
          <input name="director" value="${FIXED_SIGNERS.director}" readonly>
        </div>
      </div>
      <div class="form-actions">
        <button type="reset" class="ghost">Kosongkan</button>
        <button type="submit" class="primary">Simpan Pengajuan</button>
      </div>
    </form>
  `;
}

function itemEditor(mode) {
  const headers = mode === "completion"
    ? ["Transaksi", "Payment Request", "Realisasi"]
    : ["Item / Transaksi", "Harga", "Qty"];
  return `
    <div class="panel nested-panel">
      <div class="panel-head">
        <h2>Rincian</h2>
        <button type="button" class="ghost add-row">Tambah Baris</button>
      </div>
      <div class="table-wrap">
        <table class="entry-table item-table" data-mode="${mode}">
          <thead>
            <tr>
              <th style="width:48px">No</th>
              <th>${headers[0]}</th>
              <th style="width:180px">${headers[1]}</th>
              <th style="width:140px">${headers[2]}</th>
              <th style="width:72px"></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <p class="mini table-total">Total: Rp0</p>
    </div>
  `;
}

function locationBlock() {
  return `
    <div class="panel nested-panel">
      <div class="panel-head">
        <h2>Lokasi dan Jadwal</h2>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Start Date</label>
          <input name="startDate" type="date">
        </div>
        <div class="field">
          <label>Close Date</label>
          <input name="closeDate" type="date">
        </div>
        <div class="field">
          <label>Remark</label>
          <input name="remark" placeholder="Catatan lokasi/jadwal">
        </div>
      </div>
    </div>
  `;
}

function referenceSelect(label, name, types) {
  const records = referenceRecords(types);
  return `
    <div class="panel nested-panel">
      <div class="panel-head"><h2>Referensi</h2></div>
      <div class="form-grid">
        <div class="field full">
          <label>${label}</label>
          <select name="${name}">
            <option value="">Tanpa referensi</option>
            ${records.map(record => `<option value="${record.id}">${escapeHtml(record.register)} - ${escapeHtml(record.subject || record.description || FORM_TITLES[record.type])}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>
  `;
}

function referenceRecords(types) {
  const records = visibleRecords();
  if (types.includes("CAC_SOURCE")) {
    return records.filter(record => {
      if (record.type !== "PR") return false;
      const source = state.records.find(item => item.id === record.sourceId);
      return source?.type === "CAR" && source.carType === "Uang Muka";
    });
  }
  const usedSourceIds = new Set(state.records.filter(record => record.type === "PR" && record.sourceId).map(record => record.sourceId));
  return records.filter(record => types.includes(record.type) && !usedSourceIds.has(record.id));
}

function applySigners(form) {
  const department = form.elements.department?.value || "HRDGA";
  if (form.elements.deptHead) form.elements.deptHead.value = DEPARTMENT_HEADS[department] || "";
  if (form.elements.finance) form.elements.finance.value = FIXED_SIGNERS.finance;
  if (form.elements.generalManager) form.elements.generalManager.value = FIXED_SIGNERS.generalManager;
  if (form.elements.director) form.elements.director.value = FIXED_SIGNERS.director;
}

function vendorPickerField(name, label, placeholder) {
  return `
    <div class="field">
      <label>${label}</label>
      <div class="input-with-button">
        <input name="${name}" placeholder="${placeholder}" autocomplete="off">
        <button type="button" class="pick-button open-vendor-picker" data-target="${name}">...</button>
      </div>
    </div>
  `;
}

function initForms() {
  baseForm("PO", {
    heading: "Pengajuan Purchase Order",
    extra: `
      <div class="field">
        <label>Jenis PO</label>
        <select name="poType"><option>Reguler</option><option>Emergency</option></select>
      </div>
      <div class="field">
        <label>No PR Ref</label>
        <input name="prRef" placeholder="Opsional">
      </div>
      ${vendorPickerField("vendor", "Vendor", "Pilih atau ketik vendor")}`
  });
  baseForm("SPK", {
    heading: "Pengajuan Surat Perintah Kerja",
    locationBlock: locationBlock(),
    extra: `
      <div class="field">
        <label>Perihal</label>
        <input name="subject" placeholder="Perihal pekerjaan">
      </div>
      <div class="field">
        <label>Nama Pengawas</label>
        <input name="supervisor" placeholder="Nama pengawas">
      </div>
      <div class="field">
        <label>Penerima Pekerjaan</label>
        <input name="contractor" placeholder="Vendor/pelaksana">
      </div>`
  });
  baseForm("CAR", {
    heading: "Pengajuan Cash Advance Request",
    locationBlock: locationBlock(),
    extra: `
      <div class="field">
        <label>Tipe</label>
        <select name="carType">${optionList(CAR_TYPES, "Uang Muka")}</select>
      </div>
      <div class="field">
        <label>Tujuan</label>
        <input name="purpose" placeholder="Tujuan penggunaan dana">
      </div>
      <div class="field">
        <label>No Payment Ref</label>
        <input name="paymentRef" placeholder="Opsional">
      </div>`
  });
  baseForm("PR", {
    heading: "Pengajuan Payment Request",
    reference: referenceSelect("Referensi PO/CAR/SPK yang belum dibuat PR", "sourceId", ["PO", "CAR", "SPK"]),
    extra: `
      ${vendorPickerField("payee", "Payee", "Pilih atau ketik payee")}
      <div class="field">
        <label>Bank</label>
        <input name="bank" placeholder="Nama bank">
      </div>
      <div class="field">
        <label>No Rekening</label>
        <input name="account" placeholder="Nomor rekening">
      </div>`
  });
  baseForm("CAC", {
    heading: "Pertanggungjawaban Cash Advance Completion",
    itemMode: "completion",
    reference: referenceSelect("Referensi Uang Muka untuk Pertanggungjawaban", "sourceId", ["CAC_SOURCE"]),
    locationBlock: locationBlock(),
    extra: `
      <div class="field">
        <label>No Permintaan</label>
        <input name="requestNumber" placeholder="Nomor CAR/PR">
      </div>
      <div class="field">
        <label>Tanggal Permintaan</label>
        <input name="requestDate" type="date">
      </div>
      <div class="field">
        <label>Status Selisih</label>
        <select name="settlementType"><option>Kelebihan</option><option>Kekurangan</option><option>Sesuai</option></select>
      </div>`
  });

  document.querySelectorAll(".request-form").forEach(form => {
    addItemRow(form.querySelector(".item-table"));
    form.addEventListener("click", event => {
      if (event.target.classList.contains("add-row")) addItemRow(form.querySelector(".item-table"));
      if (event.target.classList.contains("remove-row")) {
        event.target.closest("tr").remove();
        renumberRows(form.querySelector(".item-table"));
      }
    });
    form.addEventListener("input", event => {
      if (event.target.name === "costCenter") {
        form.elements.department.value = event.target.value;
        applySigners(form);
      }
      if (event.target.name === "department") applySigners(form);
      if (event.target.matches("[data-money]")) formatMoneyInput(event.target);
      updateFormTotal(form);
    });
    form.addEventListener("change", event => {
      if (event.target.name === "sourceId") fillFromReference(form, event.target.value);
      if (event.target.name === "payee") fillVendorBankByName(form, event.target.value);
      if (event.target.name === "costCenter") {
        form.elements.department.value = event.target.value;
        applySigners(form);
      }
      if (event.target.name === "department") applySigners(form);
    });
    form.addEventListener("submit", handleSubmit);
  });
}

function addItemRow(table, data = {}) {
  const mode = table.dataset.mode;
  const tbody = table.querySelector("tbody");
  const row = document.createElement("tr");
  row.innerHTML = mode === "completion" ? `
    <td class="row-num"></td>
    <td><input name="itemName" value="${escapeHtml(data.name || "")}" placeholder="Transaksi"></td>
    <td><input name="itemPayment" class="money-input" data-money value="${data.payment ? plainNumber(data.payment) : data.price ? plainNumber(data.price) : ""}" placeholder="0"></td>
    <td><input name="itemRealization" class="money-input" data-money value="${data.realization ? plainNumber(data.realization) : ""}" placeholder="0"></td>
    <td><button type="button" class="danger remove-row">Hapus</button></td>
  ` : `
    <td class="row-num"></td>
    <td><input name="itemName" value="${escapeHtml(data.name || "")}" placeholder="Nama item / transaksi"></td>
    <td><input name="itemPrice" class="money-input" data-money value="${data.price ? plainNumber(data.price) : ""}" placeholder="0"></td>
    <td><input name="itemQty" type="number" min="0" value="${data.qty || 1}" placeholder="1"></td>
    <td><button type="button" class="danger remove-row">Hapus</button></td>
  `;
  tbody.appendChild(row);
  renumberRows(table);
}

function renumberRows(table) {
  table.querySelectorAll("tbody tr").forEach((row, index) => row.querySelector(".row-num").textContent = index + 1);
  updateFormTotal(table.closest("form"));
}

function collectItems(form) {
  const mode = form.querySelector(".item-table").dataset.mode;
  return [...form.querySelectorAll(".item-table tbody tr")].map(row => {
    const get = name => row.querySelector(`[name="${name}"]`)?.value || "";
    if (mode === "completion") {
      return {
        name: get("itemName"),
        payment: parseMoney(get("itemPayment")),
        realization: parseMoney(get("itemRealization")),
        qty: 1
      };
    }
    return {
      name: get("itemName"),
      price: parseMoney(get("itemPrice")),
      qty: Number(get("itemQty") || 0)
    };
  }).filter(item => item.name || item.price || item.payment || item.realization);
}

function updateFormTotal(form) {
  const items = collectItems(form);
  const mode = form.querySelector(".item-table").dataset.mode;
  const subtotal = totalItems(items, mode);
  const ppn = parseMoney(form.elements.ppn?.value);
  const pph = parseMoney(form.elements.pph?.value);
  const total = subtotal + ppn - pph;
  const currency = form.elements.currency?.value || "IDR";
  const label = form.querySelector(".table-total");
  if (label) label.textContent = `Subtotal: ${formatCurrencyValue(subtotal, currency)} | PPN: ${formatCurrencyValue(ppn, currency)} | PPh: ${formatCurrencyValue(pph, currency)} | Total: ${formatCurrencyValue(total, currency)}`;
}

function fillFromReference(form, sourceId) {
  const source = state.records.find(record => record.id === sourceId);
  if (!source) return;
  form.elements.requestor.value = source.requestor || "";
  form.elements.rank.value = source.rank || "Staff";
  form.elements.costCenter.value = source.costCenter || "HRDGA";
  form.elements.department.value = source.department || source.costCenter || "HRDGA";
  form.elements.location.value = source.location || "Head Office";
  form.elements.description.value = source.description || source.subject || "";
  if (form.dataset.type === "PR" && form.elements.payee) {
    form.elements.payee.value = source.vendor || source.payee || "";
    fillVendorBankByName(form, form.elements.payee.value);
  }
  if (form.elements.currency) form.elements.currency.value = source.currency || "IDR";
  if (form.elements.exchangeRate) form.elements.exchangeRate.value = source.exchangeRate ? plainNumber(source.exchangeRate) : "1";
  if (form.elements.ppn) form.elements.ppn.value = source.ppn ? plainNumber(source.ppn) : "";
  if (form.elements.pph) form.elements.pph.value = source.pph ? plainNumber(source.pph) : "";
  if (form.elements.requestNumber) form.elements.requestNumber.value = source.register;
  if (form.elements.requestDate) form.elements.requestDate.value = source.date || "";
  applySigners(form);
  const table = form.querySelector(".item-table");
  table.querySelector("tbody").innerHTML = "";
  source.items.forEach(item => addItemRow(table, item));
  updateFormTotal(form);
}

function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const type = form.dataset.type;
  const items = collectItems(form);
  if (!items.length) {
    alert("Tambahkan minimal satu rincian item/transaksi.");
    return;
  }
  const record = {
    id: makeId(),
    type,
    register: nextRegister(type, data.date),
    createdAt: new Date().toISOString(),
    createdByEmail: currentUser.email || "",
    createdByRole: currentUser.role || "user",
    items,
    ...data
  };
  const source = data.sourceId ? state.records.find(item => item.id === data.sourceId) : null;
  record.sourceRegister = source?.register || "";
  record.exchangeRate = parseMoney(data.exchangeRate || 1) || 1;
  record.ppn = parseMoney(data.ppn);
  record.pph = parseMoney(data.pph);
  record.total = totalItems(items, type === "CAC" ? "completion" : "normal") + record.ppn - record.pph;
  record.subject = data.subject || data.purpose || data.carType || data.description || FORM_TITLES[type];
  state.records.unshift(record);

  saveState();
  rebuildReferenceForms();
  byId("printArea").innerHTML = "";
  byId("printArea").style.display = "none";
  form.reset();
  form.querySelector(".item-table tbody").innerHTML = "";
  addItemRow(form.querySelector(".item-table"));
  showView("records");
}

function rebuildReferenceForms() {
  const currentView = document.querySelector(".view.active")?.id || "dashboard";
  initForms();
  showView(currentView);
}

function vendorCards(vendors, forPicker = false) {
  if (!vendors.length) return `<div class="empty">Belum ada vendor atau payee.</div>`;
  return vendors.map(vendor => `
    <article class="record-card">
      <div>
        <strong>${escapeHtml(vendor.name)}</strong>
        <div class="record-meta">${escapeHtml(vendor.bank || "-")} | ${escapeHtml(vendor.account || "-")} | ${escapeHtml(vendor.phone || "-")}</div>
        <div class="record-meta">${escapeHtml(vendor.address || "")}${vendor.npwp ? ` | NPWP: ${escapeHtml(vendor.npwp)}` : ""}</div>
      </div>
      <div class="record-actions">
        ${forPicker ? `<button class="primary choose-vendor" data-id="${vendor.id}" type="button">Pilih</button>` : `<button class="ghost edit-vendor" data-id="${vendor.id}" type="button">Edit</button><button class="danger delete-vendor" data-id="${vendor.id}" type="button">Hapus</button>`}
      </div>
    </article>
  `).join("");
}

function renderVendors() {
  const list = byId("vendorList");
  const search = (byId("vendorListSearch")?.value || "").toLowerCase();
  const vendors = (state.vendors || []).filter(vendor => {
    const haystack = `${vendor.name} ${vendor.bank} ${vendor.account} ${vendor.phone} ${vendor.address} ${vendor.npwp}`.toLowerCase();
    return haystack.includes(search);
  });
  if (list) list.innerHTML = vendorCards(vendors);
  renderVendorChoices();
}

function renderVendorChoices() {
  const choices = byId("vendorChoices");
  const search = (byId("vendorSearch")?.value || "").toLowerCase();
  if (!choices) return;
  const vendors = (state.vendors || []).filter(vendor => {
    const haystack = `${vendor.name} ${vendor.bank} ${vendor.account} ${vendor.phone} ${vendor.npwp}`.toLowerCase();
    return haystack.includes(search);
  });
  choices.innerHTML = vendorCards(vendors, true);
}

function openVendorModal(targetName) {
  activeVendorTarget = targetName;
  byId("vendorSearch").value = "";
  renderVendorChoices();
  byId("vendorModal").classList.add("open");
  byId("vendorModal").setAttribute("aria-hidden", "false");
  byId("vendorSearch").focus();
}

function closeVendorModal() {
  byId("vendorModal").classList.remove("open");
  byId("vendorModal").setAttribute("aria-hidden", "true");
  activeVendorTarget = null;
}

function applyVendorToActiveForm(vendorId) {
  const vendor = state.vendors.find(item => item.id === vendorId);
  const form = document.querySelector(".view.active form.request-form");
  if (!vendor || !form || !activeVendorTarget) return;
  if (form.elements[activeVendorTarget]) form.elements[activeVendorTarget].value = vendor.name || "";
  if (activeVendorTarget === "payee") {
    if (form.elements.bank) form.elements.bank.value = vendor.bank || "";
    if (form.elements.account) form.elements.account.value = vendor.account || "";
  }
  if (activeVendorTarget === "vendor") {
    if (form.elements.bank && !form.elements.bank.value) form.elements.bank.value = vendor.bank || "";
    if (form.elements.account && !form.elements.account.value) form.elements.account.value = vendor.account || "";
  }
  closeVendorModal();
}

function fillVendorBankByName(form, name) {
  const vendor = state.vendors.find(item => item.name === name);
  if (!vendor) return;
  if (form.elements.bank) form.elements.bank.value = vendor.bank || "";
  if (form.elements.account) form.elements.account.value = vendor.account || "";
}

function handleVendorSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const vendor = {
    id: data.id || makeId(),
    name: data.name,
    phone: data.phone,
    address: data.address,
    account: data.account,
    bank: data.bank,
    npwp: data.npwp
  };
  const index = state.vendors.findIndex(item => item.id === vendor.id);
  if (index >= 0) state.vendors[index] = vendor;
  else state.vendors.unshift(vendor);
  form.reset();
  saveState();
}

function renderDashboard() {
  const month = byId("dashboardMonth")?.value || "ALL";
  const dashboardRecords = filterByMonth(visibleRecords(), month);
  const count = type => dashboardRecords.filter(record => record.type === type).length;
  byId("metricTotal").textContent = dashboardRecords.length;
  byId("metricPO").textContent = count("PO");
  byId("metricCAR").textContent = count("CAR");
  byId("metricPR").textContent = count("PR");
  byId("recentRecords").innerHTML = recordCards(dashboardRecords.slice(0, 5));
}

function renderRecords() {
  const filter = byId("recordFilter")?.value || "ALL";
  const selectedMonth = byId("recordMonth")?.value || "ALL";
  const selectedDepartment = byId("recordDepartment")?.value || "ALL";
  const baseRecords = visibleRecords();
  const byForm = filter === "ALL" ? baseRecords : baseRecords.filter(record => record.type === filter);
  const byDepartment = selectedDepartment === "ALL" ? byForm : byForm.filter(record => record.department === selectedDepartment);
  const records = filterByMonth(byDepartment, selectedMonth);
  byId("allRecords").innerHTML = recordCards(records);
}

function recordCards(records) {
  if (!records.length) return `<div class="empty">Belum ada record.</div>`;
  return records.map(record => `
    <article class="record-card">
      <div>
        <strong>${escapeHtml(FORM_TITLES[record.type])} - ${escapeHtml(record.register)}</strong>
        <div class="record-meta">${escapeHtml(formatDate(record.date))} | ${escapeHtml(record.requestor || "-")} | ${escapeHtml(record.location || "-")} | ${formatCurrencyValue(record.total, record.currency || "IDR")}</div>
        ${isAdmin() && record.createdByEmail ? `<div class="record-meta">Dibuat oleh: ${escapeHtml(record.createdByEmail)}</div>` : ""}
        <div class="record-meta">${escapeHtml(record.subject || record.description || "")}</div>
      </div>
      <div class="record-actions">
        <button class="ghost preview-record" data-id="${record.id}">Preview</button>
        <button class="secondary print-record" data-id="${record.id}">Print / PDF</button>
      </div>
    </article>
  `).join("");
}

function renderPrint(id) {
  const record = visibleRecords().find(item => item.id === id);
  if (!record) return;
  activePrintId = id;
  byId("printArea").innerHTML = printTemplate(record);
}

function metaRow(label, value) {
  return `<tr><td>${escapeHtml(label)}</td><td>: ${escapeHtml(value || "")}</td></tr>`;
}

function printTemplate(record) {
  if (record.type === "PO") return poPrintTemplate(record);
  if (record.type === "CAR") return carPrintTemplate(record);
  if (record.type === "PR") return prPrintTemplate(record);
  return genericPrintTemplate(record);
}

function printHeaderBlock() {
  return `
    <div class="print-header">
      <img class="print-logo" src="assets/logo-puri.jpg" onerror="this.onerror=null;this.src='Logo%20Puri.jpg';" alt="">
      <div class="company-detail">
        <div class="company-name">PT. Puri Prima Persada</div>
        <div>SEQUIS TOWER Lt. 6, Jalan Jendral Sudirman Kav. 71, Jakarta</div>
        <div>Phone: (021) 2524073 | Email: puriprimapersada@gmail.com</div>
        <div>NPWP: 22.499.417.8-012.000</div>
      </div>
    </div>
  `;
}

function printFooterBlock() {
  return `
    <div class="print-footer">
      <strong>PT. PURI PRIMA PERSADA</strong><br>
      SEQUIS TOWER Lt. 6, Jalan Jendral Sudirman Kav. 71, Jakarta<br>
      Phone: (021) 2524073 | Email: puriprimapersada@gmail.com
    </div>
  `;
}

function poPrintTemplate(record) {
  const tax = taxSummary(record);
  return `
    <div class="print-sheet po-sheet">
      ${printHeaderBlock()}
      <div class="po-title-row">
        <div>
          <div class="print-title left-title">Purchase Order</div>
          <div class="mini">Dokumen pemesanan barang atau jasa</div>
        </div>
        <table class="meta-table po-number-box">
          ${metaRow("No. PO", record.register)}
          ${metaRow("Tanggal", formatDate(record.date))}
          ${metaRow("Jenis PO", record.poType)}
          ${metaRow("No PR Ref", record.prRef || "-")}
        </table>
      </div>
      <div class="po-party-grid">
        <div class="border-box">
          <strong>Vendor</strong>
          <div>${escapeHtml(record.vendor || "-")}</div>
        </div>
        <div class="border-box">
          <strong>Pengajuan</strong>
          <div>${escapeHtml(record.requestor || "-")} | ${escapeHtml(record.department || "-")}</div>
          <div>${escapeHtml(record.location || "-")}</div>
          <div>${escapeHtml(record.currency || "IDR")} | Kurs ${plainNumber(record.exchangeRate || 1)}</div>
        </div>
      </div>
      ${poItemTable(record)}
      <div class="section-label">Catatan</div>
      <div class="note-box">${escapeHtml(record.description || "")}</div>
      ${taxLines(record, tax)}
      ${signatureBlock(record)}
      ${printFooterBlock()}
    </div>
  `;
}

function carPrintTemplate(record) {
  const tax = taxSummary(record);
  return `
    <div class="print-sheet car-sheet">
      <div class="car-title">Cash Advance Request</div>
      <div class="car-subtitle">PT. Puri Prima Persada</div>
      <div class="car-meta-grid">
        <table class="meta-table">
          ${metaRow("Tipe", record.carType)}
          ${metaRow("Tujuan", record.purpose)}
          ${metaRow("Keterangan", record.description)}
          ${metaRow("Total Permintaan", formatCurrencyValue(tax.total, record.currency || "IDR"))}
        </table>
        <table class="meta-table">
          ${metaRow("No. Permintaan", record.register)}
          ${metaRow("Tanggal Permintaan", formatDate(record.date))}
          ${metaRow("Yang Mengajukan", record.requestor)}
          ${metaRow("Rank", record.rank)}
          ${metaRow("Departement", record.department)}
        </table>
      </div>
      ${scheduleTable(record)}
      ${carTransactionTable(record)}
      ${taxLines(record, tax)}
      ${signatureBlock(record)}
      ${printFooterBlock()}
    </div>
  `;
}

function prPrintTemplate(record) {
  const tax = taxSummary(record);
  const source = record.sourceId ? state.records.find(item => item.id === record.sourceId) : null;
  return `
    <div class="print-sheet pr-sheet">
      <div class="pr-heading">
        <div>
          <div class="print-title left-title">Request for Payment</div>
          <div class="mini">Please attach all relevant supporting documents</div>
        </div>
        <table class="meta-table pr-number-box">
          ${metaRow("Form No", record.register)}
          ${metaRow("Date", formatDate(record.date))}
          ${metaRow("Reference", source?.register || record.sourceRegister || "-")}
        </table>
      </div>
      <div class="pr-payee-box">
        <table class="meta-table">
          ${metaRow("Payee", record.payee)}
          ${metaRow("Bank", record.bank)}
          ${metaRow("No Rekening", record.account)}
          ${metaRow("Currency", record.currency || "IDR")}
          ${metaRow("Kurs", plainNumber(record.exchangeRate || 1))}
        </table>
        <table class="meta-table">
          ${metaRow("Requestor", record.requestor)}
          ${metaRow("Department", record.department)}
          ${metaRow("Cost Center", record.costCenter)}
          ${metaRow("Location", record.location)}
          ${metaRow("Description", record.description)}
        </table>
      </div>
      ${prPaymentTable(record)}
      ${taxLines(record, tax)}
      ${signatureBlock(record)}
      ${printFooterBlock()}
    </div>
  `;
}

function genericPrintTemplate(record) {
  const tax = taxSummary(record);
  const source = record.sourceId ? state.records.find(item => item.id === record.sourceId) : null;
  return `
    <div class="print-sheet">
      ${printHeaderBlock()}
      <div class="print-title">${escapeHtml(FORM_TITLES[record.type])}</div>
      <div class="print-meta">
        <table class="meta-table">
          ${metaRow(record.type === "CAC" ? "Nama" : "Yang Mengajukan", record.requestor)}
          ${metaRow("Rank", record.rank)}
          ${metaRow("Cost Center", record.costCenter)}
          ${metaRow("Departemen", record.department)}
          ${metaRow("Lokasi", record.location)}
          ${metaRow("Mata Uang", record.currency || "IDR")}
          ${metaRow("Kurs", plainNumber(record.exchangeRate || 1))}
          ${record.type === "SPK" ? metaRow("Perihal", record.subject) : ""}
          ${record.type === "PO" ? metaRow("Jenis PO", record.poType) : ""}
          ${record.type === "CAR" ? metaRow("Tipe", record.carType) + metaRow("Tujuan", record.purpose) : ""}
          ${record.type === "PR" ? metaRow("Payee", record.payee) + metaRow("Bank", record.bank) + metaRow("No Rekening", record.account) : ""}
        </table>
        <table class="meta-table">
          ${metaRow(`No. ${record.type === "CAC" ? "Pengembalian" : "Register"}`, record.register)}
          ${metaRow("Tanggal", formatDate(record.date))}
          ${metaRow("Referensi", source?.register || record.sourceRegister || record.prRef || record.paymentRef || record.requestNumber || "")}
          ${record.requestDate ? metaRow("Tanggal Permintaan", formatDate(record.requestDate)) : ""}
          ${record.startDate ? metaRow("Start Date", formatDate(record.startDate)) : ""}
          ${record.closeDate ? metaRow("Close Date", formatDate(record.closeDate)) : ""}
          ${record.remark ? metaRow("Remark", record.remark) : ""}
        </table>
      </div>
      <div class="section-label">Keterangan</div>
      <div class="note-box">${escapeHtml(record.description || record.subject || "")}</div>
      ${record.type === "SPK" ? spkDetail(record) : itemTable(record)}
      ${taxLines(record, tax)}
      ${signatureBlock(record)}
      ${printFooterBlock()}
    </div>
  `;
}

function poItemTable(record) {
  return `
    <div class="section-label">Rincian Purchase Order</div>
    <table class="print-table po-item-table">
      <thead>
        <tr>
          <th style="width:34px">No</th>
          <th style="width:120px">Kode Barang/Jasa</th>
          <th>Nama Barang/Jasa</th>
          <th style="width:70px">Qty</th>
          <th style="width:115px">Harga</th>
          <th style="width:125px">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${record.items.map((item, index) => {
          const total = Number(item.price || 0) * Number(item.qty || 0);
          return `<tr>
            <td class="num">${index + 1}</td>
            <td></td>
            <td>${escapeHtml(item.name)}</td>
            <td class="num">${plainNumber(item.qty)}</td>
            <td class="money">${formatCurrencyValue(item.price, record.currency || "IDR")}</td>
            <td class="money">${formatCurrencyValue(total, record.currency || "IDR")}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function scheduleTable(record) {
  return `
    <div class="section-label">Lokasi dan Jadwal</div>
    <table class="print-table schedule-table">
      <thead>
        <tr>
          <th>Lokasi</th>
          <th style="width:110px">Start Date</th>
          <th style="width:110px">Close Date</th>
          <th>Remark</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(record.location || "")}</td>
          <td>${escapeHtml(formatDate(record.startDate))}</td>
          <td>${escapeHtml(formatDate(record.closeDate))}</td>
          <td>${escapeHtml(record.remark || record.description || "")}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function carTransactionTable(record) {
  return `
    <div class="section-label">Rincian Cash Advance</div>
    <table class="print-table car-transaction-table">
      <thead>
        <tr>
          <th style="width:34px">No</th>
          <th>Transaksi</th>
          <th style="width:125px">Harga</th>
          <th style="width:70px">Qty</th>
          <th style="width:130px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${record.items.map((item, index) => {
          const total = Number(item.price || 0) * Number(item.qty || 0);
          return `<tr>
            <td class="num">${index + 1}</td>
            <td>${escapeHtml(item.name)}</td>
            <td class="money">${formatCurrencyValue(item.price, record.currency || "IDR")}</td>
            <td class="num">${plainNumber(item.qty)}</td>
            <td class="money">${formatCurrencyValue(total, record.currency || "IDR")}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function prPaymentTable(record) {
  return `
    <div class="section-label">Payment Detail</div>
    <table class="print-table pr-payment-table">
      <thead>
        <tr>
          <th style="width:34px">No</th>
          <th>Description</th>
          <th style="width:135px">Amount</th>
          <th style="width:70px">Qty</th>
          <th style="width:135px">Payment Request</th>
        </tr>
      </thead>
      <tbody>
        ${record.items.map((item, index) => {
          const total = Number(item.price || 0) * Number(item.qty || 0);
          return `<tr>
            <td class="num">${index + 1}</td>
            <td>${escapeHtml(item.name)}</td>
            <td class="money">${formatCurrencyValue(item.price, record.currency || "IDR")}</td>
            <td class="num">${plainNumber(item.qty)}</td>
            <td class="money">${formatCurrencyValue(total, record.currency || "IDR")}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function itemTable(record) {
  const isCompletion = record.type === "CAC";
  return `
    <div class="section-label">${isCompletion ? "Rincian Pertanggungjawaban" : "Rincian Pengajuan"}</div>
    <table class="print-table">
      <thead>
        <tr>
          <th style="width:36px">No</th>
          <th>${isCompletion ? "Transaction" : "Nama Barang / Transaksi"}</th>
          <th style="width:110px">${isCompletion ? "Payment Request" : "Harga"}</th>
          <th style="width:90px">${isCompletion ? "Realization" : "Qty"}</th>
          <th style="width:120px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${record.items.map((item, index) => {
          const total = isCompletion ? Number(item.payment || 0) - Number(item.realization || 0) : Number(item.price || 0) * Number(item.qty || 0);
          return `<tr>
            <td class="num">${index + 1}</td>
            <td>${escapeHtml(item.name)}</td>
            <td class="money">${formatCurrencyValue(isCompletion ? item.payment : item.price, record.currency || "IDR")}</td>
            <td class="money">${isCompletion ? formatCurrencyValue(item.realization, record.currency || "IDR") : plainNumber(item.qty)}</td>
            <td class="money">${formatCurrencyValue(total, record.currency || "IDR")}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function spkDetail(record) {
  return `
    <div class="section-label">Detail Pekerjaan</div>
    <table class="print-table">
      <thead><tr><th style="width:36px">No</th><th>Deskripsi Pekerjaan</th><th style="width:150px">Jumlah</th></tr></thead>
      <tbody>
        ${record.items.map((item, index) => `<tr>
          <td class="num">${index + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td class="money">${formatCurrencyValue(Number(item.price || 0) * Number(item.qty || 0), record.currency || "IDR")}</td>
        </tr>`).join("")}
      </tbody>
    </table>
    <div class="section-label">Ketentuan</div>
    <div class="note-box">Pembayaran dilakukan setelah pekerjaan selesai dan dokumen pendukung diterima lengkap.</div>
  `;
}

function taxLines(record, tax) {
  const currency = record.currency || "IDR";
  return `
    <table class="print-table tax-table">
      <tbody>
        <tr><td>Subtotal</td><td class="money">${formatCurrencyValue(tax.subtotal, currency)}</td></tr>
        <tr><td>PPN</td><td class="money">${tax.ppn ? formatCurrencyValue(tax.ppn, currency) : "-"}</td></tr>
        <tr><td>PPh</td><td class="money">${tax.pph ? `(${formatCurrencyValue(tax.pph, currency)})` : "-"}</td></tr>
        <tr><th>Total</th><th class="money">${formatCurrencyValue(tax.total, currency)}</th></tr>
      </tbody>
    </table>
    <div class="total-line">
      <div>Terbilang: ${escapeHtml(terbilang(tax.total))}</div>
      <div class="money">${formatCurrencyValue(tax.total, currency)}</div>
    </div>
  `;
}

function signatureBlock(record) {
  const departmentLabel = departmentPrintLabel(record.department || "");
  const signatures = [
    ["User yang Mengajukan", record.requestor, record.rank],
    [`Department Head ${departmentLabel}`, record.deptHead || DEPARTMENT_HEADS[record.department] || "", departmentLabel],
    ["Finance", record.finance || FIXED_SIGNERS.finance, "Finance"],
    ["General Manager", record.generalManager, "General Manager"],
    ["Direksi", record.director, "Direksi"]
  ];
  return `<div class="signature-grid">
    ${signatures.map(([role, name, rank]) => `
      <div class="signature-box">
        <div class="role">${escapeHtml(role)}</div>
        <div></div>
        <div class="name">${escapeHtml(name || "")}</div>
        <div class="rank">${escapeHtml(rank || "")}</div>
      </div>`).join("")}
  </div>`;
}

function showView(id) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === id));
  document.querySelectorAll(".nav-button").forEach(button => button.classList.toggle("active", button.dataset.view === id));
  if (id !== "records") {
    byId("printArea").innerHTML = "";
    byId("printArea").style.display = "none";
  }
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-view]");
  if (nav) showView(nav.dataset.view);

  const jump = event.target.closest("[data-view-jump]");
  if (jump) showView(jump.dataset.viewJump);

  const preview = event.target.closest(".preview-record");
  if (preview) {
    renderPrint(preview.dataset.id);
    byId("printArea").style.display = "block";
    byId("printArea").scrollIntoView({ behavior: "smooth" });
  }

  const print = event.target.closest(".print-record");
  if (print) {
    renderPrint(print.dataset.id);
    setTimeout(() => window.print(), 50);
  }

  const picker = event.target.closest(".open-vendor-picker");
  if (picker) openVendorModal(picker.dataset.target);

  const chooseVendor = event.target.closest(".choose-vendor");
  if (chooseVendor) applyVendorToActiveForm(chooseVendor.dataset.id);

  const editVendor = event.target.closest(".edit-vendor");
  if (editVendor) {
    const vendor = state.vendors.find(item => item.id === editVendor.dataset.id);
    const form = byId("vendorForm");
    if (vendor && form) {
      form.elements.id.value = vendor.id;
      form.elements.name.value = vendor.name || "";
      form.elements.phone.value = vendor.phone || "";
      form.elements.address.value = vendor.address || "";
      form.elements.account.value = vendor.account || "";
      form.elements.bank.value = vendor.bank || "";
      form.elements.npwp.value = vendor.npwp || "";
      form.scrollIntoView({ behavior: "smooth" });
    }
  }

  const deleteVendor = event.target.closest(".delete-vendor");
  if (deleteVendor && confirm("Hapus vendor/payee ini?")) {
    state.vendors = state.vendors.filter(item => item.id !== deleteVendor.dataset.id);
    saveState();
  }
});

byId("recordFilter").addEventListener("change", renderRecords);
byId("recordMonth").addEventListener("change", renderRecords);
byId("recordDepartment").addEventListener("change", renderRecords);
byId("dashboardMonth").addEventListener("change", renderDashboard);
byId("vendorForm").addEventListener("submit", handleVendorSubmit);
byId("vendorListSearch").addEventListener("input", renderVendors);
byId("vendorSearch").addEventListener("input", renderVendorChoices);
byId("closeVendorModal").addEventListener("click", closeVendorModal);
byId("vendorModal").addEventListener("click", event => {
  if (event.target.id === "vendorModal") closeVendorModal();
});
byId("loginForm").addEventListener("submit", handleLogin);
byId("logoutButton").addEventListener("click", handleLogout);

byId("exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(exportableState(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `backup-procurement-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

byId("importData").addEventListener("change", event => {
  if (!isAdmin()) {
    alert("Restore data hanya bisa dilakukan oleh administrator.");
    event.target.value = "";
    return;
  }
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      if (!incoming.records || !incoming.sequence) throw new Error("Format tidak sesuai");
      state = { records: incoming.records || [], sequence: incoming.sequence || {}, vendors: incoming.vendors || [] };
      saveState();
      rebuildReferenceForms();
      alert("Data berhasil direstore.");
    } catch {
      alert("File backup tidak dapat dibaca.");
    }
  };
  reader.readAsText(file);
});

async function boot() {
  if (authIsRequired()) {
    const session = window.ProcurementCloud.getSession();
    if (!session) {
      showLogin();
      updateCloudStatus("Silakan login");
      return;
    }
    await startApp(session);
    return;
  }
  byId("loginScreen").classList.add("auth-hidden");
  await startApp();
}

boot();
