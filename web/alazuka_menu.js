import { app } from "../../scripts/app.js";
import {
 eventBus,
 loadSettingsFromServer,
 saveSettingsToServer
} from "./alazuka_assets.js";


app.registerExtension({
 name: "alazuka",
 async setup() {
  const settings = await loadSettingsFromServer();
  const showNSFW = settings["NSFW"] ?? true;
  const showPrev = settings["show preview"] ?? true;

  // Добавляем настройку для показа превью изображений
  app.ui.settings.addSetting({
   id: "alazuka.Show Preview",
   name: "Show Preview",
   type: "boolean",
   defaultValue: showPrev,
   tooltip: "Показывать превью изображений в выпадающих списках?",
   onChange: (newVal) => {
    saveSettingsToServer({ "show preview": newVal });
    // Отправляем событие о изменении превью
    eventBus.honk("toggle_preview", { isEnabled: newVal });
   }
  });

  // Добавляем настройку для NSFW контента
  app.ui.settings.addSetting({
   id: "alazuka.Show NSFW content",
   name: "Show NSFW content",
   type: "boolean",
   defaultValue: showNSFW,
   tooltip: "Показывать / блюрить контент 18+ в превью.",
   onChange: (newVal) => {
    saveSettingsToServer({ NSFW: newVal });
    // Отправляем событие о изменении NSFW
    eventBus.honk("toggle_NSFW", { isEnabled: newVal });
   }
  });
 }
});

