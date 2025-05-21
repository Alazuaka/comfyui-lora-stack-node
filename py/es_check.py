from nodes import CheckpointLoaderSimple
from folder_paths import get_filename_list

class EsCheckpointSet(CheckpointLoaderSimple):
    @classmethod
    def INPUT_TYPES(cls):
        ckpts = get_filename_list("checkpoints")
        return {
            "required": {
                "ckpt_name": (["none", *ckpts],),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "VAE")
    FUNCTION = "load_checkpoint"
    CATEGORY = "alazuka"

    def load_checkpoint(self, ckpt_name):
        if not ckpt_name or ckpt_name == "none" or ckpt_name.startswith("──"):
            raise Exception("Please select a valid checkpoint")
        return super().load_checkpoint(ckpt_name)

NODE_CLASS_MAPPINGS = {
    "EsCheckpointSet": EsCheckpointSet,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "EsCheckpointSet": "Checkpoint Set (Grouped) 🥒",
}
