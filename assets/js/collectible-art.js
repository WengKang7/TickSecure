// Presentation only: ticket IDs select local artwork, never a wallet transaction.
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
        Object.freeze({ key: 'electric', name: 'Electric Horizons', file: 'electric-horizons-v1.png' })
    ]);
    function artwork(ticket) {
        let hash = 2166136261;
        for (const character of String(ticket.id || 'ticket')) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
        const art = artworks[hash % artworks.length];
        return { ...art, src: base + art.file };
    }
    function mintState(ticket) {
        const state = String(ticket.mintingStatus || '').toUpperCase();
        const minted = state === 'MINTED' && Boolean(ticket.transactionHash);
        return { minted, label: minted ? 'NFT minted' : state === 'FAILED' ? 'Mint needs attention' : state === 'MINTED' ? 'Mint not verified' : 'NFT not minted yet' };
    }
    return { artwork, mintState, artworks };
});
