import { app } from "../../../scripts/app.js";

app.registerExtension({
  name: "alazuka.AlazukaCheckpoint",
  async nodeCreated(node) {
    if (node.comfyClass !== "AlazukaCheckpoint") return;

    const widget = node.widgets?.find(w => w.name === "ckpt_name");
    if (!widget) {
      console.warn("⛔ Виджет 'ckpt_name' не найден в узле", node);
      return;
    }

    const values = await getGroupedCheckpoints();

    widget.options.values = values;
    widget.value = "none";

    const cb = widget.callback;
    widget.callback = (v) => {
      if (!v || v.startsWith("──")) return;  // игнор заголовков
      widget.value = v;
      cb?.(v);
      app.graph.setDirtyCanvas(true);
    };
  }
});


async function getGroupedCheckpoints() {
  try {
    const resp = await fetch("/alazuka/files/checkpoints");
    if (!resp.ok) throw new Error(`Не удалось получить список: ${resp.status} ${resp.statusText}`);
    const data = await resp.json();

    const grouped = {};
    let totalFound = 0;

    for (const [baseName, files] of Object.entries(data)) {
      const modelPath = files.model;
      if (!modelPath || !modelPath.endsWith(".safetensors")) {
        continue;
      }

      totalFound++;

      let baseModel = "Unknown";
      const jsonPath = files.json;
      if (jsonPath) {
        try {
          const r = await fetch(`/alazuka/file/${jsonPath}`);
          if (r.ok) {
            const j = await r.json();
            if (typeof j.BaseModel === "string" && j.BaseModel.trim()) {
              baseModel = j.BaseModel.trim();
            }
          } else {
            console.warn(`⚠️ Не удалось загрузить JSON: ${jsonPath}`);
          }
        } catch (err) {
          console.warn(`⚠️ Ошибка чтения JSON ${jsonPath}:`, err);
        }
      }

      if (!grouped[baseModel]) grouped[baseModel] = [];
      grouped[baseModel].push(modelPath.split("/").pop()); // Только имя файла
    }

    const result = ["none"];
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return a.localeCompare(b);
    });

    for (const key of sortedKeys) {
      result.push(`── ${key} ──`);
      const models = grouped[key].sort((a, b) => a.localeCompare(b));
      result.push(...models);
    }

    if (result.length === 1) {
      console.warn("⚠️ Список чекпоинтов пустой или содержит только 'none'");
    }

    return result;
  } catch (e) {
    console.error("💥 Ошибка загрузки чекпоинтов:", e);
    return ["none"];
  }
}
