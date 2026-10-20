import math
import json

class MOSSLayoutGenerator:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "area": (["0.5 MP", "1.0 MP", "1.5 MP", "2.0 MP"], {"default": "1.0 MP"}),
                "aspect_ratio": (["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"], {"default": "1:1"}),
                # This string holds the internal editor state. It will be hidden by our JavaScript.
                "layout_data": ("STRING", {"default": "{}"}),
            }
        }

    RETURN_TYPES = ("INT", "INT", "STRING")
    RETURN_NAMES = ("WIDTH", "HEIGHT", "JSON_STRING")
    FUNCTION = "generate_layout"
    CATEGORY = "MOSS-Image"

    def generate_layout(self, area, aspect_ratio, layout_data):
        # 1. Calculate Dimensions (snapped to 16)
        area_map = {
            "0.5 MP": 512 * 512,
            "1.0 MP": 1024 * 1024,
            "1.5 MP": int(1024 * 1024 * 1.5),
            "2.0 MP": 1024 * 1024 * 2
        }
        target_pixels = area_map.get(area, 1024 * 1024)
        
        w_ratio, h_ratio = map(float, aspect_ratio.split(":"))
        r = w_ratio / h_ratio
        
        # H_raw = sqrt(Area / r), W_raw = H_raw * r
        H_raw = math.sqrt(target_pixels / r)
        H = int(round(H_raw / 16.0) * 16)
        W = int(round((H * r) / 16.0) * 16)

        # 2. Parse Layout Data
        try:
            data = json.loads(layout_data)
        except json.JSONDecodeError:
            data = {"summary": {"caption": "", "meta": "", "canvas": "single"}, "items": []}

        # 3. Format Summary
        summary = data.get("summary", {})
        meta_raw = summary.get("meta", "")
        meta_list = [m.strip() for m in meta_raw.split(",") if m.strip()] if isinstance(meta_raw, str) else meta_raw
        
        final_summary = {
            "meta": meta_list if meta_list else [],
            "canvas": summary.get("canvas", "single"),
            "caption": summary.get("caption", "")
        }

        # 4. Process Items (Convert normalized coords to abs_centralized)
        out_items = []
        for item in data.get("items", []):
            if "norm_bbox" not in item:
                continue
                
            # norm_bbox is [ymin, xmin, ymax, xmax] in 0.0 - 1.0 range
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

        # 5. Compile Final JSON
        final_json = {
            "summary": final_summary,
            "items": out_items,
            "bbox_coord_space": "abs_centralized",
            "bbox_format": "yxyx"
        }

        json_string = json.dumps(final_json, indent=2)
        return (W, H, json_string)