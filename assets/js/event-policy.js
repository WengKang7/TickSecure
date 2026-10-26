(() => {
    const money = value => 'RM' + Number(value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    function timestamp(value, end = false) {
        const raw = String(value || '').trim();
        if (!raw) return NaN;
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return Date.parse(raw + (end ? 'T23:59:59.999+08:00' : 'T00:00:00+08:00'));
        return Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw) ? raw + '+08:00' : raw);
    }
    function date(value, end = false) {
        const time = timestamp(value, end);
        return Number.isFinite(time) ? new Intl.DateTimeFormat('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
            hour12: true, timeZone: 'Asia/Kuala_Lumpur'
        }).format(time) : 'Not set';
    }
    function describe(event) {
        const limit = Number(event.maxTicketsPerBuyer ?? 4);
        const hasLimit = event.maxTicketsPerBuyer !== '' && Number.isInteger(limit) && limit > 0;
        const items = [{
            title: 'When you can buy tickets',
            text: `Sales open: ${date(event.salesStartDate)}. Sales close: ${date(event.salesEndDate, true)}. All times are Malaysia time (UTC+8).`
        }, {
            title: 'Tickets per buyer',
            text: hasLimit ? `You can hold up to ${limit} ticket${limit === 1 ? '' : 's'} for this event across all categories. Purchases, resale purchases, and tickets received by transfer count toward this limit.`
                : 'The organizer has not set the ticket limit yet.'
        }, {
            title: event.transferEnabled !== false ? 'Ticket transfers are allowed' : 'Ticket transfers are not allowed',
            text: event.transferEnabled !== false
                ? 'You can give a valid, unused ticket to another active, email-verified TickSecure buyer with a connected wallet. The recipient must be within the ticket limit. A ticket listed for resale must be removed from sale before it can be transferred.'
                : 'You cannot send your ticket to another buyer through TickSecure.'
        }];
        if (event.resaleEnabled !== true) {
            items.push({ title: 'Official resale is not allowed', text: 'You cannot list this event’s tickets for sale on the TickSecure resale marketplace.' });
        } else {
            items.push({ title: 'Official resale window', text: `You can list and buy resale tickets from ${date(event.resaleStartDate)} until ${date(event.resaleDeadline, true)} (Malaysia time, UTC+8). Only eligible, unused tickets can be listed by their current owner.` });
            const fixed = Number(event.maxResalePrice) || 0;
            const markup = Number(event.maxResaleMarkup ?? 0);
            const hasMarkup = event.maxResaleMarkup !== '' && Number.isFinite(markup) && markup >= 0;
            const categories = Array.isArray(event.categories) ? event.categories : Object.values(event.categories || {});
            const examples = categories.filter(category => Number(category.price) > 0).map(category => {
                const maximum = fixed > 0 ? fixed : Math.round(Number(category.price) * (1 + markup / 100) * 100) / 100;
                return `${category.name || 'Ticket'}: original ${money(category.price)}, maximum resale price ${money(maximum)}.`;
            });
            items.push({ title: 'Maximum resale price',
                text: fixed > 0 ? `The seller may ask up to ${money(fixed)} per ticket. This fixed cap replaces the percentage markup limit.`
                    : hasMarkup ? markup === 0 ? 'The seller cannot ask more than the original category ticket price (0% markup).'
                        : `The seller may ask up to ${markup}% above the original category ticket price.`
                        : 'The organizer has not set the resale price limit yet.',
                examples: fixed > 0 || hasMarkup ? examples : [],
                note: 'These limits apply to the ticket price. Any service charge is shown separately at checkout.'
            });
        }
        items.push({ title: 'Ticket validity', text: 'Used tickets cannot be transferred, listed for resale, or used for entry again. Transfers and resale are unavailable while the event is suspended or cancelled.' });
        return items;
    }
    function render(container, event) {
        if (!container) return;
        container.replaceChildren();
        describe(event).forEach(item => {
            const section = document.createElement('div');
            section.className = 'ts-policy-item';
            const heading = document.createElement('h3');
            heading.className = 'ts-list-title';
            heading.textContent = item.title;
            const text = document.createElement('p');
            text.className = 'small secondary mt-8';
            text.textContent = item.text;
            section.append(heading, text);
            if (item.examples?.length) {
                const list = document.createElement('ul');
                list.className = 'small secondary ts-policy-examples';
                item.examples.forEach(example => {
                    const entry = document.createElement('li');
                    entry.textContent = example;
                    list.appendChild(entry);
                });
                section.appendChild(list);
            }
            if (item.note) {
                const note = document.createElement('p');
                note.className = 'small secondary mt-8';
                note.textContent = item.note;
                section.appendChild(note);
            }
            container.appendChild(section);
        });
    }
    window.tsEventPolicy = { describe, render, timestamp, date };
})();
