/**
 * دوال تقسيم منحنيات بيزير إلى نقاط.
 */
export function getCubicPoints(s, c1, c2, e, numPoints = 50) {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const mt = 1 - t;
        points.push({
            x: mt**3 * s.x + 3 * mt**2 * t * c1.x + 3 * mt * t**2 * c2.x + t**3 * e.x,
            y: mt**3 * s.y + 3 * mt**2 * t * c1.y + 3 * mt * t**2 * c2.y + t**3 * e.y
        });
    }
    return points;
}

export function getQuadPoints(s, c, e, numPoints = 50) {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const mt = 1 - t;
        points.push({
            x: mt**2 * s.x + 2 * mt * t * c.x + t**2 * e.x,
            y: mt**2 * s.y + 2 * mt * t * c.y + t**2 * e.y
        });
    }
    return points;
}
