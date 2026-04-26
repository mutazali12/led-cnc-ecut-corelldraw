export function downloadDXF(text, widthCm, heightCm, holes, outlinesCm, holeRadiusMm) {
    if (holes.length === 0 && outlinesCm.length === 0) {
        alert('لا توجد بيانات للتصدير. يرجى تحديث المعاينة أولاً.');
        return;
    }
    const wMm = widthCm * 10;
    const hMm = heightCm * 10;
    const rMm = holeRadiusMm;
    let dxf = '0\r\nSECTION\r\n2\r\nHEADER\r\n9\r\n$INSUNITS\r\n70\r\n4\r\n0\r\nENDSEC\r\n';
    dxf += '0\r\nSECTION\r\n2\r\nENTITIES\r\n';
    // حدود اللوحة (POLYLINE)
    dxf += '0\r\nPOLYLINE\r\n8\r\nBoard_Outline\r\n66\r\n1\r\n70\r\n1\r\n';
    const boardPts = [[0,0], [wMm,0], [wMm,hMm], [0,hMm]];
    boardPts.forEach(([x,y]) => {
        dxf += `0\r\nVERTEX\r\n8\r\nBoard_Outline\r\n10\r\n${x}\r\n20\r\n${y}\r\n30\r\n0\r\n`;
    });
    dxf += '0\r\nSEQEND\r\n';
    // إطارات النص (مسارات القطع)
    outlinesCm.forEach(path => {
        if (path.length < 2) return;
        dxf += `0\r\nPOLYLINE\r\n8\r\nText_Outline\r\n66\r\n1\r\n70\r\n1\r\n`;
        path.forEach(p => {
            const x = p.x * 10;
            const y = hMm - (p.y * 10);
            dxf += `0\r\nVERTEX\r\n8\r\nText_Outline\r\n10\r\n${x.toFixed(3)}\r\n20\r\n${y.toFixed(3)}\r\n30\r\n0\r\n`;
        });
        dxf += '0\r\nSEQEND\r\n';
    });
    // الثقوب (دوائر)
    holes.forEach(h => {
        const x = h.x * 10;
        const y = hMm - (h.y * 10);
        dxf += `0\r\nCIRCLE\r\n8\r\nLED_Holes\r\n10\r\n${x.toFixed(3)}\r\n20\r\n${y.toFixed(3)}\r\n40\r\n${rMm}\r\n`;
    });
    dxf += '0\r\nENDSEC\r\n0\r\nEOF\r\n';
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (text || 'Sign').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
    a.download = `CNC_LED_${safeName}_${Date.now()}.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
