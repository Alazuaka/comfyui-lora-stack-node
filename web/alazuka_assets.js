class EventBus {
  constructor() {
    // Объект для хранения подписчиков: 
    // { eventName: [callback1, callback2, ...] }
    this.listeners = {};
  }

  /**
   * Подписка на событие
   * @param {string} event - Имя события
   * @param {function} callback - Функция-обработчик
   */
  add(event, callback) {
    // Если для события нет массива подписчиков — создаем его
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this; // Возвращаем this для цепочки вызовов
  }

  /**
   * Отписка от события
   * @param {string} event - Имя события
   * @param {function} callback - Функция, которую нужно удалить
   */
  remove(event, callback) {
    if (!this.listeners[event]) {
      return;
    }
    // Оставляем все колбэки, кроме указанного
    this.listeners[event] = this.listeners[event].filter(
      (listener) => listener !== callback
    );
    return this; // Возвращаем this для цепочки вызовов
  }

  /**
   * Генерация события (уведомление подписчиков)
   * @param {string} event - Имя события
   * @param {any} data - Данные для передачи подписчикам
   */
  honk(event, data) {
    if (!this.listeners[event]) {
      return;
    }
    // Вызываем все подписанные колбэки
    this.listeners[event].forEach((listener) => {
      listener(data);
    });
    return this; // Возвращаем this для цепочки вызовов
  }
}

// Экспортируем единственный экземпляр EventBus (паттерн "Сиглтон")
export const eventBus = new EventBus();

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