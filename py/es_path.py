# 📂 Структура маршрутов `/alazuka/…`

# | Endpoint | Метод | Назначение |
# |----------|-------|------------|
# | `/alazuka/file/{type}/{filename}` | `GET` | Получить любой файл (json, image, model, etc) |
# | `/alazuka/related/{type}/{basename}` | `GET` | Получить связанные файлы (preview, json и др.) |
# | `/alazuka/savefile/{type}/{target}` | `POST` | Сохранить файл как превью или другой тип |


import os
import shutil
import json

from aiohttp import web
from server import PromptServer
import folder_paths
from folder_paths import get_directory_by_type, get_full_path, get_folder_paths


def find_related_file(base_path, extensions):
    for ext in extensions:
        candidate = f"{base_path}.{ext}"
        if os.path.isfile(candidate):
            return candidate
    return None


@PromptServer.instance.routes.get("/alazuka/file/{type}/{filename}")
async def serve_file(request):
    type = request.match_info["type"]
    filename = request.match_info["filename"]

    file_path = get_full_path(type, filename)
    if not file_path or not os.path.isfile(file_path):
        return web.Response(status=404)

    ext = os.path.splitext(filename)[1].lower()
    if ext == ".json":
        with open(file_path, "r", encoding="utf-8") as f:
            return web.Response(text=f.read(), content_type="application/json")

    return web.FileResponse(file_path)

@PromptServer.instance.routes.get("/alazuka/files/{type}")
async def get_grouped_files(request):
    # Пример: /alazuka/files/loras?ext=jpg,png,json,safetensors

    type = request.match_info["type"]
    # Получаем тип, например: 'loras'

    query_exts = request.query.get("ext", "")
    # Получаем параметр 'ext' из запроса: "jpg,png,json"

    if not query_exts:
        return web.Response(status=400, text="Missing 'ext' query parameter")
        # Если нет параметра ext — ошибка 400

    target_exts = [e.strip().lower() for e in query_exts.split(",") if e.strip()]
    # Парсим расширения: ["jpg", "png", "json"]

    if not target_exts:
        return web.Response(status=400, text="Invalid 'ext' values")
        # Если список пуст — ошибка 400

    folders = folder_paths.get_folder_paths(type)
    # Получаем все папки, в которых могут быть файлы типа 'loras'

    grouped = {}  # Соберём сюда результат

    for folder in folders:
        if not os.path.isdir(folder):
            continue  # Пропускаем, если не папка

        for fname in os.listdir(folder):
            base_name, ext = os.path.splitext(fname)
            # fname: 'ahegao_v1.safetensors' => base_name: 'ahegao_v1', ext: '.safetensors'

            full_base_path = os.path.join(folder, base_name)
            # Полный путь без расширения, например: /path/to/loras/ahegao_v1

            found = {}
            for t_ext in target_exts:
                alt_path = f"{full_base_path}.{t_ext}"
                # Пробуем: /path/to/loras/ahegao_v1.jpg (или .png/.json)

                if os.path.isfile(alt_path):
                    # Если файл есть, добавляем его:
                    found[t_ext] = f"{type}/{os.path.basename(alt_path)}"
                    # Пример: "jpg": "loras/ahegao_v1.jpg"

            if found:
                # Если найдено хотя бы одно сопутствующее расширение
                grouped[fname] = found
                # Ключ — оригинальный файл: "ahegao_v1.safetensors"
                # Значение: { "jpg": "loras/ahegao_v1.jpg", ... }

    print(web.json_response(grouped))  # Вывод в консоль для отладки

    return web.json_response(grouped)
    # Возвращает JSON вида:
    # {
    #   "ahegao_v1.safetensors": {
    #     "jpg": "loras/ahegao_v1.jpg",
    #     "json": "loras/ahegao_v1.json"
    #   },
    #   "cool_style.ckpt": {
    #     "preview.png": "checkpoints/cool_style.preview.png"
    #   }
    # }

@PromptServer.instance.routes.post("/alazuka/savefile/{type}/{target}")
async def save_file(request):
    type = request.match_info["type"]
    target = request.match_info["target"]

    body = await request.json()
    src_dir = get_directory_by_type(body.get("type", "output"))
    subfolder = body.get("subfolder", "")
    filename = body.get("filename", "")

    src_path = os.path.join(src_dir, os.path.normpath(subfolder), filename)
    dst_path = get_full_path(type, target)

    if not dst_path:
        folders = get_folder_paths(type)
        if not folders:
            return web.Response(status=400)
        dst_path = os.path.join(folders[0], target)

    dst_path = os.path.splitext(dst_path)[0] + os.path.splitext(src_path)[1]

    if os.path.commonpath((src_dir, os.path.abspath(src_path))) != src_dir:
        return web.Response(status=400)

    shutil.copyfile(src_path, dst_path)
    return web.json_response({"saved": f"{type}/{os.path.basename(dst_path)}"})


## 🔌 Пример как вызывать из JS

### Получить связанный preview + json:
# ```js
# const type = "loras";
# const basename = "my_lora.safetensors";

# const related = await (await fetch(`/alazuka/related/${type}/${basename}`)).json();

# console.log("Preview URL:", `/alazuka/file/${related.preview}`);
# console.log("JSON URL:", `/alazuka/file/${related.json}`);
# ```

# ### Получить содержимое JSON:
# ```js
# const jsonText = await (await fetch(`/alazuka/file/loras/my_lora.json`)).json();
# console.log("TrainedWords:", jsonText.TrainedWords);
# ```

# ### Отправить preview:
# ```js
# await fetch(`/alazuka/savefile/loras/my_lora.safetensors`, {
#   method: "POST",
#   headers: { "Content-Type": "application/json" },
#   body: JSON.stringify({
#     type: "output",
#     subfolder: "temp",
#     filename: "preview.png"
#   })
# });
# ```