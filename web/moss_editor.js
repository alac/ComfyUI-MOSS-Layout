import { app } from "../../scripts/app.js";

const CSS = `
.moss-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(10,10,10,0.85); z-index: 9999; display: flex; font-family: sans-serif; color: #fff; }
.moss-canvas-area { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px; position: relative; }
.moss-sidebar { width: 380px; background: #222; border-left: 1px solid #444; padding: 20px; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; box-shadow: -5px 0 15px rgba(0,0,0,0.5); }
.moss-sidebar input, .moss-sidebar textarea, .moss-sidebar select { width: 100%; background: #111; color: #fff; border: 1px solid #555; padding: 8px; border-radius: 4px; box-sizing: border-box; }
.moss-sidebar textarea { resize: vertical; min-height: 80px; }
.moss-sidebar button { background: #333; color: white; border: 1px solid #555; padding: 8px 12px; cursor: pointer; border-radius: 4px; transition: 0.2s; }
.moss-sidebar button:hover { background: #444; }
.moss-btn-primary { background: #0066cc !important; border-color: #0055aa !important; }
.moss-btn-primary:hover { background: #0077ee !important; }
.moss-btn-success { background: #228b22 !important; border-color: #1e7a1e !important; }
.moss-btn-success:hover { background: #2ea82e !important; }
.moss-btn-danger { background: #cc2222 !important; border-color: #aa1111 !important; }
.moss-btn-danger:hover { background: #ee3333 !important; }
.moss-canvas { background: #111; border: 2px dashed #666; position: relative; box-shadow: 0 0 20px rgba(0,0,0,0.8); overflow: hidden; user-select: none; }

/* In idle mode, canvas uses default cursor. In drawing mode, it uses crosshair */
.moss-canvas { cursor: default; }
.moss-canvas.is-drawing-mode { cursor: crosshair; border-color: #ffaa00; }

/* Box Styles */
.moss-box { 
    position: absolute; border: 2px solid #00aaff; background: rgba(0, 170, 255, 0.2); 
    cursor: move; display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; 
    font-size: 12px; overflow: hidden; user-select: none; box-sizing: border-box; 
    padding: 6px; color: #fff; text-shadow: 1px 1px 2px #000;
}
.moss-box-selected { border-color: #ffaa00; background: rgba(255, 170, 0, 0.3); z-index: 10; }

/* The magic trick: disable clicks on existing boxes when we want to draw over them */
.is-drawing-mode .moss-box { pointer-events: none !important; }

.moss-hint { position: absolute; top: 20px; left: 20px; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 5px; pointer-events: none; }
.moss-hint-active { background: rgba(255, 170, 0, 0.9); color: #000; font-weight: bold; text-shadow: none; }

/* Floating Layer Selector HUD */
.moss-layer-panel {
    position: absolute; bottom: 20px; left: 20px;
    background: rgba(20,20,20,0.95);
    padding: 10px 15px; border-radius: 8px; border: 1px solid #444;
    display: flex; align-items: center; gap: 10px;
    z-index: 100; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
}
.moss-layer-panel label { font-weight: bold; font-size: 12px; color: #ccc; }
.moss-layer-panel select { background: #111; color: #fff; border: 1px solid #555; padding: 6px; border-radius: 4px; width: 350px; outline: none; }
.moss-layer-panel select:focus { border-color: #00aaff; }

hr { border: none; border-top: 1px solid #444; margin: 5px 0; }
`;

