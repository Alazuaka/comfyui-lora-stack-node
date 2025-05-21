import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

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
    const resp = await api.fetchApi("/alazuka/files/checkpoints?ext=safetensors,json,cm-info.json");
    if (!resp.ok) throw new Error(resp.statusText);
    const data = await resp.json();

    const grouped = {};

    for (const [ckpt, files] of Object.entries(data)) {
      if (!ckpt.endsWith(".safetensors")) continue;

      const jsons = Object.values(files).filter(f => f.endsWith(".json") || f.endsWith(".cm-info.json"));
      let base = "Unknown";

      for (const jp of jsons) {
        try {
          const r = await api.fetchApi(`/alazuka/file/${jp}`);
          if (!r.ok) continue;
          const j = await r.json();
          if (typeof j.BaseModel === "string" && j.BaseModel.trim()) {
            base = j.BaseModel.trim();
            break;
          }
        } catch {}
      }

      (grouped[base] ??= []).push(ckpt);
    }

    return ["none", ...Object.keys(grouped)
      .sort((a, b) => (a === "Unknown") - (b === "Unknown") || a.localeCompare(b))
      .flatMap(k => [`── ${k} ──`, ...grouped[k].sort()])];

  } catch (e) {
    console.warn("⚠️ Ошибка загрузки или парсинга:", e);
    return ["none"];
  }
}
