// Website collection artwork is selected by the event organizer per category.
(function (root, factory) {
    const base = typeof document !== 'undefined' && document.currentScript?.src
        ? new URL('../images/collectibles/', document.currentScript.src).href : '../assets/images/collectibles/';
    const api = factory(base);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.tsCollectibleArt = api;
})(typeof window !== 'undefined' ? window : globalThis, function (base) {
    const artworks = Object.freeze([
        Object.freeze({ key: 'cosmic', name: 'Cosmic Encore', file: 'cosmic-encore-v1.png' }),
        Object.freeze({ key: 'tropical', name: 'Tropical Frequency', file: 'tropical-frequency-v1.png' }),
        Object.freeze({ key: 'electric', name: 'Electric Horizons', file: 'electric-horizons-v1.png' }),
        Object.freeze({ key: 'gemini-01', name: 'Gemini Artwork 01', file: 'gemini-artwork-01.jpg' }),
        Object.freeze({ key: 'gemini-02', name: 'Gemini Artwork 02', file: 'gemini-artwork-02.jpg' }),
        Object.freeze({ key: 'gemini-03', name: 'Gemini Artwork 03', file: 'gemini-artwork-03.jpg' }),
        Object.freeze({ key: 'gemini-04', name: 'Gemini Artwork 04', file: 'gemini-artwork-04.jpg' }),
        Object.freeze({ key: 'gemini-05', name: 'Gemini Artwork 05', file: 'gemini-artwork-05.jpg' }),
        Object.freeze({ key: 'gemini-06', name: 'Gemini Artwork 06', file: 'gemini-artwork-06.jpg' }),
        Object.freeze({ key: 'gemini-07', name: 'Gemini Artwork 07', file: 'gemini-artwork-07.jpg' }),
        Object.freeze({ key: 'gemini-08', name: 'Gemini Artwork 08', file: 'gemini-artwork-08.jpg' }),
        Object.freeze({ key: 'gemini-09', name: 'Gemini Artwork 09', file: 'gemini-artwork-09.jpg' })
    ]);
    function artwork(ticket) {
        const categories = ticket._event?.categories || {};
        const entries = Array.isArray(categories) ? categories.map(item => [item.sectionId, item]) : Object.entries(categories);
        const category = entries.find(([id, item]) => ticket.sectionId && (id === ticket.sectionId || item.sectionId === ticket.sectionId))?.[1]
            || entries.find(([, item]) => item.name === ticket.categoryName)?.[1];
        const saved = category?.nftArtwork || {};
        const border = ['gold','silver','bronze','black'].includes(saved.border) ? saved.border : 'black';
        let src = '';
        try {
            const url = /^[a-z][a-z0-9+.-]*:/i.test(saved.imageUrl || '')
                ? new URL(saved.imageUrl) : new URL(saved.imageUrl, base);
            if (saved.imageUrl && ['http:', 'https:'].includes(url.protocol)) src = url.href;
        } catch (_) { /* Categories without an image use a plain title cover. */ }
        return { key: border, name: src ? 'Organizer collection' : 'Artwork not assigned', src };
    }
    function mintState(ticket) {
        const state = String(ticket.mintingStatus || '').toUpperCase();
        const minted = state === 'MINTED' && Boolean(ticket.transactionHash);
        return { minted, label: minted ? 'NFT minted' : state === 'FAILED' ? 'Mint needs attention' : state === 'MINTED' ? 'Mint not verified' : 'NFT not minted yet' };
    }
    return { artwork, mintState, artworks, gallery: () => artworks.map(item => ({ ...item, src: base + item.file })) };
});