function openMossEditor(node, layoutWidget) {
    let state = { summary: { caption: "", meta: "", canvas: "single" }, items: [] };
    try {
        if (layoutWidget.value && layoutWidget.value !== "{}") {
            state = JSON.parse(layoutWidget.value);
        }
    } catch (e) { console.warn("MOSS-Image Layout Parse Error", e); }

    let selectedIndex = -1;
    let mode = "idle"; 
    let dragStart = null;
    let dragBoxInitial = null;

    const arWidget = node.widgets.find(w => w.name === "aspect_ratio");
    const [wRatio, hRatio] = (arWidget ? arWidget.value : "1:1").split(":").map(Number);
    const canvasRatio = wRatio / hRatio;

    const styleId = "moss-editor-style";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = CSS;
        document.head.appendChild(style);
    }

    const overlay = document.createElement("div");
    overlay.className = "moss-overlay";

    overlay.innerHTML = `
        <div class="moss-canvas-area">
            <div class="moss-hint" id="moss-hint">Select a region to edit, or click "+ Add New Region"</div>
            <div class="moss-canvas" id="moss-canvas"></div>
            
            <div class="moss-layer-panel">
                <label>Select Region:</label>
                <select id="moss-layer-select"></select>
            </div>
        </div>
        <div class="moss-sidebar" id="moss-sidebar">
            <button id="moss-btn-add" class="moss-btn-success" style="padding: 12px; font-weight: bold; font-size: 14px;">+ Add New Region</button>
            <hr/>
            <h3>Scene Summary</h3>
            <label>Caption (Global Prompt)</label>
            <textarea id="moss-summary-caption">${state.summary.caption || ""}</textarea>
            <label>Meta Tags (comma separated)</label>
            <input type="text" id="moss-summary-meta" value="${state.summary.meta || ""}" placeholder="e.g. poster, minimalist" />
            
            <hr/>
            <h3>Selected Region</h3>
            <div id="moss-item-props" style="display:none; flex-direction:column; gap:10px;">
                <label>Label</label>
                <select id="moss-item-label">
                    <option value="object">object</option>
                    <option value="text">text</option>
                    <option value="person">person</option>
                    <option value="background">background</option>
                </select>
                <label>Caption / Description</label>
                <textarea id="moss-item-caption"></textarea>
                <div id="moss-text-container" style="display:none; flex-direction:column; gap:5px;">
                    <label>Text Content</label>
                    <input type="text" id="moss-item-text" />
                </div>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button id="moss-btn-redraw" style="flex:1;">Redraw Box</button>
                    <button id="moss-btn-delete" class="moss-btn-danger" style="flex:1;">Delete</button>
                </div>
            </div>
            <div id="moss-no-selection" style="color:#aaa; font-style:italic;">No region selected.</div>
            
            <div style="flex:1;"></div>
            <hr/>
            <div style="display:flex; gap:10px;">
                <button id="moss-btn-cancel" style="flex:1;">Cancel</button>
                <button id="moss-btn-save" class="moss-btn-primary" style="flex:1;">Save Layout</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const canvas = document.getElementById("moss-canvas");
    const hintText = document.getElementById("moss-hint");
    const propsPanel = document.getElementById("moss-item-props");
    const noSelPanel = document.getElementById("moss-no-selection");
    const elLabel = document.getElementById("moss-item-label");
    const elCaption = document.getElementById("moss-item-caption");
    const textContainer = document.getElementById("moss-text-container");
    const elText = document.getElementById("moss-item-text");
    const layerSelect = document.getElementById("moss-layer-select");

    function resizeCanvas() {
        const areaRect = overlay.querySelector(".moss-canvas-area").getBoundingClientRect();
        const maxW = areaRect.width - 80;
        const maxH = areaRect.height - 80;
        let cW = maxW, cH = maxW / canvasRatio;
        if (cH > maxH) { cH = maxH; cW = maxH * canvasRatio; }
        canvas.style.width = cW + "px";
        canvas.style.height = cH + "px";
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function render() {
        canvas.innerHTML = "";
        
        // Manage canvas state classes and hints
        const isDrawing = mode.includes("drawing") || mode.includes("redrawing");
        if (isDrawing) {
            canvas.classList.add("is-drawing-mode");
        } else {
            canvas.classList.remove("is-drawing-mode");
        }

        if (mode === "drawing_standby" || mode === "drawing") {
            hintText.textContent = "Draw Mode: Click & Drag anywhere to draw a new region (Press ESC to cancel)";
            hintText.className = "moss-hint moss-hint-active";
        } else if (mode === "redrawing_standby" || mode === "redrawing") {
            hintText.textContent = "Redraw Mode: Click & Drag to replace selected region (Press ESC to cancel)";
            hintText.className = "moss-hint moss-hint-active";
        } else {
            hintText.textContent = "Select a region to edit, or click '+ Add New Region'";
            hintText.className = "moss-hint";
        }
        
        // Update Bottom-Left Dropdown Select Options
        layerSelect.innerHTML = "";
        layerSelect.appendChild(new Option("-- None Selected --", "-1"));
        
        // Draw boxes & populate dropdown
        state.items.forEach((item, index) => {
            // 1. Populate Dropdown list
            let desc = item.caption || item.text || `Region ${index + 1}`;
            if (desc.length > 90) desc = desc.substring(0, 90) + "...";
            layerSelect.appendChild(new Option(`[${item.label}] ${desc}`, index));

            // 2. Render Box on Canvas
            const box = document.createElement("div");
            box.className = "moss-box" + (index === selectedIndex ? " moss-box-selected" : "");
            const [ymin, xmin, ymax, xmax] = item.norm_bbox;
            box.style.left = (xmin * 100) + "%";
            box.style.top = (ymin * 100) + "%";
            box.style.width = ((xmax - xmin) * 100) + "%";
            box.style.height = ((ymax - ymin) * 100) + "%";
            
            // Format Box HTML to show details
            let boxHtml = `<div><strong>[${item.label}]</strong>`;
            if (item.text) boxHtml += ` <span style="color:#ffd700;">"${item.text}"</span>`;
            boxHtml += `</div>`;
            if (item.caption) {
                boxHtml += `<div style="font-weight:normal; margin-top:6px; font-size:11px; line-height:1.3; opacity: 0.9;">${item.caption}</div>`;
            }
            box.innerHTML = boxHtml;
            
            // Box Click/Drag
            box.addEventListener("mousedown", (e) => {
                if (mode.includes("standby") || mode.includes("drawing") || mode.includes("redrawing")) return;
                
                e.stopPropagation(); 
                mode = "dragging";
                selectedIndex = index;
                dragStart = { x: e.clientX, y: e.clientY };
                dragBoxInitial = [...item.norm_bbox];
                render();
            });
            canvas.appendChild(box);
        });

        // Sync Select Dropdown Value
        layerSelect.value = selectedIndex.toString();

        // Update Sidebar
        if (selectedIndex >= 0 && state.items[selectedIndex]) {
            propsPanel.style.display = "flex";
            noSelPanel.style.display = "none";
            const item = state.items[selectedIndex];
            elLabel.value = item.label || "object";
            elCaption.value = item.caption || "";
            if (item.label === "text") {
                textContainer.style.display = "flex";
                elText.value = item.text || "";
            } else {
                textContainer.style.display = "none";
            }
        } else {
            propsPanel.style.display = "none";
            noSelPanel.style.display = "block";
        }
    }

    // Dropdown change listener
    layerSelect.addEventListener("change", (e) => {
        selectedIndex = parseInt(e.target.value);
        if (mode === "drawing_standby" || mode === "redrawing_standby") {
            mode = "idle";
        }
        render();
    });

    // Sidebar Event Listeners
    document.getElementById("moss-btn-add").addEventListener("click", () => {
        mode = "drawing_standby";
        selectedIndex = -1;
        render();
    });

    elLabel.addEventListener("change", (e) => { state.items[selectedIndex].label = e.target.value; render(); });
    elCaption.addEventListener("input", (e) => { state.items[selectedIndex].caption = e.target.value; render(); });
    elText.addEventListener("input", (e) => { state.items[selectedIndex].text = e.target.value; render(); });

    document.getElementById("moss-btn-delete").addEventListener("click", () => {
        state.items.splice(selectedIndex, 1);
        selectedIndex = -1;
        render();
    });

    document.getElementById("moss-btn-redraw").addEventListener("click", () => {
        mode = "redrawing_standby";
        render();
    });

    // Canvas Interactions (Drawing / Dragging)
    let tempBox = null;
    
    canvas.addEventListener("mousedown", (e) => {
        if (mode === "dragging") return;
        
        // Start a draw ONLY if we clicked "Add New" or "Redraw"
        if (mode === "drawing_standby" || mode === "redrawing_standby") {
            const rect = canvas.getBoundingClientRect();
            dragStart = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
            
            if (mode === "drawing_standby") mode = "drawing";
            if (mode === "redrawing_standby") mode = "redrawing";
            
            tempBox = document.createElement("div");
            tempBox.className = "moss-box moss-box-selected";
            tempBox.style.pointerEvents = "none"; // Make sure it doesn't intercept mouseup
            canvas.appendChild(tempBox);
        } else if (mode === "idle") {
            // Clicking empty canvas in idle mode simply deselects
            selectedIndex = -1;
            render();
        }
    });

    window.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        if ((mode === "drawing" || mode === "redrawing") && tempBox) {
            let currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            let currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            
            let xmin = Math.min(dragStart.x, currentX);
            let xmax = Math.max(dragStart.x, currentX);
            let ymin = Math.min(dragStart.y, currentY);
            let ymax = Math.max(dragStart.y, currentY);
            
            tempBox.style.left = (xmin * 100) + "%";
            tempBox.style.top = (ymin * 100) + "%";
            tempBox.style.width = ((xmax - xmin) * 100) + "%";
            tempBox.style.height = ((ymax - ymin) * 100) + "%";
        }
        else if (mode === "dragging" && selectedIndex >= 0) {
            let dx = (e.clientX - dragStart.x) / rect.width;
            let dy = (e.clientY - dragStart.y) / rect.height;
            let [ymin, xmin, ymax, xmax] = dragBoxInitial;
            
            if (xmin + dx < 0) dx = -xmin;
            if (xmax + dx > 1) dx = 1 - xmax;
            if (ymin + dy < 0) dy = -ymin;
            if (ymax + dy > 1) dy = 1 - ymax;
            
            state.items[selectedIndex].norm_bbox = [ymin + dy, xmin + dx, ymax + dy, xmax + dx];
            render();
        }
    });

    window.addEventListener("mouseup", (e) => {
        if (mode === "drawing" || mode === "redrawing") {
            const rect = canvas.getBoundingClientRect();
            let endX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            let endY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            
            let xmin = Math.min(dragStart.x, endX);
            let xmax = Math.max(dragStart.x, endX);
            let ymin = Math.min(dragStart.y, endY);
            let ymax = Math.max(dragStart.y, endY);

            if (xmax - xmin > 0.02 && ymax - ymin > 0.02) {
                if (mode === "drawing") {
                    state.items.push({ label: "object", caption: "", norm_bbox: [ymin, xmin, ymax, xmax] });
                    selectedIndex = state.items.length - 1;
                    setTimeout(() => document.getElementById("moss-item-caption").focus(), 50);
                } else if (mode === "redrawing") {
                    state.items[selectedIndex].norm_bbox = [ymin, xmin, ymax, xmax];
                }
            }
            if (tempBox) tempBox.remove();
            tempBox = null;
        }
        
        mode = "idle";
        dragStart = null;
        render();
    });

    // Handle Escape Key to Cancel Drawing
    const onKeyDown = (e) => {
        if (e.key === "Escape") {
            if (mode !== "idle") {
                mode = "idle";
                if (tempBox) { tempBox.remove(); tempBox = null; }
                render();
            } else if (selectedIndex >= 0) {
                selectedIndex = -1;
                render();
            }
        }
    };
    window.addEventListener("keydown", onKeyDown);

    function cleanup() {
        window.removeEventListener("resize", resizeCanvas);
        window.removeEventListener("keydown", onKeyDown);
        overlay.remove();
    }

    document.getElementById("moss-btn-cancel").addEventListener("click", cleanup);

    document.getElementById("moss-btn-save").addEventListener("click", () => {
        state.summary.caption = document.getElementById("moss-summary-caption").value;
        state.summary.meta = document.getElementById("moss-summary-meta").value;
        layoutWidget.value = JSON.stringify(state);
        cleanup();
    });

    render();
}

app.registerExtension({
    name: "MOSS.LayoutEditor",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "MOSSLayoutGenerator") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);

                const layoutWidget = this.widgets.find(w => w.name === "layout_data");
                if (layoutWidget) {
                    layoutWidget.type = "hidden";
                    layoutWidget.computeSize = () => [0, -4];
                    if (layoutWidget.inputEl) {
                        layoutWidget.inputEl.style.display = "none";
                    }
                }

                this.addWidget("button", "Edit Layout", "Edit", () => {
                    openMossEditor(this, layoutWidget);
                });

                requestAnimationFrame(() => {
                    const sz = this.computeSize();
                    this.setSize([Math.max(this.size[0], sz[0]), sz[1]]);
                });
            };
        }
    }
});