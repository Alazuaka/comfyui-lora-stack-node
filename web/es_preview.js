import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";
import { api } from "../../../scripts/api.js";

const IMAGE_WIDTH = 384;
const IMAGE_HEIGHT = 384;
let imagesByType = {};

const typesToWatch = ["loras", "checkpoints", "vae"];

const calculateImagePosition = (el, bodyRect) => {
  let { top, left, right } = el.getBoundingClientRect();
  const { width: bodyWidth, height: bodyHeight } = bodyRect;
  const isSpaceRight = right + IMAGE_WIDTH <= bodyWidth;
  left = isSpaceRight ? right : left - IMAGE_WIDTH;
  top = Math.max(0, Math.min(bodyHeight - IMAGE_HEIGHT, top - IMAGE_HEIGHT / 2));
  return { left: Math.round(left), top: Math.round(top), isLeft: !isSpaceRight };
};

function showImage(relativeToEl, imageEl) {
  const bodyRect = document.body.getBoundingClientRect();
  if (!bodyRect) return;
  const { left, top, isLeft } = calculateImagePosition(relativeToEl, bodyRect);
  imageEl.style.left = `${left}px`;
  imageEl.style.top = `${top}px`;
  imageEl.classList.toggle("left", isLeft);
  document.body.appendChild(imageEl);
}

async function loadAllImages() {
  for (const type of typesToWatch) {
    try {
      const data = await (await api.fetchApi(`/esprev/files/${type}?ext=png,jpg,jpeg,preview.png,preview.jpeg`)).json();
      imagesByType[type] = {};
      for (const [filename, files] of Object.entries(data)) {
        const base = filename.split(".")[0]; // ключ — имя LoRA без расширения
        const preview =
          files["preview.png"] || files["preview.jpeg"] || files["png"] || files["jpg"] || files["jpeg"];
        if (preview) {
          imagesByType[type][base] = preview; // сохраним ПОЛНЫЙ путь к превью
        }
      }
    } catch (err) {
      console.warn(`[esprev] Failed to load files for ${type}`, err);
      imagesByType[type] = {};
    }
  }

  console.log("[esprev] Loaded previews:", imagesByType);
}

function detectTypeByWidgetName(widgetName) {
  if (widgetName?.startsWith("lora_") || widgetName === "lora_name") return "loras";
  if (widgetName === "ckpt_name") return "checkpoints";
  if (widgetName === "vae_name") return "vae";
  return null;
}

function addPreviewHandlers(item, images, imageHost) {
  const text = item.getAttribute("data-value")?.trim();
  if (!text) return;

  const baseName = text.split(".")[0]; // ключ = имя без расширения

  const previewPath = images[baseName];
  if (!previewPath) return;

  const show = () => {
    imageHost.src = `/esprev/file/${previewPath}`;
    showImage(item, imageHost);
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
  name: "esprev.PreviewUniversal",
  async init() {
    const imageHost = $el("img.esprev-combo-image");

    await loadAllImages();

    $el("style", {
      textContent: `
        .esprev-combo-image {
          position: absolute;
          width: ${IMAGE_WIDTH}px;
          height: ${IMAGE_HEIGHT}px;
          object-fit: contain;
          z-index: 9999;
        }
        .esprev-combo-image.left {
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
