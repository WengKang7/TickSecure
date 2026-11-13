(() => {
    window.tsNftCategoryEditor = options => {
        const el = id => document.getElementById(id);
        let imageUrl = '', revision = 0;
        const dialog = el('nft-gallery-dialog');
        el('nft-gallery-close').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const rect = dialog.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
        });
        const status = text => { el('nft-art-status').textContent = text; };
        function preview() {
            el('nft-preview').dataset.border = el('nft-border').value;
            el('nft-preview-image').hidden = !imageUrl;
            el('nft-preview-image').src = imageUrl || '';
            el('nft-preview-name').textContent = el('catName').value || 'Ticket category';
            el('nft-preview-event').textContent = options.event.name || 'Event artwork';
        }
        function edit(value = {}) {
            revision++;
            if (dialog.open) dialog.close();
            imageUrl = value.imageUrl || '';
            el('nft-border').value = ['gold','silver','bronze','black'].includes(value.border) ? value.border : 'black';
            el('nft-photo').value = '';
            el('nft-suggestions').replaceChildren();
            status(''); preview();
        }
        async function run(task) {
            if (options.isBusy()) return;
            options.lock(true);
            const controls = [...el('category-artwork-editor').querySelectorAll('input,select,button')];
            controls.forEach(control => { control.disabled = true; });
            try { await task(); }
            catch (error) { status(error.message || 'Artwork could not be updated.'); }
            finally { controls.forEach(control => { control.disabled = false; }); options.lock(false); }
        }
        el('nft-photo').addEventListener('change', () => run(async () => {
            const file = el('nft-photo').files[0];
            if (!file) return;
            if (!['image/jpeg','image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) throw Error('Choose a JPG or PNG up to 5 MB.');
            const current = revision;
            const { uploadLocalPoster } = await import('./poster-upload.js');
            const uploaded = await uploadLocalPoster(options.event.id, file, status, 'category-artwork');
            if (current !== revision) return;
            imageUrl = uploaded; preview(); options.changed(); status('Photo uploaded. Add or update this category, then save.');
        }));
        el('nft-border').addEventListener('change', () => { preview(); options.changed(); });
        el('catName').addEventListener('input', preview);
        el('nft-use-poster').addEventListener('click', () => {
            if (options.isBusy()) return;
            if (!options.event.posterUrl) { status('Upload an event photo in Event Details first.'); return; }
            imageUrl = options.event.posterUrl; preview(); options.changed(); status('');
        });
        el('nft-clear').addEventListener('click', () => {
            if (options.isBusy()) return;
            imageUrl = ''; el('nft-photo').value = ''; preview(); options.changed(); status('');
        });
        el('nft-suggest').addEventListener('click', () => {
            if (options.isBusy()) return;
            const gallery = window.tsCollectibleArt?.gallery() || [];
            const container = el('nft-suggestions');
            container.replaceChildren();
            for (const item of gallery) {
                const button = document.createElement('button');
                button.type = 'button'; button.className = 'ts-nft-image-choice';
                button.setAttribute('aria-label', 'Choose ' + item.name);
                button.setAttribute('aria-pressed', String(imageUrl === item.src));
                const image = document.createElement('img');
                image.src = item.src; image.alt = item.name; image.loading = 'lazy'; image.decoding = 'async';
                const caption = document.createElement('span');
                caption.textContent = item.name;
                button.append(image, caption);
                button.addEventListener('click', () => {
                    if (options.isBusy()) return;
                    imageUrl = item.src;
                    el('nft-photo').value = '';
                    preview(); options.changed();
                    container.querySelectorAll('button').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
                    dialog.close();
                    status('Artwork selected. Add or update the category, then save.');
                });
                container.append(button);
            }
            if (gallery.length) { status(''); dialog.showModal(); }
            else status('The artwork gallery could not load. Refresh the page.');
        });
        edit();
        return {edit, value: () => ({imageUrl, border: el('nft-border').value})};
    };
})();
