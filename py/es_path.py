# 📂 Структура маршрутов `/alazuka/…`

# | Endpoint | Метод | Назначение |
# |----------|-------|------------|
# | `/alazuka/file/{type}/{filename}` | `GET` | Получить любой файл (json, image, model, etc) |
# | `/alazuka/related/{type}/{basename}` | `GET` | Получить связанные файлы (preview, json и др.) |
# | `/alazuka/savefile/{type}/{target}` | `POST` | Сохранить файл как превью или другой тип |

import os
import re
import json
import folder_paths

from PIL import Image, ExifTags
from aiohttp import web
from server import PromptServer
from folder_paths import get_full_path

# При необходимости можно вызвать register_endpoints здесь
# или оставить как есть, если регистрация происходит через __init__.py



def extract_metadata_from_media(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    if ext in ['.jpg', '.jpeg', '.png']:
        return extract_universal_metadata(filepath)
    else:
        return {"error": f"Unsupported file type: {ext}"}

def extract_universal_metadata(filepath):
    metadata = {
        "path": filepath,
        "size": None,
        "format": "JPEG" if filepath.lower().endswith(('.jpg', '.jpeg')) else "PNG",
        "prompt": "",
        "negative_prompt": "",
        "workflow": "",
        "parameters": {},
        "is_NSFW": False
    }

    try:
        with Image.open(filepath) as img:
            metadata["size"] = img.size
            
            # Общая обработка для всех форматов
            text_data = {}
            if hasattr(img, '_getexif'):
                exif_data = img._getexif() or {}
                for tag, value in exif_data.items():
                    tag_name = ExifTags.TAGS.get(tag, tag)
                    if tag == 37510:  # UserComment
                        try:
                            if isinstance(value, bytes):
                                value = value.decode('utf-16-be' if value.startswith(b'UNICODE\x00\x00') else 'utf-8', errors='ignore')
                            text_data["UserComment"] = value
                        except Exception as e:
                            text_data["UserComment"] = f"Decode error: {str(e)}"
            
            # Для PNG и других форматов
            if hasattr(img, 'info'):
                for key, value in img.info.items():
                    if isinstance(value, str):
                        text_data[key] = value
            
            # Универсальный поиск параметров
            search_text = "\n".join([str(v) for v in text_data.values()])
            parse_any_metadata(search_text, metadata)
            
            # Проверка NSFW
            metadata["is_NSFW"] = check_nsfw(metadata["prompt"])
            
            # Сохраняем все текстовые данные
            metadata["text_data"] = text_data
            
    except Exception as e:
        metadata["error"] = str(e)
    
    return metadata

def parse_any_metadata(text, metadata):
    """Улучшенный парсер для поиска параметров в любом месте текста"""
    if not text:
        return
    
    # Нормализация текста
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Поиск негативного промпта (разные варианты написания)
    neg_patterns = [
        r"negative prompt:\s*(.*?)(?=\n\w+:|$)",
        r"neg prompt:\s*(.*?)(?=\n\w+:|$)",
        r"negative_prompt:\s*(.*?)(?=\n\w+:|$)"
    ]
    
    for pattern in neg_patterns:
        if match := re.search(pattern, text, re.IGNORECASE | re.DOTALL):
            metadata["negative_prompt"] = match.group(1).strip()
            break
    
    # Поиск основного промпта (берем текст до негативного промпта или весь текст)
    if metadata["negative_prompt"]:
        split_pos = text.lower().find("negative prompt")
        metadata["prompt"] = text[:split_pos].strip()
    else:
        metadata["prompt"] = text.strip()
    
    # Поиск параметров генерации
    param_patterns = {
        "Steps": r"Steps:\s*(\d+)",
        "Sampler": r"Sampler:\s*([^\n]+)",
        "CFG scale": r"CFG scale:\s*([\d.]+)",
        "Seed": r"Seed:\s*(\d+)",
        "Size": r"Size:\s*(\d+x\d+)",
        "Model": r"Model:\s*([^\n]+)",
        "Model hash": r"Model hash:\s*([^\n]+)"
    }
    
    workflow_parts = []
    for name, pattern in param_patterns.items():
        if match := re.search(pattern, text, re.IGNORECASE):
            metadata["parameters"][name] = match.group(1).strip()
            workflow_parts.append(f"{name}: {match.group(1).strip()}")
    
    if workflow_parts:
        metadata["workflow"] = ", ".join(workflow_parts)

def check_nsfw(text):
    """Проверка текста на NSFW содержание (улучшенная версия)"""
    if not text:
        return False

    nsfw_keywords = {
        "cum", "bukkake", "nipple", "areola", "pussy", "anus", "asshole",
        "deepthroat", "fisting", "blowjob", "gangbang", "tentacle", "bondage", 
        "dildo", "vibrator", "orgasm", "penetration", "squirting", "cumshot",
        "creampie", "felching", "rimjob", "rimming", "anal", "dp", "gaping",
        "cock", "dick", "penis", "erection", "testicles", "scrotum", "glans",
        "clitoris", "clit", "labia", "vulva", "uncensored", "nude", "nudity",
        "masturbation", "fingering", "futa", "futanari", "shemale", "transgirl",
        "cumdump", "slut", "whore", "escort", "prostitute"
    }

    # Нормализация текста: удаляем знаки пунктуации и приводим к нижнему регистру
    normalized_text = re.sub(r'[^\w\s-]', '', text.lower())
    
    # Разбиваем на слова, включая составные (через дефис/подчёркивание)
    words = set()
    for word in re.findall(r'[\w-]+', normalized_text):
        words.update(word.split('_'))  # Разбиваем snake_case
        words.update(word.split('-'))  # Разбиваем kebab-case
    
    return any(keyword in words for keyword in nsfw_keywords)


class UnicodeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, str):
            return obj
        return super().default(obj)

