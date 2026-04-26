import { initThree, updatePreview } from './three-preview.js';
import { getFont, setFont, extractRawOutlines, outlinesToCm } from './font-handler.js';
import { downloadDXF } from './dxf-export.js';

// عناصر DOM
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const textInput = document.getElementById('text-input');
const widthInput = document.getElementById('width-cm');
const heightInput = document.getElementById('height-cm');
const radiusInput = document.getElementById('hole-radius');
const spacingInput = document.getElementById('hole-spacing');
const edgeOffsetInput = document.getElementById('edge-offset');
const fontUpload = document.getElementById('font-upload');
const ledColorInput = document.getElementById('led-color');
const btnProcess = document.getElementById('btn-process');
const btnDownload = document.getElementById('btn-download-dxf');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percent');
const progressLabel = document.getElementById('progress-label');
const statusMessage = document.getElementById('status-message');
const holeCountSpan = document.getElementById('hole-count');
const procTimeSpan = document.getElementById('proc-time');

let computedHoles = [];
let textOutlinePathsCm = [];
const computationCache = new Map();

initThree('three-container', 'loader-3d');

function loadDefaultFont() {
    opentype.load('./fonts/arial.ttf', (err, f) => {
        if (err || !f) {
            statusMessage.textContent = '⚠️ يرجى رفع خط TTF/OTF';
        } else {
            setFont(f);
            statusMessage.textContent = '✅ الخط جاهز';
            processDesign();
        }
    });
}

fontUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            setFont(opentype.parse(ev.target.result));
            computationCache.clear();
            processDesign();
        } catch {
            alert('ملف الخط غير صالح.');
        }
    };
    reader.readAsArrayBuffer(file);
});

/**
 * توليد الثقوب بشبكة متعرجة 45 درجة (Staggered Grid)
 * كل صف فردي ينزاح نصف خطوة.
 */
function generateStaggeredHoles(maskCanvas, insetMaskCanvas, step, edgePx, scale) {
    const holes = [];
    const width = maskCanvas.width;
    const height = maskCanvas.height;
    const insetWidth = insetMaskCanvas.width;
    const insetHeight = insetMaskCanvas.height;
    const insetCtx = insetMaskCanvas.getContext('2d');
    const insetData = insetCtx.getImageData(0, 0, insetWidth, insetHeight).data;
    const isInsideInset = (ix, iy) => {
        if (ix < 0 || ix >= insetWidth || iy < 0 || iy >= insetHeight) return false;
        const idx = (iy * insetWidth + ix) * 4;
        return insetData[idx + 3] > 128;
    };
    const halfStep = step / 2;
    for (let y = step; y < height; y += step) {
        const rowOffset = (Math.floor(y / step) % 2 === 0) ? 0 : halfStep;
        for (let x = rowOffset; x < width; x += step) {
            const ix = Math.round(x - edgePx);
            const iy = Math.round(y - edgePx);
            if (isInsideInset(ix, iy)) {
                holes.push({
                    x: x / scale,
                    y: y / scale,
                    cx: x,
                    cy: y
                });
            }
        }
    }
    return holes;
}

