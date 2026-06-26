(function () {
  const config = window.PROCUREMENT_CLOUD_CONFIG || {};
  let timer = null;
  let pendingState = null;

  function enabled() {
    return Boolean(config.supabaseUrl && config.anonKey);
  }

  function endpoint(query = "") {
    return `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/procurement_app_state${query}`;
  }

  function headers(extra = {}) {
    return {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      ...extra
    };
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

  window.ProcurementCloud = { enabled, load, save, persist };
})();
