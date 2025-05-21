import os
import sys
import glob
import importlib.util

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

def log(msg):
    print(f"[alazuka] {msg}")

def get_ext_dir(*parts):
    return os.path.abspath(os.path.join(os.path.dirname(__file__), *parts))

def init():
    log("Initializing alazuka...")

    py_path = get_ext_dir("py")
    for file in glob.glob(os.path.join(py_path, "*.py")):
        name = os.path.splitext(os.path.basename(file))[0]
        spec = importlib.util.spec_from_file_location(name, file)
        mod = importlib.util.module_from_spec(spec)
        sys.modules[name] = mod
        spec.loader.exec_module(mod)

        if hasattr(mod, "NODE_CLASS_MAPPINGS"):
            NODE_CLASS_MAPPINGS.update(mod.NODE_CLASS_MAPPINGS)
        if hasattr(mod, "NODE_DISPLAY_NAME_MAPPINGS"):
            NODE_DISPLAY_NAME_MAPPINGS.update(mod.NODE_DISPLAY_NAME_MAPPINGS)

    log(f"Loaded {len(NODE_CLASS_MAPPINGS)} nodes.")

init()

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
