// qrcode-generator 1.4.4 (MIT) is vendored locally. QR data never leaves the page.
window.tsTicketQr = {
    svg(payload) {
        if (typeof payload !== 'string' || !payload || payload.length > 512) throw Error('Ticket entry data is unavailable.');
        if (typeof qrcode !== 'function') throw Error('QR generation is unavailable. Refresh to try again.');
        const qr = qrcode(0, 'M');
        qr.addData(payload, 'Byte');
        qr.make();
        const count = qr.getModuleCount();
        const size = count + 8; // Four quiet modules on every edge.
        let path = '';
        for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) path += `M${col + 4},${row + 4}h1v1h-1z`;
        }
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Ticket entry QR code" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
    }
};
