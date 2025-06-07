export async function loadSettingsFromServer() {
 try {
  const response = await fetch("/alazuka/file/settings/get");
  const result = await response.json();
  return result;
 } catch (error) {
  console.error("Failed to load settings:", error);
  return {};
 }
}

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