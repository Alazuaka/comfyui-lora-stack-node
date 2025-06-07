import { app } from "../../scripts/app.js";
import { loadSettingsFromServer } from "./alazuka_assets.js"
import { saveSettingsToServer } from "./alazuka_assets.js"

app.registerExtension({
 name: "alazuka",
 async setup() {
  const settings = await loadSettingsFromServer();
  const showNSFW = settings.NFSW ?? true;

  app.ui.settings.addSetting({
   id: "alazuka.showNSFW",
   name: "Show NSFW content",
   type: "boolean",
   defaultValue: showNSFW,
   tooltip: "Показывать / блюрить контент 18+ в превью. Работает после перезагрузки",
   onChange: (newVal) => {
    saveSettingsToServer({ NFSW: newVal });
   }
  });
 }
});
