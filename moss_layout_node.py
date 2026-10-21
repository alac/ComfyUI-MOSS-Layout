import math
import json
import os
import sys
import subprocess
import server
from aiohttp import web

# Create presets directory relative to this python file
PRESETS_DIR = os.path.join(os.path.dirname(__file__), "presets")
os.makedirs(PRESETS_DIR, exist_ok=True)

# -------------------------------------------------------------
# BACKEND API ROUTES FOR PRESET MANAGEMENT
# -------------------------------------------------------------
@server.PromptServer.instance.routes.get("/moss/list_presets")
async def list_presets(request):
    files = [f for f in os.listdir(PRESETS_DIR) if f.endswith('.json')]
    return web.json_response(files)

@server.PromptServer.instance.routes.get("/moss/get_preset")
async def get_preset(request):
    name = request.rel_url.query.get("name", "")
    name = "".join(c for c in name if c.isalnum() or c in " ._-") # Sanitize
    path = os.path.join(PRESETS_DIR, name)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return web.json_response(json.load(f))
    return web.Response(status=404)

@server.PromptServer.instance.routes.post("/moss/save_preset")
async def save_preset(request):
    data = await request.json()
    name = data.get("name", "")
    overwrite = data.get("overwrite", False)
    content = data.get("data", {})
    
    name = "".join(c for c in name if c.isalnum() or c in " ._-") # Sanitize
    if not name.endswith(".json"):
        name += ".json"
        
    path = os.path.join(PRESETS_DIR, name)
    if os.path.exists(path) and not overwrite:
        return web.json_response({"error": "exists", "message": f"{name} already exists."})
        
    with open(path, "w", encoding="utf-8") as f:
        json.dump(content, f, indent=2)
    return web.json_response({"success": True, "name": name})

@server.PromptServer.instance.routes.post("/moss/open_presets_folder")
async def open_folder(request):
    try:
        if sys.platform == "win32":
            os.startfile(PRESETS_DIR)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", PRESETS_DIR])
        else:
            subprocess.Popen(["xdg-open", PRESETS_DIR])
        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"success": False, "path": PRESETS_DIR, "error": str(e)})


# -------------------------------------------------------------
# NODE DEFINITION
# -------------------------------------------------------------
def get_preset_list():
    if not os.path.exists(PRESETS_DIR):
        return ["Custom"]
    files = [f for f in os.listdir(PRESETS_DIR) if f.endswith('.json')]
    return ["Custom"] + sorted(files)

class MOSSLayoutGenerator:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "area": (["0.5 MP", "1.0 MP", "1.5 MP", "2.0 MP"], {"default": "1.0 MP"}),
                "aspect_ratio": (["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"], {"default": "1:1"}),
                "preset": (get_preset_list(),),
                # Hidden internal state tracking (now starts with version 1)
                "layout_data": ("STRING", {"default": '{"version": 1, "summary": {}, "items": []}'}),
            }
        }

    RETURN_TYPES = ("INT", "INT", "STRING")
    RETURN_NAMES = ("WIDTH", "HEIGHT", "JSON_STRING")
    FUNCTION = "generate_layout"
    CATEGORY = "MOSS-Image"

    def generate_layout(self, area, aspect_ratio, preset, layout_data):
        area_map = {
            "0.5 MP": 512 * 512,
            "1.0 MP": 1024 * 1024,
            "1.5 MP": int(1024 * 1024 * 1.5),
            "2.0 MP": 1024 * 1024 * 2
        }
        target_pixels = area_map.get(area, 1024 * 1024)
        w_ratio, h_ratio = map(float, aspect_ratio.split(":"))
        r = w_ratio / h_ratio
        
        H_raw = math.sqrt(target_pixels / r)
        H = int(round(H_raw / 16.0) * 16)
        W = int(round((H * r) / 16.0) * 16)

        try:
            data = json.loads(layout_data)
        except json.JSONDecodeError:
            data = {"summary": {"caption": "", "meta": "", "canvas": "single"}, "items": []}

        summary = data.get("summary", {})
        meta_raw = summary.get("meta", "")
        meta_list = [m.strip() for m in meta_raw.split(",") if m.strip()] if isinstance(meta_raw, str) else meta_raw
        
        final_summary = {
            "meta": meta_list if meta_list else [],
            "canvas": summary.get("canvas", "single"),
            "caption": summary.get("caption", "")
        }

        out_items = []
        for item in data.get("items", []):
            if "norm_bbox" not in item:
                continue
                
            ymin, xmin, ymax, xmax = item["norm_bbox"]
            abs_xmin = int(round(xmin * W - W / 2))
            abs_xmax = int(round(xmax * W - W / 2))
            abs_ymin = int(round(ymin * H - H / 2))
            abs_ymax = int(round(ymax * H - H / 2))
            
            new_item = {
                "label": item.get("label", "object"),
                "caption": item.get("caption", ""),
                "bbox": [abs_ymin, abs_xmin, abs_ymax, abs_xmax] # yxyx
            }
            if new_item["label"] == "text" and "text" in item:
                new_item["text"] = item["text"]
                
            out_items.append(new_item)

        final_json = {
            "summary": final_summary,
            "items": out_items,
            "bbox_coord_space": "abs_centralized",
            "bbox_format": "yxyx"
        }

        json_string = json.dumps(final_json, indent=2)
        return (W, H, json_string)