import json
from folder_paths import get_full_path
from comfy.utils import load_torch_file
from comfy.sd import load_lora_for_models

class EsLoraSet:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "lora_config": ("STRING", {
                    "multiline": True,
                    "default": '[{"path": "none.safetensors", "strength": 0.7}]'
                })
            }
        }
    
    RETURN_TYPES = ("MODEL", "CLIP")
    FUNCTION = "apply_loras"
    CATEGORY = "esprev"

    def apply_loras(self, model, clip, lora_config):
        try:
            config = json.loads(lora_config)
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON in lora_config")

        result_model = model.clone()
        result_clip = clip.clone()

        for entry in config:
            path = entry.get("path")
            if not path:
                continue

            strength_model = entry.get("strength_model", entry.get("strength", 1.0))
            strength_clip = entry.get("strength_clip", entry.get("strength", 1.0))

            full_path = get_full_path("loras", path)
            lora = load_torch_file(full_path, safe_load=True)

            result_model, result_clip = load_lora_for_models(
                result_model, result_clip, lora, strength_model, strength_clip
            )

        return (result_model, result_clip)


NODE_CLASS_MAPPINGS = {
    "EsLoraSet": EsLoraSet,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "EsLoraSet": "LoRA Set (JSON) 🥒",
}
