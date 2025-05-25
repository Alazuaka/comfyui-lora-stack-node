async function getGroupedCheckpoints() {
  try {
    const resp = await api.fetchApi("/alazuka/files/checkpoints");
    if (!resp.ok) throw new Error(resp.statusText);
    const data = await resp.json();

    const grouped = {};

    for (const [baseName, files] of Object.entries(data)) {
      if (!files.safetensors) continue;

      const jsonKeys = Object.keys(files).filter(ext => ext.includes("json"));
      let baseModel = "Unknown";

      for (const key of jsonKeys) {
        try {
          const r = await fetch(`/alazuka/file/${files[key]}`);
          if (!r.ok) continue;
          const j = await r.json();
          if (typeof j.BaseModel === "string" && j.BaseModel.trim()) {
            baseModel = j.BaseModel.trim();
            break;
          }
        } catch {}
      }

      if (!grouped[baseModel]) grouped[baseModel] = [];
      // Используем полный путь
      grouped[baseModel].push(files.safetensors);
    }

    // Здесь оставляем полный путь в значениях
    return ["none", ...Object.keys(grouped)
      .sort((a, b) => (a === "Unknown") - (b === "Unknown") || a.localeCompare(b))
      .flatMap(key => [`── ${key} ──`, ...grouped[key].sort()])];

  } catch (e) {
    console.warn("⚠️ Ошибка загрузки или парсинга:", e);
    return ["none"];
  }
}
