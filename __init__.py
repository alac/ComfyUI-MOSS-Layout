from .moss_layout_node import MOSSLayoutGenerator

NODE_CLASS_MAPPINGS = {
    "MOSSLayoutGenerator": MOSSLayoutGenerator
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MOSSLayoutGenerator": "MOSS-Image Layout Editor"
}

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]