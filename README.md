# ComfyUI-MOSS-Layout

A custom ComfyUI node for generating structured layout prompts for the MOSS-Image model. 

Instead of manually calculating pixel coordinates relative to the image center, this node provides a visual canvas editor to draw, position, and annotate regions. The editor tracks bounding boxes in normalized space and converts them at execution time into MOSS-Image's `abs_centralized` `[ymin, xmin, ymax, xmax]` pixel coordinate format.

---

## What It Does

1. **Calculates Image Dimensions:** Takes a target area (e.g., 1.0 MP, 1.5 MP) and aspect ratio (e.g., 1:1, 16:9), computes the resulting width and height, and snaps both values to the nearest multiple of 16 (for patch size compatibility).
2. **Visual Layout Authoring:** Opens a pop-out modal with an interactive canvas framed to the node's selected aspect ratio. You draw bounding boxes and assign them categories, captions, and rendered text.
3. **MOSS-Image JSON Formatting:** Outputs an execution-ready JSON string matching the specification required by MOSS-Image layout mode, alongside integer `WIDTH` and `HEIGHT` outputs for latent setup.

---

## Features

* **Visual Canvas Editor:** A modal interface with a canvas matched to the selected aspect ratio.
* **MOSS-Image Coordinate Conversion:** Automatically converts top-left normalized coordinates (`0.0`–`1.0`) into centered pixel coordinates (`-W/2` to `+W/2` and `-H/2` to `+H/2`) in `yxyx` order.
* **Resolution Independence:** Changing the Area or Aspect Ratio on the node updates the downstream pixel coordinates at execution time without requiring you to redraw regions.
* **Explicit Drawing Modes:** Includes an **Add New Region** button that disables selection/dragging on existing boxes, allowing you to draw new boxes directly over crowded areas.
* **Region Redrawing:** A **Redraw Box** option that lets you re-draw an existing box's boundaries while keeping its existing caption, label, and text content.
* **Layer/Region Dropdown:** A selector at the bottom-left of the canvas listing all existing regions (truncated to ~90 characters) to make selecting overlapping or buried boxes straightforward.
* **Canvas Box Annotations:** Bounding boxes display their category label, text string (if applicable), and description directly on the canvas.
* **Standard MOSS Schema Support:**
  * Scene-level `caption` and `meta` tags.
  * Item-level `label` (`object`, `text`, `person`, `background`).
  * Item-level `caption` (prompt description).
  * Item-level `text` field (active when `label == "text"`).

---

## Node Terminals

### Inputs
* **`area`**: Target pixel area (`0.5 MP`, `1.0 MP`, `1.5 MP`, `2.0 MP`).
* **`aspect_ratio`**: Desired ratio (`1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9`).
* **`layout_data`**: Hidden internal string holding the serialized normalized editor state.

### Outputs
* **`WIDTH`** (`INT`): Calculated pixel width (multiple of 16).
* **`HEIGHT`** (`INT`): Calculated pixel height (multiple of 16).
* **`JSON_STRING`** (`STRING`): Formatted MOSS-Image layout JSON.

---

## Output JSON Structure Example

```json
{
  "summary": {
    "meta": ["poster"],
    "canvas": "single",
    "caption": "A minimalist travel poster with a blue mountain and header text."
  },
  "items": [
    {
      "label": "text",
      "caption": "Large title centered at the top.",
      "bbox": [-416, -384, -288, 384],
      "text": "EXPLORE"
    },
    {
      "label": "object",
      "caption": "A flat blue mountain illustration in the center.",
      "bbox": [-192, -288, 384, 288]
    }
  ],
  "bbox_coord_space": "abs_centralized",
  "bbox_format": "yxyx"
}
```

---

## Installation

Clone or copy the directory into your ComfyUI installation:

```bash
cd ComfyUI/custom_nodes/
git clone <repo-url> ComfyUI-MOSS-Layout
```

Restart ComfyUI and find the node under the **`MOSS-Image`** category.