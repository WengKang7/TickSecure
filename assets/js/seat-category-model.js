// Event categories refer to physical seat labels; the reusable venue never changes.
(function (root) {
    const colors = ['#9170ca', '#df9860', '#4c9b98', '#6f91cb', '#cf7f9b', '#8a9c60'];
    const list = categories => Array.isArray(categories) ? categories : Object.entries(categories || {}).map(([sectionId, c]) => ({ ...c, sectionId }));
    function seats(sections) {
        return (sections || []).flatMap(section => (section.geometry?.seatMarkers || []).map(marker => ({
            section, marker, label: `${section.sectionId || section.letter}-${marker.label}`
        }))).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }
    function labels(category, sections) {
        return Array.isArray(category.seatLabels) ? category.seatLabels : seats(sections)
            .filter(s => String(s.section.sectionId || s.section.letter) === category.sectionId)
            .sort((a, b) => a.label.localeCompare(b.label)).slice(0, Number(category.quantity)).map(s => s.label);
    }
    function validate(category, categories, sections, editingId) {
        if (!Array.isArray(category.seatLabels)) return '';
        const known = new Set(seats(sections).map(s => s.label));
        const chosen = category.seatLabels;
        if (!chosen.length || new Set(chosen).size !== chosen.length || chosen.some(label => !known.has(label))) return 'Choose valid numbered seats on this venue plan.';
        if (Number(category.quantity) !== chosen.length) return 'Ticket quantity must match the selected seats.';
        const used = new Set(list(categories).filter(c => c.sectionId !== editingId).flatMap(c => labels(c, sections)));
        if (chosen.some(label => used.has(label))) return 'Some seats already belong to another category. Edit that category or choose different seats.';
        return '';
    }
    function project(sections, categories) {
        const items = list(categories), assigned = new Map();
        items.forEach((category, i) => labels(category, sections).forEach(label => assigned.set(label, { ...category, color: category.color || colors[i % colors.length] })));
        return (sections || []).map(section => ({ ...section, geometry: section.geometry ? { ...section.geometry,
            seatMarkers: (section.geometry.seatMarkers || []).map(marker => {
                const category = assigned.get(`${section.sectionId || section.letter}-${marker.label}`);
                return { ...marker, categoryId: category?.sectionId || '', color: category?.color || '#e4e7ec', categoryName: category?.name || 'Off sale' };
            })
        } : undefined }));
    }
    const api = { colors, list, seats, labels, validate, project };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.tsSeatCategories = api;
})(typeof window !== 'undefined' ? window : globalThis);
