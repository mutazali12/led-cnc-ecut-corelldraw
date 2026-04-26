import { getCubicPoints, getQuadPoints } from './utils.js';

let currentFont = null;
export function getFont() { return currentFont; }
export function setFont(font) { currentFont = font; }

/**
 * استخراج المسارات الخام من النص مع تحويل المنحنيات إلى نقاط.
 */
export function extractRawOutlines(text, fontSize) {
    if (!currentFont) return [];
    const path = currentFont.getPath(text, 0, 0, fontSize);
    const rawOutlines = [];
    let current = [];
    let pos = { x: 0, y: 0 };

    path.commands.forEach(cmd => {
        if (cmd.type === 'M') {
            if (current.length) rawOutlines.push(current);
            current = [{ x: cmd.x, y: cmd.y }];
            pos = { x: cmd.x, y: cmd.y };
        } else if (cmd.type === 'L') {
            current.push({ x: cmd.x, y: cmd.y });
            pos = { x: cmd.x, y: cmd.y };
        } else if (cmd.type === 'C') {
            const pts = getCubicPoints(pos, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }, { x: cmd.x, y: cmd.y }, 40);
            current.push(...pts.slice(1));
            pos = { x: cmd.x, y: cmd.y };
        } else if (cmd.type === 'Q') {
            const pts = getQuadPoints(pos, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x, y: cmd.y }, 40);
            current.push(...pts.slice(1));
            pos = { x: cmd.x, y: cmd.y };
        } else if (cmd.type === 'Z') {
            if (current.length && (current[0].x !== pos.x || current[0].y !== pos.y)) {
                current.push({ x: current[0].x, y: current[0].y });
            }
            rawOutlines.push(current);
            current = [];
        }
    });
    if (current.length) rawOutlines.push(current);
    return rawOutlines;
}

/**
 * تحويل المسارات الخام إلى إحداثيات بالسنتيمتر بعد تطبيق الإزاحة.
 */
export function outlinesToCm(rawOutlines, offsetX, offsetY, scale = 5) {
    return rawOutlines.map(cont =>
        cont.map(p => ({
            x: (p.x + offsetX) / scale,
            y: (p.y + offsetY) / scale
        }))
    );
}
