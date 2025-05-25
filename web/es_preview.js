import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { api } from "../../../scripts/api.js";
import { loadSettingsFromServer } from "./alazuka.js";

const settings = await loadSettingsFromServer();
const IMAGE_WIDTH = settings.preview['width']
const IMAGE_HEIGHT = settings.preview['height']

console.log(IMAGE_WIDTH)

let imagesByType = {};
const jsonCache = {};


const typesToWatch = ["loras", "checkpoints", "vae"];

const calculateImagePosition = (el, bodyRect) => {
  let { top, left, right } = el.getBoundingClientRect();
  const { width: bodyWidth, height: bodyHeight } = bodyRect;
  const isSpaceRight = right + IMAGE_WIDTH <= bodyWidth;
  left = isSpaceRight ? right : left - IMAGE_WIDTH;
  top = Math.max(0, Math.min(bodyHeight - IMAGE_HEIGHT, top - IMAGE_HEIGHT / 2));
  return { left: Math.round(left), top: Math.round(top), isLeft: !isSpaceRight };
};

function showImage(relativeToEl, imageEl, blur = false) {
  const bodyRect = document.body.getBoundingClientRect();
  if (!bodyRect) return;
  const { left, top, isLeft } = calculateImagePosition(relativeToEl, bodyRect);
  imageEl.style.left = `${left}px`;
  imageEl.style.top = `${top}px`;
  blur ? imageEl.style.filter = `blur(40px)` : imageEl.style.filter = `blur(0)`;

  imageEl.classList.toggle("left", isLeft);

  document.body.appendChild(imageEl);
}

async function loadAllImages() {
  for (const type of typesToWatch) {
    try {
      const data = await (await api.fetchApi(`/alazuka/files/${type}`)).json();
      imagesByType[type] = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {

          imagesByType[type][key] = {
            model: data[key]['safetensors'],
            info: data[key]['json'],
            img: data[key]['png'] || data[key]['webp'] || data[key]['jpeg'] || data[key]['jpg'] || data[key]['png'],
          }; // сохраним ПОЛНЫЕ пути к данным
        }
      }
      console.log(imagesByType)
    } catch (err) {
      console.warn(`[alazuka] Failed to load files for ${type}`, err);
      imagesByType[type] = {};
    }
  }

  console.log("[alazuka] Loaded previews:", imagesByType);
}

function detectTypeByWidgetName(widgetName) {
  if (widgetName?.startsWith("lora_") || widgetName === "lora_name") return "loras";
  if (widgetName === "ckpt_name") return "checkpoints";
  if (widgetName === "vae_name") return "vae";
  return null;
}

async function addPreviewHandlers(item, images, imageHost) {
  const text = item.getAttribute("data-value")?.trim();
  if (!text) return;

  const baseName = text.split(".")[0]; // ключ = имя без расширения

  const data = images[baseName];
  if (!data) return;
  const img = data['img']
  let info = jsonCache[baseName] || null;
  if (!info) {
    try {
      info = await (await fetch(`/alazuka/file/${data['info']}`)).json()
      jsonCache[baseName] = info
    }
    catch (err) { console.warn(`[alazuka] Failed to load info for ${baseName}`, err) }
  }

  const showNSFW = (await loadSettingsFromServer()).NFSW;

  const show = () => {
    imageHost.src = `/alazuka/file/${img}`;
    if (info.Nsfw && !showNSFW) {
      showImage(item, imageHost, true);
    } else {
      showImage(item, imageHost, false);
    }
  };

  const hide = () => {
    imageHost.remove();
  };

  item.addEventListener("mouseover", show, { passive: true });
  item.addEventListener("focusin", show, { passive: true });
  item.addEventListener("mouseout", hide, { passive: true });
  item.addEventListener("focusout", hide, { passive: true });
  item.addEventListener("click", hide, { passive: true });
}

app.registerExtension({
  name: "alazuka.PreviewUniversal",
  async init() {
    const imageHost = $el("img.alazuka-combo-image");

    await loadAllImages();

    $el("style", {
      textContent: `
        .alazuka-combo-image {
          position: absolute;
          width: ${IMAGE_WIDTH}px;
          height: ${IMAGE_HEIGHT}px;
          overflow: hidden;
          object-fit: contain;
          z-index: 9999;
        }
        .alazuka-combo-image.left {
          object-position: top right;
        }
      `,
      parent: document.body,
    });

    const mutationObserver = new MutationObserver((mutations) => {
      const currentNode = app.canvas.current_node;
      if (!currentNode) return;

      for (const mutation of mutations) {
        for (const added of mutation.addedNodes) {
          if (added.classList?.contains("litecontextmenu")) {
            const overWidget = app.canvas.getWidgetAtCursor();
            if (!overWidget) return;

            const type = detectTypeByWidgetName(overWidget.name);
            if (!type) return;

            requestAnimationFrame(() => {
              const images = imagesByType[type];
              if (!images) return;

              const items = added.querySelectorAll(".litemenu-entry");
              for (const item of items) {
                addPreviewHandlers(item, images, imageHost);
              }
            });
          }
        }
      }
    });

    mutationObserver.observe(document.body, { childList: true, subtree: false });
  }
});
