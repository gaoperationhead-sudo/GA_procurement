(function () {
  const config = window.PROCUREMENT_CLOUD_CONFIG || {};
  const AUTH_KEY = "procurement-auth-session-v1";
  let timer = null;
  let pendingState = null;

  function enabled() {
    return Boolean(config.supabaseUrl && config.anonKey);
  }

  function endpoint(query = "") {
    return `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/procurement_app_state${query}`;
  }

  function authEndpoint(path) {
    return `${config.supabaseUrl.replace(/\/$/, "")}/auth/v1/${path}`;
  }

  function getSession() {
    try {
      const session = JSON.parse(localStorage.getItem(AUTH_KEY));
      if (!session?.access_token) return null;
      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        localStorage.removeItem(AUTH_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function isAdminEmail(email) {
    const list = (config.adminEmails || []).map(item => String(item).toLowerCase());
    return list.includes(String(email || "").toLowerCase());
  }

  function roleForSession(session) {
    return isAdminEmail(session?.user?.email) ? "admin" : "user";
  }

  function authRequired() {
    return Boolean(config.authRequired);
  }

  function headers(extra = {}) {
    const session = getSession();
    return {
      apikey: config.anonKey,
      Authorization: `Bearer ${session?.access_token || config.anonKey}`,
      "Content-Type": "application/json",
      ...extra
    };
  }

  async function signIn(email, password) {
    if (!enabled()) throw new Error("Cloud belum dikonfigurasi.");
    const response = await fetch(authEndpoint("token?grant_type=password"), {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error_description || payload.msg || "Login gagal.");
    localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
    return payload;
  }

  async function updatePassword(password) {
    const session = getSession();
    if (!enabled()) throw new Error("Cloud belum dikonfigurasi.");
    if (!session?.access_token) throw new Error("Session login tidak ditemukan.");
    const response = await fetch(authEndpoint("user"), {
      method: "PUT",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error_description || payload.msg || "Gagal mengganti password.");
    return payload;
  }

  function signOut() {
    localStorage.removeItem(AUTH_KEY);
  }

  async function load() {
    if (!enabled()) return null;
    const id = encodeURIComponent(config.recordId || "procurement-hrdga-ppp");
    const response = await fetch(endpoint(`?id=eq.${id}&select=data`), { headers: headers() });
    if (!response.ok) throw new Error(`Cloud load gagal (${response.status})`);
    const rows = await response.json();
    return rows[0]?.data || null;
  }

  async function persist(state) {
    const response = await fetch(endpoint("?on_conflict=id"), {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        id: config.recordId || "procurement-hrdga-ppp",
        data: state,
        updated_at: new Date().toISOString()
      })
    });
    if (!response.ok) throw new Error(`Cloud save gagal (${response.status})`);
  }

  function save(state) {
    if (!enabled()) return Promise.resolve(false);
    pendingState = structuredClone(state);
    clearTimeout(timer);
    return new Promise((resolve, reject) => {
      timer = setTimeout(async () => {
        try {
          await persist(pendingState);
          resolve(true);
        } catch (error) {
          reject(error);
        }
      }, 450);
    });
  }

  window.ProcurementCloud = { enabled, authRequired, getSession, isAdminEmail, roleForSession, signIn, signOut, updatePassword, load, save, persist };
})();
