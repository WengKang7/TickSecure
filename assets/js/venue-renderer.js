window.tsVenueRenderer = {
    renderBoard: function(containerId, sectionsArray) {
        const container = document.getElementById(containerId);
        if (!container || !sectionsArray || !sectionsArray.length) return;
        
        container.innerHTML = '';
        
        const stage = document.createElement('div');
        stage.className = 'ts-generated-stage';
        stage.textContent = 'STAGE';
        container.appendChild(stage);

        const n = sectionsArray.length;
        const cols = 2;
        const rows = Math.ceil(n / cols);
        const padX = 8;
        const topStart = 22;
        const availH = 72;
        const rowH = Math.min(20, Math.floor(availH / rows) - 4);
        const gapY = Math.max(2, Math.floor((availH - rowH * rows) / (rows + 1)));
        const boxW = (100 - padX * 2 - 4) / cols;

        sectionsArray.forEach((s, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const top = topStart + row * (rowH + gapY);
            const left = col === 0 ? padX : (100 - padX - boxW);
            
            const div = document.createElement('div');
            div.className = 'ts-generated-section';
            div.style.cssText = `left:${left}%;top:${top}%;width:${boxW}%;height:${rowH}%;position:absolute;`;
            div.innerHTML = `
                <div class="ts-generated-section-content">
                    <strong>${s.name}</strong>
                    <span>${s.seatCount || s.seats || 0} seats</span>
                </div>
            `;
            container.appendChild(div);
        });
    }
};

