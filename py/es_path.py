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


# Путь к файлу settings.json (родительская папка)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALAZUKA_JSON_PATH = os.path.join(BASE_DIR, "settings.json")

# POST - сохранить настройки
@PromptServer.instance.routes.post("/alazuka/file/settings/post")
async def save_settings(request):
    data = await request.json()
    if not isinstance(data, dict):
        return web.json_response({"status": "error", "message": "Invalid data format, expected JSON object"}, status=400)

    # Загружаем текущие настройки
    if os.path.exists(ALAZUKA_JSON_PATH):
        with open(ALAZUKA_JSON_PATH, "r", encoding="utf-8") as f:
            settings = json.load(f)
    else:
        settings = {}

    # Обновляем ключи из запроса
    settings.update(data)

    # Сохраняем обратно
    with open(ALAZUKA_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=4)

    return web.json_response({"status": "success", "message": "Settings updated", "updated_keys": list(data.keys())})

# GET - получить настройки
@PromptServer.instance.routes.get("/alazuka/file/settings/get")
async def get_settings(request):
    if os.path.exists(ALAZUKA_JSON_PATH):
        with open(ALAZUKA_JSON_PATH, "r", encoding="utf-8") as f:
            settings = json.load(f)
    else:
        settings = {}
    return web.json_response(settings)

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
    type = request.match_info["type"]
    folders = folder_paths.get_folder_paths(type)
    grouped = {}

    for folder in folders:
        if not os.path.isdir(folder):
            continue

        for fname in os.listdir(folder):
            parts = fname.split(".")
            if len(parts) < 2:
                continue  # Пропускаем файлы без расширений

            base_name = parts[0]  # Всё до первой точки
            ext = parts[-1].lower()  # Всё после последней точки

            full_path = os.path.join(folder, fname)
            if not os.path.isfile(full_path):
                continue

            if base_name not in grouped:
                grouped[base_name] = {}

            grouped[base_name][ext] = f"{type}/{fname}"

    return web.json_response(grouped)