def bytes_to_str(obj):
    if isinstance(obj, dict):
        return {k: bytes_to_str(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [bytes_to_str(i) for i in obj]
    elif isinstance(obj, bytes):
        try:
            return obj.decode('utf-8', errors='ignore')
        except:
            return str(obj)
    else:
        return obj   


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

    # Сначала находим все модели (safetensors, pt, ckpt и т.д.)
    model_exts = {"safetensors", "pt", "ckpt", "bin", "pth"}  # можно расширить
    image_exts = {"jpeg", "jpg", "png"}  # можно расширить

    for folder in folders:
        if not os.path.isdir(folder):
            continue

        # Сканируем папку и группируем файлы
        for fname in os.listdir(folder):
            full_path = os.path.join(folder, fname)
            if not os.path.isfile(full_path):
                continue

            # Разделяем имя файла и расширение
            if "." not in fname:
                continue
            base_part, ext = fname.rsplit(".", 1)
            ext = ext.lower()

            # Если это модель — создаём запись
            if ext in model_exts:
                if base_part not in grouped:
                    grouped[base_part] = {
                        "model": f"{type}/{fname}",
                        "image": {},
                        "json": None
                    }

        # Теперь ищем связанные файлы (изображения и JSON)
        for base_part in list(grouped.keys()):
            # Ищем изображения (начинаются как base_part, заканчиваются на image_exts)
            for fname in os.listdir(folder):
                if not fname.startswith(base_part + "."):
                    continue

                full_path = os.path.join(folder, fname)
                if not os.path.isfile(full_path):
                    continue

                # Проверяем расширение
                _, ext = fname.rsplit(".", 1)
                ext = ext.lower()

                if ext in image_exts:
                    meta_info = extract_metadata_from_media(full_path)
                    grouped[base_part]["image"][ext] = {
                        "path": f"{type}/{fname}",
                        "is_NSFW": meta_info.get("is_NSFW", False),
                        "prompt": meta_info.get("prompt", ""),
                        "negative_prompt": meta_info.get("negative_prompt", ""),
                        "workflow": meta_info.get("workflow", ""),
                        "meta_data": meta_info.get("exif", {}) or meta_info.get("text", {})
                    }

                elif ext == "json":
                    grouped[base_part]["json"] = f"{type}/{fname}"

    return web.json_response(grouped)