// Shared physical-section renderer used by the administrator and organizer views.
window.tsVenueRenderer = {
    getSectionPositions: function(count) {
        if (!Number.isInteger(count) || count < 1) return [];
        const columns = 2;
        const rows = Math.ceil(count / columns);
        const padding = 8;
        const topStart = 22;
        const availableHeight = 72;
        const height = Math.min(20, Math.floor(availableHeight / rows) - 4);
        const gap = Math.max(2, Math.floor((availableHeight - height * rows) / (rows + 1)));
        const width = (100 - padding * 2 - 4) / columns;
        return Array.from({ length: count }, (_, index) => ({
            left: index % columns === 0 ? padding : 100 - padding - width,
            top: topStart + Math.floor(index / columns) * (height + gap),
            width,
            height
        }));
    },
    renderBoard: function(containerId, sectionsArray, options = {}) {
        const container = document.getElementById(containerId);
        if (!container || !Array.isArray(sectionsArray)) return;
        container.replaceChildren();
        if (!sectionsArray.length) return;
        const stage = document.createElement('div');
        stage.className = 'ts-generated-stage';
        stage.textContent = 'STAGE';
        container.appendChild(stage);
        const positions = this.getSectionPositions(sectionsArray.length);
        sectionsArray.forEach((section, index) => {
            const interactive = typeof options.onSectionSelect === 'function';
            const sectionId = String(section.sectionId || section.letter || section.id || index);
            const box = document.createElement(interactive ? 'button' : 'div');
            box.className = 'ts-generated-section';
            const position = positions[index];
            box.style.cssText = `left:${position.left}%;top:${position.top}%;width:${position.width}%;height:${position.height}%;position:absolute;`;
            box.dataset.sectionId = sectionId;
            if (interactive) {
                box.type = 'button';
                box.setAttribute('aria-pressed', 'false');
                box.addEventListener('click', () => options.onSectionSelect(sectionId));
            }
            const content = document.createElement('div');
            content.className = 'ts-generated-section-content';
            const name = document.createElement('strong');
            name.textContent = section.name || 'Section ' + sectionId;
            const seats = document.createElement('span');
            seats.textContent = `${section.seatCount ?? section.seats ?? 0} seats`;
            content.append(name, seats);
            box.appendChild(content);
            container.appendChild(box);
        });
    }
};