async function processDesign() {
    const font = getFont();
    if (!font) {
        alert('يرجى تحميل خط أولاً.');
        return;
    }
    const start = performance.now();
    btnProcess.disabled = true;
    progressContainer.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressLabel.textContent = 'جاري المعالجة...';
    statusMessage.textContent = '⏳ جاري المعالجة...';
    const text = textInput.value.trim() || ' ';
    const wCm = parseFloat(widthInput.value) || 100;
    const hCm = parseFloat(heightInput.value) || 60;
    const holeRmm = parseFloat(radiusInput.value) || 3;
    const spaceMm = parseFloat(spacingInput.value) || 15;
    const edgeMm = parseFloat(edgeOffsetInput.value) || 4;

    const cacheKey = `${text}|${wCm}|${hCm}|${holeRmm}|${spaceMm}|${edgeMm}`;
    if (computationCache.has(cacheKey)) {
        const cached = computationCache.get(cacheKey);
        computedHoles = cached.holes;
        textOutlinePathsCm = cached.outlines;
        drawCanvas(textOutlinePathsCm, computedHoles, wCm, hCm, holeRmm);
        updatePreview(wCm, hCm, computedHoles, holeRmm, ledColorInput.value, textOutlinePathsCm);
        holeCountSpan.textContent = computedHoles.length.toLocaleString('ar-EG');
        procTimeSpan.textContent = cached.time + ' ث (مخزنة)';
        statusMessage.textContent = `✅ ${computedHoles.length} ثقب`;
        finish();
        return;
    }

    const scale = 5;
    const w = Math.round(wCm * scale);
    const h = Math.round(hCm * scale);
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);

    let fontSize = w / (text.length * 0.7);
    fontSize = Math.min(fontSize, h * 0.8);
    fontSize = Math.max(fontSize, 8);

    const pathTest = font.getPath(text, 0, 0, fontSize);
    const box = pathTest.getBoundingBox();
    const offX = w / 2 - (box.x1 + (box.x2 - box.x1) / 2);
    const offY = h / 2 - (box.y1 + (box.y2 - box.y1) / 2);

    const rawOutlines = extractRawOutlines(text, fontSize);
    textOutlinePathsCm = outlinesToCm(rawOutlines, offX, offY, scale);

    // رسم الإطارات (للمعاينة)
    ctx.save();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(1.5, scale * 0.6);
    textOutlinePathsCm.forEach(path => {
        if (path.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(path[0].x * scale, path[0].y * scale);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x * scale, path[i].y * scale);
        ctx.stroke();
    });
    ctx.restore();

    // القناع الكامل
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mctx = maskCanvas.getContext('2d');
    mctx.fillStyle = 'black';
    mctx.translate(offX, offY);
    const fillPath = font.getPath(text, 0, 0, fontSize);
    fillPath.fill = 'black';
    fillPath.draw(mctx);
    mctx.setTransform(1, 0, 0, 1, 0, 0);

    // القناع الداخلي (inset)
    const edgePx = edgeMm * scale / 10;
    const insetCanvas = document.createElement('canvas');
    insetCanvas.width = Math.max(1, w - 2 * edgePx);
    insetCanvas.height = Math.max(1, h - 2 * edgePx);
    const ictx = insetCanvas.getContext('2d');
    ictx.fillStyle = 'black';
    ictx.translate(offX - edgePx, offY - edgePx);
    fillPath.fill = 'black';
    fillPath.draw(ictx);
    ictx.setTransform(1, 0, 0, 1, 0, 0);

    const stepPx = Math.max(1, spaceMm * scale / 10);
    computedHoles = generateStaggeredHoles(maskCanvas, insetCanvas, stepPx, edgePx, scale);

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    if (computationCache.size > 20) computationCache.delete(computationCache.keys().next().value);
    computationCache.set(cacheKey, { holes: computedHoles, outlines: textOutlinePathsCm, time: elapsed });

    drawCanvas(textOutlinePathsCm, computedHoles, wCm, hCm, holeRmm);
    updatePreview(wCm, hCm, computedHoles, holeRmm, ledColorInput.value, textOutlinePathsCm);
    holeCountSpan.textContent = computedHoles.length.toLocaleString('ar-EG');
    procTimeSpan.textContent = elapsed + ' ث';
    statusMessage.textContent = `✅ ${computedHoles.length} ثقب | شبكة مائلة 45°`;
    finish();
}

function drawCanvas(outlinesCm, holes, wCm, hCm, holeRmm) {
    const scale = 5;
    canvas.width = wCm * scale;
    canvas.height = hCm * scale;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(1.5, scale * 0.6);
    outlinesCm.forEach(path => {
        if (path.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(path[0].x * scale, path[0].y * scale);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x * scale, path[i].y * scale);
        ctx.stroke();
    });
    ctx.restore();
    const r = holeRmm * scale / 10;
    const led = ledColorInput.value;
    holes.forEach(h => {
        ctx.beginPath();
        ctx.arc(h.cx, h.cy, r, 0, Math.PI * 2);
        ctx.fillStyle = led;
        ctx.fill();
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = Math.max(0.5, r * 0.25);
        ctx.stroke();
    });
}

function finish() {
    btnProcess.disabled = false;
    progressContainer.classList.add('hidden');
}

btnDownload.addEventListener('click', () => {
    const wCm = parseFloat(widthInput.value) || 100;
    const hCm = parseFloat(heightInput.value) || 60;
    const holeRmm = parseFloat(radiusInput.value) || 3;
    const text = textInput.value.trim() || 'Sign';
    downloadDXF(text, wCm, hCm, computedHoles, textOutlinePathsCm, holeRmm);
});

btnProcess.addEventListener('click', processDesign);

let debounceTimer;
[textInput, widthInput, heightInput, radiusInput, spacingInput, edgeOffsetInput, ledColorInput].forEach(el => {
    el.addEventListener('input', () => {
        computationCache.clear();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(processDesign, 500);
    });
    el.addEventListener('change', () => {
        computationCache.clear();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(processDesign, 300);
    });
});

window.addEventListener('load', loadDefaultFont);
