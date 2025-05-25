import { app } from "../../../scripts/app.js";

app.registerExtension({
  name: "alazuka.EsCheckpointSet",
  async nodeCreated(node) {
    if (node.comfyClass !== "EsCheckpointSet") return;

    const widget = node.widgets?.find(w => w.name === "ckpt_name");
    if (!widget) return;

    const values = await getGroupedCheckpoints();
    widget.options.values = values;
    widget.value = "none";

    const cb = widget.callback;
    widget.callback = (v) => {
      widget.value = v.startsWith("──") ? "none" : v;
      cb?.(widget.value);
      app.graph.setDirtyCanvas(true);
    };
  }
});

async function getGroupedCheckpoints() {
  try {
    const resp = await fetch("/alazuka/files/checkpoints");  // Исправлено с api.fetchApi на fetch
    if (!resp.ok) throw new Error(resp.statusText);
    const data = await resp.json();

    const grouped = {};

    for (const [baseName, files] of Object.entries(data)) {
      if (!files.safetensors) continue;

      // Группировка по BaseModel из json
      let baseModel = "Unknown";
      const jsonKeys = Object.keys(files).filter(ext => ext.includes("json"));
      for (const key of jsonKeys) {
        try {
          const r = await fetch(`/alazuka/file/${files[key]}`);
          if (!r.ok) continue;
          const j = await r.json();
          if (typeof j.BaseModel === "string" && j.BaseModel.trim()) {
            baseModel = j.BaseModel.trim();
            break;
          }
        } catch (err) {
          console.warn(`⚠️ Ошибка чтения JSON файла ${files[key]}:`, err);
        }
      }

      if (!grouped[baseModel]) grouped[baseModel] = [];
      grouped[baseModel].push(`${baseName}.safetensors`); // Добавляем путь целиком
    }

    const result = ["none"];
    const sortedKeys = Object.keys(grouped)
      .sort((a, b) => {
        if (a === "Unknown") return 1;
        if (b === "Unknown") return -1;
        return a.localeCompare(b);
      });

    for (const key of sortedKeys) {
      result.push(`── ${key} ──`);
      result.push(...grouped[key].sort());
    }

    return result;
  } catch (e) {
    console.warn("⚠️ Ошибка загрузки или парсинга:", e);
    return ["none"];
  }
}
