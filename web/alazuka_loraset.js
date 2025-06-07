// === es_loraset.js — декораторный подход ===

import { app } from "../../../scripts/app.js";

app.registerExtension({
  name: "alazuka.EsLoraSet",
  async nodeCreated(node) {
    if (node.comfyClass !== "EsLoraSet") return;

    node._onClickZones = [];
    node.onMouseDown = (e) => {
      for (const zone of node._onClickZones) {
        if (zone.hit(e)) {
          zone.action(e);
          return;
        }
      }
    };

    node.computeSize = function (width) {
      // Авто-высота по количеству виджетов, но не меньше 80px
      const baseHeight = 20;
      const widgetHeight = 28;
      const totalHeight = baseHeight + (this.widgets?.length || 0) * widgetHeight;
      return [width ?? 200, Math.max(80, totalHeight)];
    };

    // Скрытие textarea для lora_config
    const hideTextarea = () => {
      const baseWidget = node.widgets[0];
      node.widgets = [baseWidget];
      if (baseWidget) {
        requestAnimationFrame(() => {
          if (baseWidget.element) baseWidget.element.style.display = "none";
          if (baseWidget.widget_row) baseWidget.widget_row.style.display = "none";
          baseWidget.options.hideOnZoom = true;

          // Прячем саму textarea (на всякий случай)
          baseWidget.element.style.display = "none";
          baseWidget.element.style.opacity = "0";
          baseWidget.element.style.pointerEvents = "none";
          baseWidget.element.style.width = "0";
          baseWidget.element.style.height = "0";

          const wrapper = baseWidget?.element?.parentElement;
          if (!wrapper) return;

          // Прячем обёртку
          wrapper.style.position = "absolute";
          wrapper.style.zIndex = "-1";
          wrapper.style.opacity = "0";
          wrapper.style.pointerEvents = "none";
          wrapper.style.width = "0";
          wrapper.style.height = "0";
        });
      }
    };
    const saveAndMark = () => {
      const cleanLorasData = lorasData.map(entry => {
        if (
          !entry.path ||
          entry.path === "none" ||
          entry.path.startsWith("───")
        ) {
          return { ...entry, path: "" }; // или можно `null`
        }
        return entry;
      });

      const jsonStr = JSON.stringify(cleanLorasData, null, 2);
      node.widgets[0].value = jsonStr;

      if (typeof node.widgets[0].onChange === "function") {
        node.widgets[0].onChange(jsonStr);
      }

      app.graph.setDirtyCanvas(true, true);
      node.setDirtyCanvas(true, true);
    };


    async function buildGroupedLoraList() {
      const paths = await getLorasPath();
      const grouped = {}; // { base_model: [path1, path2, ...] }

      for (const path of paths) {
        if (!path.endsWith(".safetensors")) continue;

        const jsonPath = path.replace(/\.safetensors$/, ".cm-info.json");

        try {
          const response = await fetch(`/alazuka/file/loras/${jsonPath}`);
          if (!response.ok) throw new Error();

          const json = await response.json();

          let modelGroup = "Unknown";
          if (json && typeof json.BaseModel === "string" && json.BaseModel.trim() !== "") {
            modelGroup = json.BaseModel.trim();
          } else {
            console.warn(`🔶 base_model отсутствует или не строка в: ${jsonPath}`);
          }

          if (!grouped[modelGroup]) grouped[modelGroup] = [];
          grouped[modelGroup].push(path);

        } catch (err) {
          console.warn(`⚠️ Не удалось загрузить ${jsonPath}:`, err);
          if (!grouped.Unknown) grouped.Unknown = [];
          grouped.Unknown.push(path);
        }
      }
      // Собираем финальный отсортированный массив
      const sortedKeys = Object.keys(grouped).sort((a, b) => {
        if (a === "Unknown") return 1; // отправляем Unknown в конец
        if (b === "Unknown") return -1;
        return a.localeCompare(b);
      });

      const finalList = ["none"];

      for (const key of sortedKeys) {
        finalList.push(`─── ${key} ───`);
        finalList.push(...grouped[key]);
      }

      return finalList;
    }


    // Получаем список доступных LoRA файлов
    const loraList = await buildGroupedLoraList();

    // Состояние
    let lorasData = [];
    try { lorasData = JSON.parse(node.widgets_values[0] || "[]"); } catch { console.log(`lorasData error`) }

    const addLora = () => {
      lorasData.push({ path: "none", strength_model: 0.7, strength_clip: 0.7 });
      rebuild();
    };

    // Улучшенная версия decorateDrawWidget: теперь с поддержкой дополнительных параметров
    function decorateDrawWidget(widget, options = {}, afterDraw = null) {
      const originalDraw = widget.drawWidget?.bind(widget);
      const defaultHeight = LiteGraph.NODE_WIDGET_HEIGHT || 20;
      const defaultMargin = 15;

      // Значения из options
      const getWidth = typeof options.width === "function"
        ? options.width
        : () => options.width ?? widget.width ?? 100;

      const margin = options.margin ?? defaultMargin;
      const marginBottom = options.marginBottom ?? 0;

      widget.drawWidget = function (ctx, opts = {}) {
        const width = getWidth();
        const height = typeof options.height === "function"
          ? options.height()
          : options.height ?? opts.height ?? this.height ?? defaultHeight;

        opts = {
          ...opts,
          width,
          height,
          margin,
          marginBottom,
          y: opts.y ?? this.y ?? 0,
        };

        this.width = width;

        if (originalDraw) originalDraw(ctx, opts);
        if (afterDraw) {
          afterDraw.call(this, ctx, opts);
        }
      };


      widget.computeSize = function (nodeWidth) {
        const width = getWidth();
        const height = typeof options.height === "function"
          ? options.height()
          : options.height ?? defaultHeight;

        return [width, height + marginBottom];
      };
    }


    function getTextWidgets(node) {
      if (!node.widgets) return [];
      return node.widgets.filter(
        (w) => {
          return w.name && typeof w.name === "string" && (w.name.toLowerCase().includes("text") || w.type.toLowerCase().includes("text"))
        }
      );
    }

    async function getTrainedWords(entry) {
      if (!entry?.path?.endsWith(".safetensors")) {
        console.warn("Неизвестный путь к LoRA:", entry?.path);
        return "";
      }

      const jsonPath = entry.path.replace(/\.safetensors$/, ".cm-info.json");

      try {
        const response = await fetch(`/alazuka/file/loras/${jsonPath}`);
        if (!response.ok) throw new Error(`Ошибка загрузки ${jsonPath}: ${response.statusText}`);

        const json = await response.json();

        if (Array.isArray(json.TrainedWords)) {
          const trainedWords = (json.TrainedWords).join(", ")
          return trainedWords.trim();
        } else {
          console.warn(`🟡 В JSON нет поля "TrainedWords" — ${jsonPath}`)
        }
      } catch (err) {
        console.error("Ошибка при получении TrainedWords:", err)
      }
    }

    function searchNodeAndDoSomethingWithTheFoundNode(
      startNode,
      maxDepth = 3,
      checkFunk = (node) => [],
      ifCheckDoSomethingWithTheFoundNodeFunk = (node, result, depth) => { }
    ) {
      const visited = new Set();
      const queue = [{ node: startNode, depth: 0 }];

      while (queue.length > 0) {
        const { node, depth } = queue.shift();
        if (!node) continue;
        if (depth > 0) {
          if (visited.has(node.id)) { continue }

          visited.add(node.id);

          const result = checkFunk(node);
          const matched = Array.isArray(result) ? result.length > 0 : !!result;

          if (matched) {
            ifCheckDoSomethingWithTheFoundNodeFunk(node, result, depth);
            return; // прекращаем после первого подходящего совпадения
          }
        }

        if (depth >= maxDepth) continue;

        const outputs = node.outputs || [];

        for (const [i, output] of outputs.entries()) {
          if (!output?.links?.length) {
            continue;
          }

          for (const linkId of output.links) {
            const link = app.graph.links[linkId];
            const nextNode = app.graph.getNodeById(link.target_id);

            if (nextNode && !visited.has(nextNode.id)) {
              queue.push({ node: nextNode, depth: depth + 1 });
            }
          }
        }
      }

      console.log(`❌ Ничего не найдено в пределах ${depth} нод`);
    }

    // Перестроение интерфейса
    function rebuild() {
      saveAndMark();
      hideTextarea();
      node._onClickZones = [];

      const baseWidget = node.widgets[0];
      node.widgets = [baseWidget];


      decorateDrawWidget(baseWidget, { width: 0, height: 0, })
      lorasData.forEach((entry, i) => {
        const numberLora = i + 1;

        const combo = node.addWidget(
          "combo",
          `lora_${numberLora}`,
          entry.path || "none",
          v => { entry.path = v; saveAndMark(); },
          { values: loraList }
        );

        const model = node.addWidget(
          "number",
          `strength_model_${numberLora}`,
          entry.strength_model || 0.7,
          v => { entry.strength_model = v; saveAndMark(); },
          { min: 0, max: 2, step: 0.01 }
        );

        const clip = node.addWidget(
          "number",
          `strength_clip_${numberLora}`,
          entry.strength_clip || 0.7,
          v => { entry.strength_clip = v; saveAndMark(); },
          { min: 0, max: 2, step: 0.01 }
        );



        // Оборачиваем каждую отрисовку с динамической шириной

        const baseSize = {
          width: () => node.size[0] - 28,
        }

        const endSize = {
          width: () => node.size[0] - 28,
          marginBottom: 10,
        }

        // Внутри lorasData.forEach((entry, i) => {
        const idx = i; // ← сохраняем в замыкание

        const removeX = function (ctx, opts) {
          const r = opts.height / 2;
          const cx = opts.width + 4;
          const cy = opts.y + opts.height / 2;

          // 🔴 Рисуем кружок без проверки наведения
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = "#222"; // постоянный цвет
          ctx.fill();
          ctx.strokeStyle = "#666";
          ctx.stroke();

          // ➖ Минусик
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.font = `${r * 1.2}px sans-serif`;
          ctx.fillText("✖", cx, cy + 4.5);

          // 🖱️ Зона клика
          node._onClickZones.push({
            hit: (e) => {
              const x = e.canvasX - node.pos[0];
              const y = e.canvasY - node.pos[1];
              return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
            },
            action: () => {
              lorasData.splice(idx, 1);
              rebuild();
            }
          });
        };

        const addText = function (ctx, opts) {
          const r = opts.height / 2;
          const cx = opts.width + 4;
          const cy = opts.y + opts.height / 2;

          // 🔴 Рисуем кружок без проверки наведения
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = "#222"; // постоянный цвет
          ctx.fill();
          ctx.strokeStyle = "#666";
          ctx.stroke();

          // ➖ Минусик
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.font = `${r * 1.2}px sans-serif`;
          ctx.fillText("T", cx, cy + 4.5);

          // 🖱️ Зона клика
          node._onClickZones.push({
            hit: (e) => {
              const x = e.canvasX - node.pos[0];
              const y = e.canvasY - node.pos[1];
              return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
            },
            action: async () => {
              const trigers = await getTrainedWords(entry)
              searchNodeAndDoSomethingWithTheFoundNode(
                node,
                3,
                getTextWidgets,
                (node, widgets, depth) => {

                  const widget = widgets[0]; // берём первый текстовый виджет
                  const oldValue = widget.value.trim();
                  if (!trigers) return
                  const newValue = `${oldValue}${oldValue.trim()[oldValue.trim().length - 1] === "," ? "" : ","} ${trigers[trigers.length - 1] === "," ? trigers : trigers + ","}`

                  widget.value = trigers.length > 0 ? newValue : oldValue; // прямое изменение

                  // если нужна перерисовка или обновление интерфейса:
                  if (app?.graph?.onNodeChanged) {
                    app.graph.onNodeChanged(node);
                  }
                }
              );
            }
          });
        };


        decorateDrawWidget(combo, baseSize, addText);
        decorateDrawWidget(model, baseSize);
        decorateDrawWidget(clip, endSize, removeX);
        // decorateDrawWidget(clip, widgetSize);
      });

      const btn = node.addWidget("button", "➕ Add", null, addLora);

      const addAllText = function (ctx, opts) {
        const scale = 1.2;
        const baseSize = opts.height;
        const size = baseSize * scale;

        const cx = opts.width + 4;
        const cy = opts.y + baseSize / 2;

        const x = cx - size / 2;
        const y = cy - size / 2;

        // ⏹️ Рисуем квадрат
        ctx.beginPath();
        ctx.rect(x, y, size, size);
        ctx.fillStyle = "#222";
        ctx.fill();
        ctx.strokeStyle = "#666";
        ctx.stroke();

        // ✖ Текст по центру
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${size * 0.5}px sans-serif`;
        ctx.fillText("T", cx, cy);

        // 🖱️ Зона клика
        node._onClickZones.push({
          hit: (e) => {
            const xRel = e.canvasX - node.pos[0];
            const yRel = e.canvasY - node.pos[1];
            return (
              xRel >= x &&
              xRel <= x + size &&
              yRel >= y &&
              yRel <= y + size
            );
          },
          action: async () => {
            let trigers = ''
            for (const el of lorasData) {
              const words = await getTrainedWords(el)
              trigers = `${trigers[trigers.length - 1] === "," ? trigers : trigers + ","} ${words}`
            }
            searchNodeAndDoSomethingWithTheFoundNode(
              node,
              3,
              getTextWidgets,
              (node, widgets, depth) => {

                const widget = widgets[0]; // берём первый текстовый виджет
                const oldValue = widget.value.trim();

                const trigKeys = trigers.split(",")
                const trigersSet = [];
                for (const trig of trigKeys) {
                  if(!oldValue.includes(trig)) trigersSet.push(trig)
                }
              
                const unicTrig = trigersSet.join(", ").trim()
                if (!unicTrig) return
                const newValue = `${oldValue[oldValue.length - 1] === (",") ? oldValue : oldValue + ','} ${unicTrig}`

                widget.value = trigers.length > 0 ? newValue : oldValue; // прямое изменение


                // если нужна перерисовка или обновление интерфейса:
                if (app?.graph?.onNodeChanged) {
                  app.graph.onNodeChanged(node);
                }
              }
            )
          }
        });
      };
      if (lorasData?.length > 1) { decorateDrawWidget(btn, { width: () => node.size[0] - 28, }, addAllText) }

      if (typeof node.computeSize === "function") {
        const [w, h] = node.computeSize(node.size[0]);
        node.size = [w, h];
      }
      app.graph.setDirtyCanvas(true);
    }

    rebuild();

  }
});

async function getLorasPath() {
  const resp = await fetch("/alazuka/files/loras");
  const data = await resp.json();
  const path = [];

  Object.keys(data).forEach(el => path.push(`${el}.safetensors`));
  return path
}
