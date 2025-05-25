import { app } from "../../scripts/app.js";

export async function saveSettingsToServer(data) {
 try {
  const response = await fetch("/alazuka/file/settings/post", {
   method: "POST",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify(data)
  });
  const result = await response.json();
  console.log("Settings saved:", result);
 } catch (error) {
  console.error("Failed to save settings:", error);
 }
}

export async function loadSettingsFromServer() {
 try {
  const response = await fetch("/alazuka/file/settings/get");
  console.log(response)
  const result = await response.json();
  console.log("Loaded settings:", result);
    console.log(result)
  return result;
 } catch (error) {
  console.error("Failed to load settings:", error);
  return {};
 }
}
console.log(app.sharedData)

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
