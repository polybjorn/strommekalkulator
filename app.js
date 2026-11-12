let services = [];
const state = {};
const openTiers = new Set();
const sportFilter = new Set();

// White initials on a light brand colour fall under 4.5:1, so those get dark text.
function initialsColor(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const lum = [0, 2, 4]
    .map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  return 1.05 / (l + 0.05) >= 4.5 ? '#fff' : '#1d1d1f';
}

const SPORT_GROUPS = [
  { label: 'Fotball', sports: [
    { id: 'bundesliga', label: 'Bundesliga' },
    { id: 'carabao-cup', label: 'Carabao Cup' },
    { id: 'champions-league', label: 'Champions League' },
    { id: 'conference-league', label: 'Conference League' },
    { id: 'efl-championship', label: 'EFL Championship' },
    { id: 'eliteserien', label: 'Eliteserien' },
    { id: 'europa-league', label: 'Europa League' },
    { id: 'fa-cup', label: 'FA Cup' },
    { id: 'nm-cup', label: 'Fotball-NM' },
    { id: 'fotball-vm', label: 'Fotball-VM' },
    { id: 'la-liga', label: 'La Liga' },
    { id: 'ligue-1', label: 'Ligue 1' },
    { id: 'nations-league', label: 'Nations League' },
    { id: 'obos-ligaen', label: 'OBOS-ligaen' },
    { id: 'premier-league', label: 'Premier League' },
    { id: 'toppserien', label: 'Toppserien' }
  ]},
  { label: 'Motor', sports: [
    { id: 'formel-1', label: 'Formel 1' },
    { id: 'indycar', label: 'IndyCar' }
  ]},
  { label: 'Vintersport', sports: [
    { id: 'alpint', label: 'Alpint' },
    { id: 'hopp', label: 'Hopp' },
    { id: 'ishockey', label: 'Ishockey' },
    { id: 'langrenn', label: 'Langrenn' },
    { id: 'skiskyting', label: 'Skiskyting' }
  ]},
  { label: 'Kampsport', sports: [
    { id: 'ufc', label: 'UFC' }
  ]},
  { label: 'Andre', sports: [
    { id: 'basket', label: 'Basket' },
    { id: 'golf', label: 'Golf' },
    { id: 'haandball', label: 'Håndball' },
    { id: 'innebandy', label: 'Innebandy' },
    { id: 'ol', label: 'OL' },
    { id: 'sjakk', label: 'Sjakk' },
    { id: 'sykling', label: 'Sykling' },
    { id: 'tennis', label: 'Tennis' },
    { id: 'volleyball', label: 'Volleyball' }
  ]}
];

const SPORT_LABELS = (() => {
  const m = {};
  for (const g of SPORT_GROUPS) for (const s of g.sports) m[s.id] = s.label;
  return m;
})();

const MONTH_NAMES = ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'];

let EUR_TO_NOK = 11.70;
let EUR_RATE_UPDATED = '';
fetch('exchange-rate.json', { cache: 'no-cache' })
  .then(r => r.ok ? r.json() : null)
  .then(data => {
    if (data && typeof data.eur_nok === 'number' && data.eur_nok > 0) {
      EUR_TO_NOK = data.eur_nok;
      EUR_RATE_UPDATED = data.updated || '';
      if (services.length) { render(); }
    }
  })
  .catch(() => {});

function toNok(value, currency) {
  if (!currency || currency === 'NOK') return value;
  if (currency === 'EUR') return Math.round(value * EUR_TO_NOK);
  return value;
}

function fmtPrice(value, currency) {
  if (currency === 'EUR') {
    if (Math.abs(value - Math.round(value)) < 0.005) return `${Math.round(value)} €`;
    return `${value.toFixed(2).replace('.', ',')} €`;
  }
  return `${value} kr`;
}

function fmtMonthlyEquiv(yearlyPrice, currency) {
  if (currency === 'EUR') return fmtPrice(Math.round((yearlyPrice / 12) * 100) / 100, 'EUR');
  return `${Math.round(yearlyPrice / 12)} kr`;
}

function fmtEurRate() {
  return `€1 = ${EUR_TO_NOK.toFixed(2).replace('.', ',')} kr${EUR_RATE_UPDATED ? ` (oppdatert ${EUR_RATE_UPDATED})` : ''}`;
}

function populateEurRateTargets(root) {
  (root || document).querySelectorAll('[data-eur-rate]').forEach(el => {
    el.textContent = fmtEurRate();
  });
}

fetch('data.json')
  .then(r => r.json())
  .then(data => {
    const today = new Date().toISOString().slice(0, 10);
    function processPriceFrom(tiers) {
      for (const t of tiers) {
        if (t.priceFrom) {
          if (today >= t.priceFrom.date) {
            t.price = t.priceFrom.price;
            delete t.priceFrom;
          } else {
            const d = new Date(t.priceFrom.date);
            const dateStr = `${d.getDate()}. ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
            if (t.info) t.info = t.info.replace('</ul>', `<li class="notice">Ny pris fra ${dateStr}: ${t.priceFrom.price} kr/mnd</li></ul>`);
            else t.info = `<ul><li class="notice">Ny pris fra ${dateStr}: ${t.priceFrom.price} kr/mnd</li></ul>`;
          }
        }
        if (t.priceValidFrom) {
          if (today >= t.priceValidFrom) {
            delete t.priceValidFrom;
          } else {
            const d = new Date(t.priceValidFrom);
            const dateStr = `${d.getDate()}. ${MONTH_NAMES[d.getMonth()]}`;
            if (t.info) t.info = t.info.replace('</ul>', `<li class="notice">Pris gjelder fra ${dateStr}</li></ul>`);
          }
        }
      }
    }
    for (const cat of data) {
      for (const s of cat.items) {
        if (s.tiers) processPriceFrom(s.tiers);
        if (s.regions) for (const r of s.regions) processPriceFrom(r.tiers);
      }
    }
    services = data;
    for (const id of Object.keys(state)) {
      if (!getService(id)) delete state[id];
    }
    updateFooter();
    return document.fonts.ready;
  })
  .then(() => {
    if (!services.length) return;
    minCardWidth = measureMinCardWidth();
    document.documentElement.style.setProperty('--card-width', minCardWidth + 'px');
    render();
  })
  .catch(err => {
    console.error('Failed to load data.json', err);
    document.getElementById('app').innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted)">Kunne ikke laste prisdata. Prøv å laste siden på nytt.</p>';
  });

let minCardWidth = 240;

function measureMinCardWidth() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute; visibility:hidden; top:-9999px; left:0; white-space:nowrap; font-family:inherit;';
  document.body.appendChild(probe);

  const tierRow = document.createElement('div');
  tierRow.style.cssText = 'display:inline-flex; gap:0.5rem; padding:0.35rem 0.5rem; font-size:0.82rem;';
  const tierLabel = document.createElement('span');
  const tierPrice = document.createElement('span');
  tierPrice.style.fontWeight = '600';
  tierRow.append(tierLabel, tierPrice);

  const nameEl = document.createElement('span');
  nameEl.style.cssText = 'font-weight:600; font-size:1rem; padding-right:1.5rem;';

  probe.append(tierRow, document.createElement('br'), nameEl);

  let maxTier = 0;
  let maxName = 0;
  for (const cat of services) {
    for (const s of cat.items) {
      nameEl.textContent = s.name;
      maxName = Math.max(maxName, nameEl.getBoundingClientRect().width);
      const allTiers = [];
      if (s.tiers) allTiers.push(...s.tiers);
      if (s.regions) for (const r of s.regions) if (r.tiers) allTiers.push(...r.tiers);
      for (const t of allTiers) {
        tierLabel.textContent = t.label || '';
        tierPrice.textContent = toNok(t.adPrice != null ? t.adPrice : t.price, s.currency || 'NOK') + ' kr';
        maxTier = Math.max(maxTier, tierRow.getBoundingClientRect().width);
      }
    }
  }
  document.body.removeChild(probe);

  const cardPadding = 28;
  const iconBlock = 44;
  return Math.ceil(Math.max(200, maxTier + cardPadding, maxName + cardPadding + iconBlock));
}

function calcColumns() {
  const app = document.getElementById("app");
  const cw = app.clientWidth || window.innerWidth;
  const gap = 12;
  return Math.max(1, Math.floor((cw + gap) / (minCardWidth + gap)));
}

let lastColCount = 0;
const cardColumnCache = new Map();
let cachedColCount = 0;

function renderSportBadges(matched) {
  if (!matched.configured.length && !matched.available.length) return '';
  return `<div class="card-sports">${
    matched.configured.map(sid => `<span class="sport-badge configured">${SPORT_LABELS[sid] || sid}</span>`).join('') +
    matched.available.map(sid => `<span class="sport-badge available" title="Tilgjengelig med riktig pakke/tillegg">${SPORT_LABELS[sid] || sid}</span>`).join('')
  }</div>`;
}

function renderTierList(s, tiers, tierIdx) {
  if (tiers.length <= 1) return '';
  const open = openTiers.has(s.id);
  const currentLabel = (tiers[tierIdx] || tiers[0]).label;
  return `
    <div class="tier-toggle ${open ? 'open' : ''}" data-id="${s.id}" role="button" tabindex="0" aria-expanded="${open}">
      <span class="arrow"></span>
      ${currentLabel}
    </div>
    <div class="tier-list ${open ? 'open' : ''}" data-id="${s.id}" role="radiogroup" aria-label="Velg nivå">
      ${tiers.map((t, i) => {
        const tDim = !tierMatchesFilter(s, t, i);
        return `
        <div class="tier-option ${i === tierIdx ? 'active' : ''} ${tDim ? 'dimmed' : ''}" data-tier="${i}" role="radio" tabindex="${open ? '0' : '-1'}" aria-checked="${i === tierIdx}">
          <span class="tier-label">${t.label}</span>
          <span class="tier-price">${toNok(t.adPrice != null ? t.adPrice : t.price, s.currency || 'NOK')} kr</span>
        </div>
      `;}).join('')}
    </div>
  `;
}

function renderYearlyToggle(s, sel, tier) {
  if (!sel || !sel.active || !tier.yearlyPrice) return '';
  return `
    <div class="addon-list">
      <label class="addon-option">
        <input type="checkbox" class="ui-check" data-service="${s.id}" data-yearly="true" ${sel.yearly ? 'checked' : ''}>
        <span>Betal årlig</span>
        <span class="addon-price">${Math.round(toNok(tier.yearlyPrice, s.currency || 'NOK') / 12)} kr/mnd</span>
      </label>
    </div>
  `;
}

function renderAddons(s, sel, tierIdx) {
  if (!s.addons) return '';
  const visibleAddons = s.addons.filter(a => tierIdx >= a.minTier && (a.maxTier == null || tierIdx <= a.maxTier));
  if (!visibleAddons.length) return '';
  const activeAddons = (sel && sel.addons) || [];
  const useModal = visibleAddons.length > 3;
  if (useModal) {
    if (!sel || !sel.active) return '';
    const addonCost = activeAddons.reduce((sum, aid) => {
      const a = s.addons.find(x => x.id === aid);
      return sum + (a && !a.isAdFreeToggle && !a.choiceGroup ? a.price : 0);
    }, 0);
    const addonLabels = activeAddons.map(aid => s.addons.find(x => x.id === aid)?.label).filter(Boolean);
    return `
      <div class="points-section">
        ${addonLabels.length ? `<div class="points-picks">${addonLabels.join(', ')}${addonCost ? ` (+${addonCost} kr)` : ''}</div>` : ''}
        <button class="points-btn" data-addons-modal="${s.id}">${s.addonsLabel || 'Ekstrapakker'}</button>
      </div>`;
  }
  return `
    <div class="addon-list">
      ${visibleAddons.map(a => {
        const checked = activeAddons.includes(a.id);
        return `
        <label class="addon-option${a.choiceGroup ? ' ui-choice' : ''}">
          <input type="${a.choiceGroup ? 'radio' : 'checkbox'}" ${a.choiceGroup ? `name="${s.id}-${a.choiceGroup}"` : 'class="ui-check"'} data-service="${s.id}" data-addon="${a.id}" ${checked ? 'checked' : ''}>
          <span>${a.label}</span>
          <span class="addon-price">${a.choiceGroup ? (a.price === 0 ? 'Velg' : '+' + a.price + ' kr') : (a.isAdFreeToggle ? '+' + (s.tiers[tierIdx].price - s.tiers[tierIdx].adPrice) + ' kr' : '+' + a.price + ' kr')}</span>
        </label>`;
      }).join('')}
    </div>`;
}

function renderPointsSection(s, sel, tier) {
  if (!sel || !sel.active || !s.pointsOptions || !tier.tvPoeng) return '';
  const picks = sel.pointsPicks || [];
  const used = picks.reduce((sum, pid) => sum + (s.pointsOptions.find(p => p.id === pid)?.points || 0), 0);
  const budget = tier.tvPoeng;
  const pickLabels = picks.map(pid => s.pointsOptions.find(p => p.id === pid)?.label).filter(Boolean);
  return `
    <div class="points-section">
      <div class="points-budget">
        <span>TV-poeng</span>
        <span class="points-bar-wrap">
          <span class="points-bar" style="width:${Math.min(100, used / budget * 100)}%"></span>
        </span>
        <span class="points-count">${used}/${budget}</span>
      </div>
      ${pickLabels.length ? `<div class="points-picks">${pickLabels.join(', ')}</div>` : ''}
      <button class="points-btn" data-points-modal="${s.id}">Velg med TV-poeng</button>
    </div>`;
}

function renderDecoderRow(s, sel, region) {
  if (!sel || !sel.active || !region || !region.decoderPrice) return '';
  const dec = sel.decoders || 0;
  const cost = dec * region.decoderPrice;
  return `
    <div class="decoder-row">
      <div class="decoder-controls">
        <button class="decoder-btn ${dec === 0 ? 'disabled' : ''}" data-decoder="${s.id}" data-dir="-1">&minus;</button>
        <span class="decoder-count">${dec}</span>
        <button class="decoder-btn" data-decoder="${s.id}" data-dir="1">+</button>
        <span>Ekstra dekoder${dec !== 1 ? 'e' : ''}</span>
      </div>
      <span class="decoder-price">${cost ? `+${cost} kr${region.decoderNote ? '*' : ''}` : ''}</span>
    </div>`;
}

function renderCard(s, sel) {
  const { monthly: price, yearly, isYearly, tier, tierIdx, region } = computeServicePrice(s, sel);
  const tiers = region ? region.tiers : s.tiers;
  const includedBy = getIncludedBy(s.id);
  const isActive = !!(sel && sel.active);
  const isInfoOnly = !!s.infoOnly;
  // The card is a group and its name the toggle, so the controls inside
  // a card are not nested in another control.
  const isToggle = !includedBy && !isInfoOnly;
  const cardAttrs = `role="group" aria-label="${s.name}${isToggle ? '' : includedBy ? ' (inkludert)' : ' (kun via pakke)'}"`;
  const matched = getMatchedSports(s);
  const dimmed = sportFilter.size > 0 && matched.configured.length === 0 && matched.available.length === 0 && !isActive && !includedBy;

  const infoBtn = hasInfoContent(s)
    ? `<button class="info-btn" data-info="${s.id}" title="Mer info">i</button>`
    : `<a class="info-btn link-btn" href="${s.url}" target="_blank" rel="noopener" title="Åpne nettside">↗</a>`;

  const subtitle = region
    ? `<div class="card-subtitle region-link" data-service="${s.id}" role="button" tabindex="0" aria-label="${region.label}, bytt leverandør">${region.label} <span class="region-arrow"></span></div>`
    : (s.subtitle ? `<div class="card-subtitle">${s.subtitle}</div>` : '');

  const includedTier = includedBy && tiers[includedBy.tier];
  const savingsPrice = includedBy ? (includedTier ? (includedTier.adPrice != null ? includedTier.adPrice : includedTier.price) : tiers[0].price) : 0;
  const priceHtml = includedBy
    ? `<span class="included-label">Inkludert i ${includedBy.name}</span>${isInfoOnly ? '' : `<span class="included-savings">Spar ${savingsPrice} kr/mnd</span>`}`
    : isInfoOnly
      ? `<span class="info-only-label">Kun via pakke</span>`
      : (isYearly ? `<strong>${yearly} kr</strong>/år` : `<strong>${price} kr</strong>/mnd`);

  return `
    <div class="card ${sel && sel.active ? 'selected' : ''} ${includedBy ? 'included' : ''} ${isInfoOnly && !includedBy ? 'info-only' : ''} ${dimmed ? 'dimmed' : ''}" data-id="${s.id}" ${cardAttrs}>
      ${infoBtn}
      <div class="card-header">
        <div class="card-icon" style="background:${s.favicon ? 'transparent' : s.color};color:${initialsColor(s.color)}" data-color="${s.color}" data-initials="${s.initials}">
          ${s.favicon ? `<img class="favicon" src="${s.favicon}" alt="" width="36" height="36">` : s.initials}
        </div>
        <div class="card-text">
          ${isToggle
            ? `<button class="card-name card-toggle" type="button" aria-pressed="${isActive}">${s.name}</button>`
            : `<div class="card-name">${s.name}</div>`}
          ${subtitle}
          <div class="card-price">${priceHtml}</div>
        </div>
      </div>
      ${renderSportBadges(matched)}
      ${!includedBy && !isInfoOnly ? renderTierList(s, tiers, tierIdx) : ''}
      ${!includedBy && !isInfoOnly ? renderYearlyToggle(s, sel, tier) : ''}
      ${!includedBy && !isInfoOnly ? renderAddons(s, sel, tierIdx) : ''}
      ${renderPointsSection(s, sel, tier)}
      ${renderDecoderRow(s, sel, region)}
    </div>
  `;
}

function wireUpCardEvents(app) {
  app.querySelectorAll('.card-icon img.favicon').forEach(img => {
    img.addEventListener('error', () => {
      const icon = img.closest('.card-icon');
      icon.style.background = icon.dataset.color;
      icon.innerHTML = icon.dataset.initials;
    });
  });

  app.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.tier-list') || e.target.closest('a') || e.target.closest('.info-btn') || e.target.closest('.region-link') || e.target.closest('.addon-option') || e.target.closest('.points-section')) return;
      const id = card.dataset.id;
      if (getIncludedBy(id)) return;
      const svc = getService(id);
      if (svc && svc.infoOnly) return;
      if (state[id]) {
        state[id].active = !state[id].active;
      } else {
        const rgn = getRegion(svc, null);
        state[id] = { tierIdx: rgn && rgn.defaultTier || svc && svc.defaultTier || 0, active: true };
      }
      render();
    });
  });

  app.querySelectorAll('.tier-toggle').forEach(toggle => {
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      const id = toggle.dataset.id;
      if (openTiers.has(id)) openTiers.delete(id);
      else openTiers.add(id);
      const list = toggle.parentElement.querySelector('.tier-list[data-id="' + id + '"]');
      const open = openTiers.has(id);
      toggle.classList.toggle('open', open);
      list.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
  });

  app.querySelectorAll('.tier-option[data-tier]').forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation();
      const tierList = opt.closest('.tier-list');
      const id = tierList.dataset.id;
      const tierIdx = parseInt(opt.dataset.tier);
      if (!state[id]) state[id] = { active: true };
      if (state[id].tierIdx !== tierIdx) state[id].pointsPicks = [];
      state[id].tierIdx = tierIdx;
      render();
    });
  });

  app.querySelectorAll('.addon-option input[data-yearly]').forEach(cb => {
    cb.addEventListener('change', e => {
      e.stopPropagation();
      const serviceId = cb.dataset.service;
      if (!state[serviceId]) state[serviceId] = { tierIdx: 0, active: true };
      state[serviceId].yearly = cb.checked;
      render();
    });
  });

  app.querySelectorAll('.addon-option input[data-points-option]').forEach(cb => {
    cb.addEventListener('change', e => {
      e.stopPropagation();
      const serviceId = cb.dataset.service;
      const optionId = cb.dataset.pointsOption;
      if (!state[serviceId]) state[serviceId] = { tierIdx: 0, active: true };
      if (!state[serviceId].pointsPicks) state[serviceId].pointsPicks = [];
      if (cb.checked) {
        if (!state[serviceId].pointsPicks.includes(optionId)) state[serviceId].pointsPicks.push(optionId);
      } else {
        state[serviceId].pointsPicks = state[serviceId].pointsPicks.filter(p => p !== optionId);
      }
      render();
    });
  });

  app.querySelectorAll('.addon-option input:not([data-yearly]):not([data-points-option])').forEach(cb => {
    cb.addEventListener('change', e => {
      e.stopPropagation();
      toggleAddon(cb.dataset.service, cb.dataset.addon, cb.checked);
      render();
    });
  });

  app.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openModal(btn.dataset.info);
    });
  });

  app.querySelectorAll('.region-link').forEach(link => {
    link.addEventListener('click', e => {
      e.stopPropagation();
      openRegionModal(link.dataset.service);
    });
  });

  app.querySelectorAll('.points-btn[data-points-modal]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openPointsModal(btn.dataset.pointsModal);
    });
  });

  app.querySelectorAll('.points-btn[data-addons-modal]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openAddonsModal(btn.dataset.addonsModal);
    });
  });

  app.querySelectorAll('[data-decoder]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.decoder;
      const dir = parseInt(btn.dataset.dir);
      if (!state[id]) return;
      state[id].decoders = Math.max(0, (state[id].decoders || 0) + dir);
      render();
    });
  });

  app.querySelectorAll('[role="button"], [role="radio"]').forEach(el => {
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      el.click();
    });
  });
}

function render() {
  if (!services.length) return;
  const prevScrollY = window.scrollY;
  const app = document.getElementById("app");
  // A card toggle pressed from the keyboard keeps focus through the redraw.
  const focusedToggle = document.activeElement && document.activeElement.closest('.card-toggle');
  const focusedId = focusedToggle && focusedToggle.closest('.card').dataset.id;
  const colCount = calcColumns();
  lastColCount = colCount;
  if (colCount !== cachedColCount) {
    cardColumnCache.clear();
    cachedColCount = colCount;
  }
  app.innerHTML = services.map(cat => {
    const catColCount = Math.min(colCount, cat.items.length);
    return `
    <section class="category">
      ${cat.category ? `<div class="ui-list-head category-title">${cat.category}</div>` : ''}
      <div class="grid">
        ${Array.from({length: catColCount}, () => '<div class="grid-col"></div>').join('')}
      </div>
    </section>`;
  }).join('');

  services.forEach((cat, catIdx) => {
    const section = app.children[catIdx];
    const cols = section.querySelectorAll('.grid-col');
    const catColCount = cols.length;
    if (!catColCount) return;
    const colHeights = Array(catColCount).fill(0);
    const temp = document.createElement('div');
    cat.items.forEach(s => {
      let colIdx = cardColumnCache.get(s.id);
      if (colIdx == null || colIdx >= catColCount) {
        colIdx = 0;
        for (let j = 1; j < catColCount; j++) {
          if (colHeights[j] < colHeights[colIdx]) colIdx = j;
        }
        cardColumnCache.set(s.id, colIdx);
      }
      temp.innerHTML = renderCard(s, state[s.id]).trim();
      const cardEl = temp.firstElementChild;
      cols[colIdx].appendChild(cardEl);
      colHeights[colIdx] += cardEl.offsetHeight;
    });
  });

  wireUpCardEvents(app);
  if (focusedId) {
    const toggle = app.querySelector(`.card[data-id="${focusedId}"] .card-toggle`);
    if (toggle) toggle.focus({ preventScroll: true });
  }
  updateTotal();
  updateSportFilterButton();
  syncHash();
  if (window.scrollY !== prevScrollY) window.scrollTo(0, prevScrollY);
}

function renderSourcesBlock(sources) {
  if (!sources || !sources.length) return '';
  const labelOf = (url) => {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      const slug = u.pathname.replace(/\/$/, '').split('/').filter(Boolean).pop();
      return slug ? `${host}/${slug}` : host;
    } catch { return url; }
  };
  const items = sources.map((url, i) =>
    `<div class="modal-tier-sources-item"><a href="${url}" target="_blank" rel="noopener" title="${url}">[${i + 1}] ${labelOf(url)}</a></div>`
  ).join('');
  return `<div class="modal-tier-sources"><div class="modal-tier-sources-label">Kilder:</div>${items}</div>`;
}

function renderTierInfoWithSports(t) {
  const hasSports = t.sports && t.sports.length && !t.hideSportSummary;
  if (!t.info && !hasSports) return '';
  if (!hasSports) return `<div class="modal-tier-info">${t.info}</div>`;
  const labels = t.sports.map(id => SPORT_LABELS[id] || id).join(', ');
  const sportLi = `<li>${labels}</li>`;
  if (!t.info) return `<div class="modal-tier-info"><ul>${sportLi}</ul></div>`;
  const idx = t.info.lastIndexOf('</ul>');
  if (idx !== -1) {
    return `<div class="modal-tier-info">${t.info.slice(0, idx) + sportLi + t.info.slice(idx)}</div>`;
  }
  return `<div class="modal-tier-info">${t.info}<ul>${sportLi}</ul></div>`;
}

function collectServiceSources(s, tiers) {
  const seen = new Set();
  const out = [];
  const add = (arr) => {
    if (!arr) return;
    for (const url of arr) {
      if (!seen.has(url)) { seen.add(url); out.push(url); }
    }
  };
  add(s.sources);
  for (const t of tiers) add(t.sources);
  if (s.addons) for (const a of s.addons) add(a.sources);
  if (s.pointsOptions) for (const p of s.pointsOptions) add(p.sources);
  return out;
}

function renderAddonItem(a) {
  if (a.info) {
    return `<li>${a.label}: ${a.info}</li>`;
  }
  if (a.sports && a.sports.length) {
    const labels = a.sports.map(id => SPORT_LABELS[id] || id).join(', ');
    return `<li>${a.label}: ${labels}</li>`;
  }
  return `<li>${a.label}</li>`;
}

function hasServiceInSelection(svcId, targetServiceId) {
  const sel = state[svcId];
  const svc = getService(svcId);
  if (!svc) return false;
  const tierIdx = sel ? sel.tierIdx : ((svc.regions && svc.regions[0].defaultTier) || svc.defaultTier || 0);
  const region = getRegion(svc, sel);
  const tiers = region ? region.tiers : svc.tiers;
  const tier = tiers[tierIdx] || tiers[0];
  if (tier && tier.includes && tier.includes.includes(targetServiceId)) return true;
  if (sel && sel.addons && svc.addons) {
    for (const addon of svc.addons) {
      if (sel.addons.includes(addon.id) && addon.includesService === targetServiceId) return true;
    }
  }
  return false;
}

function computeTierApplicability(a, modalTiers) {
  if (!modalTiers || modalTiers.length <= 1) return null;
  const applicable = [];
  for (let i = 0; i < modalTiers.length; i++) {
    if (i >= a.minTier && (a.maxTier == null || i <= a.maxTier)) {
      applicable.push(modalTiers[i].label);
    }
  }
  if (applicable.length === modalTiers.length) return null;
  return applicable.join(' / ');
}

function renderAddonRow(a, allAddons, modalTiers) {
  const desc = a.info || (a.sports && a.sports.length ? a.sports.map(id => SPORT_LABELS[id] || id).join(', ') : '');
  const requiresAddon = a.requires ? (allAddons.find(x => x.id === a.requires) || {}).label : null;
  const requiresSvc = a.requiresService ? (getService(a.requiresService) || {}).name : null;
  const requiresLabel = requiresAddon || requiresSvc;
  const tierScope = computeTierApplicability(a, modalTiers);
  let priceText = `+${a.price} kr/mnd`;
  if (a.isAdFreeToggle && modalTiers) {
    const diffs = modalTiers.filter(t => t.adPrice != null).map(t => t.price - t.adPrice);
    if (diffs.length) {
      const min = Math.min(...diffs);
      const max = Math.max(...diffs);
      priceText = min === max ? `+${min} kr/mnd` : `+${min}-${max} kr/mnd`;
    }
  }
  return `
    <div class="addon-row">
      <div class="addon-row-header">
        <span class="addon-row-label">${a.label}${requiresLabel ? ` <span class="addon-row-requires">(krever ${requiresLabel})</span>` : ''}${tierScope ? ` <span class="addon-row-tier">Kun ${tierScope}</span>` : ''}</span>
        <span class="addon-row-price">${priceText}</span>
      </div>
      ${desc ? `<div class="addon-row-desc">${desc}</div>` : ''}
    </div>
  `;
}

function toggleAddon(serviceId, addonId, checked) {
  if (!state[serviceId]) state[serviceId] = { tierIdx: 0, active: true, addons: [] };
  if (!state[serviceId].addons) state[serviceId].addons = [];
  const s = getService(serviceId);
  const addon = s && s.addons && s.addons.find(a => a.id === addonId);
  if (addon && addon.choiceGroup) {
    const others = s.addons.filter(a => a.choiceGroup === addon.choiceGroup && a.id !== addonId).map(a => a.id);
    state[serviceId].addons = state[serviceId].addons.filter(a => !others.includes(a));
  }
  if (checked) {
    if (!state[serviceId].addons.includes(addonId)) state[serviceId].addons.push(addonId);
  } else {
    state[serviceId].addons = state[serviceId].addons.filter(a => a !== addonId);
    if (s && s.addons) {
      const deps = s.addons.filter(a => a.requires === addonId).map(a => a.id);
      state[serviceId].addons = state[serviceId].addons.filter(a => !deps.includes(a));
    }
  }
  if (s && s.addons) {
    const hasBundleSport = s.addons.some(a => a.bundlesSportskanaler && state[serviceId].addons.includes(a.id));
    if (hasBundleSport) state[serviceId].addons = state[serviceId].addons.filter(a => a !== 'strim-sportskanaler');
  }
}

function openModal(id) {
  const s = getService(id);
  if (!s) return;
  const sel = state[id];
  const region = getRegion(s, sel);
  const modalTiers = region ? region.tiers : s.tiers;
  const modalUrl = region ? region.url : s.url;

  const tabAddons = s.addons ? s.addons.filter(a => !a.choiceGroup) : [];
  const hasTabs = tabAddons.length > 0;

  const pakkerHtml = `
    ${s.note ? `<div class="modal-tier-info modal-note">${s.note}</div>` : ''}
    ${region && region.note ? `<p class="modal-notice">${region.note}</p>` : ''}
    ${region && region.decoderNote ? `<p class="modal-notice">${region.decoderNote}</p>` : ''}
    ${modalTiers.map((t, ti) => `
      <div class="modal-tier">
        <div class="modal-tier-header">
          <span>${t.label}</span>
          <span>${(() => {
            const currency = s.currency || 'NOK';
            const low = t.adPrice != null ? t.adPrice : t.price;
            let high = t.price;
            if (s.addons) {
              for (const a of s.addons) {
                if (!a.isAdFreeToggle && ti >= a.minTier && (a.maxTier == null || ti <= a.maxTier)) {
                  high += a.price;
                }
              }
            }
            const lowStr = fmtPrice(low, currency);
            return low === high ? lowStr + '/mnd' : lowStr + '+/mnd';
          })()}</span>
        </div>
        ${renderTierInfoWithSports(t)}
        ${(() => {
          const tierAddons = s.addons ? s.addons.filter(a => !a.isAdFreeToggle && !a.choiceGroup && ti >= a.minTier && (a.maxTier == null || ti <= a.maxTier)) : [];
          return !hasTabs && tierAddons.length ? `
          <div class="modal-tier-addons">
            <ul>${tierAddons.map(renderAddonItem).join('')}</ul>
          </div>` : '';
        })()}
      </div>
    `).join('')}
    ${renderSourcesBlock(collectServiceSources(s, modalTiers))}
  `;

  const tilleggHtml = hasTabs ? `
    <div class="addon-rows">
      ${tabAddons.map(a => renderAddonRow(a, s.addons, modalTiers)).join('')}
    </div>
  ` : '';

  const content = openModalWithContent(`
    <div class="modal-header">
      <div class="card-icon" style="background:${s.favicon ? 'transparent' : s.color};color:${initialsColor(s.color)}">
        ${s.favicon
          ? `<img class="favicon" src="${s.favicon}" alt="${s.name}" width="36" height="36">`
          : s.initials}
      </div>
      <h2 id="modal-title">${s.name}${region ? ' (' + region.label + ')' : ''}</h2>
      <a class="modal-link" href="${modalUrl}" target="_blank" rel="noopener">${safeHostname(modalUrl)} ↗</a>
      ${CLOSE_BUTTON}
    </div>
    ${hasTabs ? `
      <div class="ui-tabs" role="tablist">
        <button class="ui-tab" type="button" role="tab" id="modal-tab-pakker" aria-selected="true" aria-controls="modal-panel-pakker" data-tab="pakker">Pakker</button>
        <button class="ui-tab" type="button" role="tab" id="modal-tab-tillegg" aria-selected="false" aria-controls="modal-panel-tillegg" tabindex="-1" data-tab="tillegg">Tillegg (${tabAddons.length})</button>
      </div>
      <div class="modal-tab-panel" role="tabpanel" id="modal-panel-pakker" aria-labelledby="modal-tab-pakker" data-tab-panel="pakker">${pakkerHtml}</div>
      <div class="modal-tab-panel" role="tabpanel" id="modal-panel-tillegg" aria-labelledby="modal-tab-tillegg" data-tab-panel="tillegg" hidden>${tilleggHtml}</div>
    ` : pakkerHtml}
  `);
  populateEurRateTargets(content);
  const tabs = [...content.querySelectorAll('.ui-tab')];
  const selectTab = tab => {
    tabs.forEach(t => {
      const active = t === tab;
      t.setAttribute('aria-selected', active);
      t.tabIndex = active ? 0 : -1;
    });
    content.querySelectorAll('.modal-tab-panel').forEach(p => {
      p.hidden = p.dataset.tabPanel !== tab.dataset.tab;
    });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      let next = null;
      if (step) next = tabs[(i + step + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      e.preventDefault();
      selectTab(next);
      next.focus();
    });
  });
}

const CLOSE_BUTTON = '<button class="ui-button ui-button-quiet ui-dialog-close modal-close" type="button" aria-label="Lukk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>';

// showModal() makes the page behind inert and closes on Escape; the close
// event below handles every way out, Escape included.
const modal = document.getElementById('modal');

// A click on the backdrop lands on the dialog itself, since its body
// fills it.
modal.addEventListener('click', e => {
  if (e.target === modal) closeModal();
});

let lastTriggerElement = null;

modal.addEventListener('close', () => {
  modal.classList.remove('compact', 'narrow', 'sport-filter');
  document.getElementById('modal-content').innerHTML = '';
  if (lastTriggerElement && lastTriggerElement.isConnected && typeof lastTriggerElement.focus === 'function') {
    lastTriggerElement.focus();
  }
  lastTriggerElement = null;
});

function closeModal() {
  if (modal.open) modal.close();
}

function openModalWithContent(html, extraClass) {
  const content = document.getElementById('modal-content');
  const activeEl = document.activeElement;
  if (activeEl && !modal.contains(activeEl) && activeEl !== document.body) {
    lastTriggerElement = activeEl;
  }
  content.innerHTML = html;
  modal.classList.remove('compact', 'narrow', 'sport-filter');
  if (extraClass) modal.classList.add(extraClass);
  if (!modal.open) modal.showModal();
  const closeBtn = content.querySelector('.modal-close');
  closeBtn.addEventListener('click', closeModal);
  closeBtn.focus({ preventScroll: true });
  return content;
}

function openRegionModal(serviceId) {
  const s = getService(serviceId);
  if (!s || !s.regions) return;
  const sel = state[serviceId];
  const activeRegion = getRegion(s, sel);
  const content = openModalWithContent(`
    <div class="modal-header">
      <h2 id="modal-title">Velg leverandør</h2>
      ${CLOSE_BUTTON}
    </div>
    <div class="addon-list">
      ${s.regions.map(r => `
        <label class="addon-option ui-choice">
          <input type="radio" name="region-pick" data-service="${serviceId}" data-region="${r.id}" ${r.id === activeRegion.id ? 'checked' : ''}>
          <span>${r.label}</span>
        </label>
      `).join('')}
    </div>
  `, 'compact');
  content.querySelectorAll('input[data-region]').forEach(cb => {
    cb.addEventListener('change', () => {
      const regionId = cb.dataset.region;
      const sid = cb.dataset.service;
      if (!state[sid]) state[sid] = { active: false };
      const oldRegion = state[sid].region;
      state[sid].region = regionId;
      if (oldRegion !== regionId) {
        const region = s.regions.find(r => r.id === regionId);
        state[sid].tierIdx = region && region.defaultTier || 0;
        state[sid].pointsPicks = [];
      }
      closeModal();
      render();
    });
  });
}

function openAddonsModal(serviceId) {
  const s = getService(serviceId);
  if (!s || !s.addons) return;
  const sel = state[serviceId];
  const tierIdx = sel ? sel.tierIdx : (s.defaultTier || 0);
  const activeAddons = (sel && sel.addons) || [];
  const visibleAddons = s.addons.filter(a => tierIdx >= a.minTier && (a.maxTier == null || tierIdx <= a.maxTier));
  const bundledSport = s.addons.some(a => a.bundlesSportskanaler && activeAddons.includes(a.id));

  const renderOption = (a) => {
    const needsReq = a.requires && !activeAddons.includes(a.requires);
    const needsSvc = a.requiresService && !hasServiceInSelection(serviceId, a.requiresService);
    const isBundled = a.id === 'strim-sportskanaler' && bundledSport;
    const checked = activeAddons.includes(a.id) || isBundled;
    const disabled = needsReq || needsSvc || isBundled;
    return `
      <label class="addon-option${a.choiceGroup ? ' ui-choice' : ''}${disabled ? ' disabled' : ''}">
        <input type="${a.choiceGroup ? 'radio' : 'checkbox'}" ${a.choiceGroup ? `name="modal-${s.id}-${a.choiceGroup}"` : 'class="ui-check"'} data-service="${serviceId}" data-addon="${a.id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
        <span>${a.label}${isBundled ? '<span class="addon-info">Inkludert</span>' : ''}</span>
        <span class="addon-price">${a.choiceGroup ? (a.price === 0 ? 'Velg' : '+' + a.price + ' kr') : '+' + a.price + ' kr'}</span>
      </label>`;
  };
  const choiceAddons = visibleAddons.filter(a => a.choiceGroup);
  const regularAddons = visibleAddons.filter(a => !a.choiceGroup);
  const content = openModalWithContent(`
    <div class="modal-header modal-header-flush">
      <h2 id="modal-title">${s.addonsLabel || 'Ekstrapakker'}</h2>
      ${CLOSE_BUTTON}
    </div>
    ${choiceAddons.length ? `
      <div class="ui-list-head addon-section-title">Valgfri strømmetjeneste</div>
      <div class="addon-list">${choiceAddons.map(renderOption).join('')}</div>
    ` : ''}
    ${regularAddons.length ? `
      ${choiceAddons.length ? `<div class="ui-list-head addon-section-title">Ekstra tillegg</div>` : ''}
      <div class="addon-list">${regularAddons.map(renderOption).join('')}</div>
    ` : ''}
  `, 'narrow');
  content.querySelectorAll('input[data-addon]').forEach(cb => {
    cb.addEventListener('change', e => {
      const sid = cb.dataset.service;
      toggleAddon(sid, cb.dataset.addon, cb.checked);
      openAddonsModal(sid);
      render();
    });
  });
}

function openPointsModal(serviceId) {
  const s = getService(serviceId);
  if (!s || !s.pointsOptions) return;
  const sel = state[serviceId];
  const picks = (sel && sel.pointsPicks) || [];
  const tiers = getTiers(s, sel);
  const tier = tiers[sel ? sel.tierIdx : 0] || tiers[0];
  const budget = tier.tvPoeng;
  const used = picks.reduce((sum, pid) => sum + (s.pointsOptions.find(p => p.id === pid)?.points || 0), 0);
  const remaining = budget - used;
  const cats = [...new Set(s.pointsOptions.map(p => p.cat))];

  const content = openModalWithContent(`
    <div class="modal-header modal-header-flush">
      <h2 id="modal-title">TV-poeng</h2>
      ${CLOSE_BUTTON}
    </div>
    <div class="points-budget">
      <span>Brukt</span>
      <span class="points-bar-wrap">
        <span class="points-bar" style="width:${Math.min(100, used / budget * 100)}%"></span>
      </span>
      <span class="points-count">${used} / ${budget} poeng</span>
    </div>
    ${cats.map(cat => `
      <div class="points-modal-cat">
        <div class="ui-list-head points-cat-title">${cat}</div>
        <div class="addon-list">
          ${s.pointsOptions.filter(p => p.cat === cat).map(p => {
            const checked = picks.includes(p.id);
            const disabled = !checked && p.points > remaining;
            const conflict = !checked && picks.some(pick => {
              const other = s.pointsOptions.find(o => o.id === pick);
              return other && other.includesService && p.includesService && other.includesService === p.includesService;
            });
            return `
              <label class="addon-option ${disabled || conflict ? 'disabled' : ''}">
                <input type="checkbox" class="ui-check" data-service="${serviceId}" data-points-option="${p.id}" ${checked ? 'checked' : ''} ${disabled || conflict ? 'disabled' : ''}>
                <span>${p.label}</span>
                <span class="addon-price">${p.points} p</span>
              </label>`;
          }).join('')}
        </div>
      </div>
    `).join('')}
    <p class="modal-footnote">
      <a href="https://www.altibox.no/privat/tv/innholdsoversikt/" target="_blank" rel="noopener">Fullstendig innholdsoversikt hos Altibox ↗</a>
    </p>
  `, 'narrow');
  content.querySelectorAll('input[data-points-option]').forEach(cb => {
    cb.addEventListener('change', e => {
      const optionId = cb.dataset.pointsOption;
      const sid = cb.dataset.service;
      if (!state[sid]) state[sid] = { tierIdx: 0, active: true };
      if (!state[sid].pointsPicks) state[sid].pointsPicks = [];
      if (cb.checked) {
        if (!state[sid].pointsPicks.includes(optionId)) state[sid].pointsPicks.push(optionId);
      } else {
        state[sid].pointsPicks = state[sid].pointsPicks.filter(p => p !== optionId);
      }
      updatePointsModal(sid);
      render();
    });
  });
}

function updatePointsModal(serviceId) {
  const s = getService(serviceId);
  if (!s) return;
  const sel = state[serviceId];
  const region = getRegion(s, sel);
  const tiers = region ? region.tiers : s.tiers;
  const tier = tiers[sel ? sel.tierIdx : 0] || tiers[0];
  const picks = (sel && sel.pointsPicks) || [];
  const budget = tier.tvPoeng;
  const used = picks.reduce((sum, pid) => sum + (s.pointsOptions.find(p => p.id === pid)?.points || 0), 0);
  const remaining = budget - used;
  const content = document.getElementById('modal-content');
  const bar = content.querySelector('.points-bar');
  if (bar) bar.style.width = Math.min(100, used / budget * 100) + '%';
  const count = content.querySelector('.points-count');
  if (count) count.textContent = `${used} / ${budget} poeng`;
  content.querySelectorAll('input[data-points-option]').forEach(cb => {
    const p = s.pointsOptions.find(o => o.id === cb.dataset.pointsOption);
    if (!p) return;
    const checked = picks.includes(p.id);
    const conflict = !checked && picks.some(pick => {
      const other = s.pointsOptions.find(o => o.id === pick);
      return other && other.includesService && p.includesService && other.includesService === p.includesService;
    });
    const disabled = !checked && (p.points > remaining || conflict);
    cb.closest('.addon-option').classList.toggle('disabled', disabled);
    cb.disabled = disabled;
  });
}

function openSportFilterModal() {
  const renderGroup = g => `
    <div class="points-modal-cat">
      <div class="ui-list-head points-cat-title">${g.label}</div>
      <div class="addon-list">
        ${g.sports.map(sp => `
          <label class="addon-option">
            <input type="checkbox" class="ui-check" data-sport="${sp.id}" ${sportFilter.has(sp.id) ? 'checked' : ''}>
            <span>${sp.label}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;
  const content = openModalWithContent(`
    <div class="modal-header">
      <h2 id="modal-title">Filter</h2>
      ${CLOSE_BUTTON}
    </div>
    <div class="sport-filter-grid">
      <div>${SPORT_GROUPS.slice(0, 2).map(renderGroup).join('')}</div>
      <div>${SPORT_GROUPS.slice(2).map(renderGroup).join('')}</div>
    </div>
  `, 'sport-filter');
  content.querySelectorAll('input[data-sport]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) sportFilter.add(cb.dataset.sport);
      else sportFilter.delete(cb.dataset.sport);
      render();
    });
  });
}

function isServiceIncluded(targetId) {
  for (const [id, sel] of Object.entries(state)) {
    if (!sel.active || id === targetId) continue;
    const s = getService(id);
    if (!s) continue;
    const tiers = getTiers(s, sel);
    const tier = tiers[sel.tierIdx] || tiers[0];
    if (tier.includes && tier.includes.includes(targetId)) return true;
    if (sel.addons && s.addons) {
      for (const a of s.addons) {
        if (sel.addons.includes(a.id) && a.includesService === targetId) return true;
      }
    }
    if (s.pointsOptions && sel.pointsPicks) {
      for (const pick of sel.pointsPicks) {
        const opt = s.pointsOptions.find(p => p.id === pick);
        if (opt && opt.includesService === targetId) return true;
      }
    }
  }
  return false;
}

function getIncludedBy(serviceId) {
  for (const [id, sel] of Object.entries(state)) {
    if (!sel.active) continue;
    if (isServiceIncluded(id)) continue;
    const s = getService(id);
    if (!s) continue;
    const tiers = getTiers(s, sel);
    const tier = tiers[sel.tierIdx] || tiers[0];
    let inclTier = -1;
    const tierIncludes = !!(tier.includes && tier.includes.includes(serviceId));
    if (tierIncludes) {
      inclTier = (tier.includesTiers && tier.includesTiers[serviceId]) || 0;
    }
    if (sel.addons && s.addons) {
      for (const addon of s.addons) {
        if (!sel.addons.includes(addon.id)) continue;
        if (tierIncludes && addon.includesUpgrade && addon.includesUpgrade[serviceId] != null) {
          if (!addon.includesRequires || sel.addons.includes(addon.includesRequires)) {
            inclTier = Math.max(inclTier, addon.includesUpgrade[serviceId]);
          }
        }
        if (addon.includesService === serviceId) {
          inclTier = Math.max(inclTier, addon.includesTier || 0);
        }
      }
    }
    if (s.pointsOptions && sel.pointsPicks) {
      for (const pick of sel.pointsPicks) {
        const opt = s.pointsOptions.find(p => p.id === pick);
        if (opt && opt.includesService === serviceId) {
          inclTier = Math.max(inclTier, opt.includesTier || 0);
        }
      }
    }
    if (inclTier >= 0) return { name: s.name, tier: inclTier };
  }
  return null;
}

function getRegion(s, sel) {
  if (!s.regions) return null;
  const regionId = sel && sel.region || s.regions[0].id;
  return s.regions.find(r => r.id === regionId) || s.regions[0];
}

function getTiers(s, sel) {
  const region = getRegion(s, sel);
  return region ? region.tiers : s.tiers;
}

function computeServicePrice(s, sel) {
  const region = getRegion(s, sel);
  const tiers = region ? region.tiers : s.tiers;
  const defaultTier = region && region.defaultTier != null ? region.defaultTier : (s.defaultTier || 0);
  const tierIdx = sel ? sel.tierIdx : defaultTier;
  const tier = tiers[tierIdx] || tiers[0];
  const hasAdFree = sel && sel.addons && s.addons && s.addons.some(a => a.isAdFreeToggle && sel.addons.includes(a.id));
  const isYearly = sel && sel.yearly && tier.yearlyPrice;
  const currency = s.currency || 'NOK';
  let rawMonthly;
  if (isYearly) {
    rawMonthly = currency === 'EUR' ? Math.round((tier.yearlyPrice / 12) * 100) / 100 : Math.round(tier.yearlyPrice / 12);
  } else {
    rawMonthly = tier.adPrice != null && !hasAdFree ? tier.adPrice : tier.price;
  }
  let rawYearly = isYearly ? tier.yearlyPrice : rawMonthly * 12;
  if (sel && sel.addons && s.addons) {
    for (const addonId of sel.addons) {
      const addon = s.addons.find(a => a.id === addonId);
      if (addon && !addon.isAdFreeToggle && tierIdx >= addon.minTier && (addon.maxTier == null || tierIdx <= addon.maxTier)) {
        rawMonthly += addon.price;
        rawYearly += addon.price * 12;
      }
    }
  }
  if (sel && sel.decoders && region && region.decoderPrice) {
    const decoderCost = sel.decoders * region.decoderPrice;
    rawMonthly += decoderCost;
    rawYearly += decoderCost * 12;
  }
  return {
    monthly: toNok(rawMonthly, currency),
    yearly: toNok(rawYearly, currency),
    rawMonthly,
    rawYearly,
    currency,
    isYearly,
    tier,
    tierIdx,
    region
  };
}

function getService(id) {
  for (const cat of services) {
    for (const s of cat.items) {
      if (s.id === id) return s;
    }
  }
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function updateFooter() {
  let newest = '';
  for (const cat of services) for (const s of cat.items) {
    if (s.lastChecked && s.lastChecked > newest) newest = s.lastChecked;
  }
  if (!newest) return;
  const d = new Date(newest);
  const text = `Sist oppdatert ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}.`;
  document.getElementById('last-updated').textContent = text;
}

function collectSportsFromTier(tier, into, seen) {
  if (!tier) return;
  if (tier.sports) for (const sp of tier.sports) into.add(sp);
  if (tier.includes) {
    for (const incId of tier.includes) {
      const inc = getService(incId);
      if (!inc || seen.has(incId)) continue;
      seen.add(incId);
      const incTierIdx = (tier.includesTiers && tier.includesTiers[incId]) || 0;
      const incTiers = inc.tiers || (inc.regions && inc.regions[0].tiers) || [];
      collectSportsFromTier(incTiers[incTierIdx], into, seen);
    }
  }
}

function collectSportsFromIncluded(addonOrOpt, into, seenId) {
  if (!addonOrOpt.includesService) return;
  const inc = getService(addonOrOpt.includesService);
  if (!inc) return;
  const incTiers = inc.tiers || (inc.regions && inc.regions[0].tiers) || [];
  collectSportsFromTier(incTiers[addonOrOpt.includesTier || 0], into, new Set([seenId]));
}

function getServiceSports(s) {
  const all = new Set();
  const collectFromTiers = (tiers) => {
    if (!tiers) return;
    for (const t of tiers) collectSportsFromTier(t, all, new Set([s.id]));
  };
  collectFromTiers(s.tiers);
  if (s.regions) for (const r of s.regions) collectFromTiers(r.tiers);
  if (s.addons) {
    for (const a of s.addons) {
      if (a.sports) for (const sp of a.sports) all.add(sp);
      collectSportsFromIncluded(a, all, s.id);
    }
  }
  if (s.pointsOptions) {
    for (const p of s.pointsOptions) {
      if (p.sports) for (const sp of p.sports) all.add(sp);
      collectSportsFromIncluded(p, all, s.id);
    }
  }
  return all;
}

function hasInfoContent(s) {
  if (s.note) return true;
  if (s.regions && s.regions.length) return true;
  if (s.addons && s.addons.length) return true;
  if (s.pointsOptions && s.pointsOptions.length) return true;
  const tiers = s.tiers || [];
  if (tiers.length > 1) return true;
  for (const t of tiers) if (t.info) return true;
  return false;
}

function getTierAchievableSports(s, tier, tierIdx) {
  const out = new Set();
  collectSportsFromTier(tier, out, new Set([s.id]));
  if (s.addons) {
    for (const a of s.addons) {
      if (tierIdx < a.minTier) continue;
      if (a.maxTier != null && tierIdx > a.maxTier) continue;
      if (a.sports) for (const sp of a.sports) out.add(sp);
      collectSportsFromIncluded(a, out, s.id);
    }
  }
  if (s.pointsOptions && tier.tvPoeng > 0) {
    for (const p of s.pointsOptions) {
      if (p.sports) for (const sp of p.sports) out.add(sp);
      collectSportsFromIncluded(p, out, s.id);
    }
  }
  return out;
}

function tierMatchesFilter(s, tier, tierIdx) {
  if (!sportFilter.size) return true;
  const sp = getTierAchievableSports(s, tier, tierIdx);
  for (const sid of sportFilter) if (sp.has(sid)) return true;
  return false;
}

function getEffectiveSports(s) {
  const out = new Set();
  const sel = state[s.id];
  const region = getRegion(s, sel);
  const tiers = region ? region.tiers : (s.tiers || []);
  const defaultTierIdx = region && region.defaultTier != null ? region.defaultTier : (s.defaultTier || 0);
  const tierIdx = sel && sel.tierIdx != null ? sel.tierIdx : defaultTierIdx;
  collectSportsFromTier(tiers[tierIdx], out, new Set([s.id]));
  if (sel && sel.addons && s.addons) {
    for (const aid of sel.addons) {
      const a = s.addons.find(x => x.id === aid);
      if (!a) continue;
      if (a.sports) for (const sp of a.sports) out.add(sp);
      collectSportsFromIncluded(a, out, s.id);
    }
  }
  if (sel && sel.pointsPicks && s.pointsOptions) {
    for (const pid of sel.pointsPicks) {
      const p = s.pointsOptions.find(x => x.id === pid);
      if (!p) continue;
      if (p.sports) for (const sp of p.sports) out.add(sp);
      collectSportsFromIncluded(p, out, s.id);
    }
  }
  return out;
}

function getMatchedSports(s) {
  if (!sportFilter.size) return { configured: [], available: [] };
  const eff = getEffectiveSports(s);
  const all = getServiceSports(s);
  const configured = [];
  const available = [];
  for (const sid of sportFilter) {
    if (eff.has(sid)) configured.push(sid);
    else if (all.has(sid)) available.push(sid);
  }
  return { configured, available };
}

function updateTotal() {
  let total = 0;
  let yearlyTotal = 0;
  let count = 0;
  for (const [id, sel] of Object.entries(state)) {
    const s = getService(id);
    if (s && sel.active && !getIncludedBy(id)) {
      const { monthly, yearly } = computeServicePrice(s, sel);
      total += monthly;
      yearlyTotal += yearly;
      count++;
    }
  }
  const bar = document.querySelector('.total-bar');
  if (count > 0) {
    document.getElementById("total-monthly").textContent = `${total} kr`;
    document.getElementById("total-yearly").textContent = `(${yearlyTotal} kr/år)`;
    bar.classList.add('visible');
  } else {
    bar.classList.remove('visible');
  }
}

function stateToHash() {
  const parts = [];
  for (const [id, sel] of Object.entries(state)) {
    if (!sel.active) continue;
    let s = `${id}.${sel.tierIdx || 0}`;
    if (sel.region) s += '.r:' + sel.region;
    if (sel.yearly) s += '.y';
    if (sel.decoders) s += '.d:' + sel.decoders;
    if (sel.addons && sel.addons.length) s += '.' + sel.addons.join(',');
    if (sel.pointsPicks && sel.pointsPicks.length) s += '.p:' + sel.pointsPicks.join(',');
    parts.push(s);
  }
  let hash = parts.join('~');
  if (sportFilter.size) hash += (hash ? '~' : '') + 'sf:' + [...sportFilter].join(',');
  return hash;
}

function hashToState(hash) {
  if (!hash) return;
  for (const part of hash.split('~')) {
    if (part.startsWith('sf:')) {
      for (const sid of part.slice(3).split(',')) if (sid) sportFilter.add(sid);
      continue;
    }
    const segs = part.split('.');
    const id = segs[0];
    const tierIdx = parseInt(segs[1]) || 0;
    let yearly = false;
    let region = undefined;
    let decoders = 0;
    const addons = [];
    const pointsPicks = [];
    for (let i = 2; i < segs.length; i++) {
      if (segs[i] === 'y') yearly = true;
      else if (segs[i].startsWith('r:')) region = segs[i].slice(2);
      else if (segs[i].startsWith('d:')) decoders = parseInt(segs[i].slice(2)) || 0;
      else if (segs[i].startsWith('p:')) pointsPicks.push(...segs[i].slice(2).split(','));
      else if (segs[i]) addons.push(...segs[i].split(','));
    }
    state[id] = { tierIdx, active: true, yearly, addons, pointsPicks, region, decoders };
  }
}

function updateSportFilterButton() {
  const btn = document.getElementById('sport-filter-btn');
  const count = document.getElementById('sport-filter-count');
  const reset = document.getElementById('sport-filter-reset');
  const active = sportFilter.size > 0;
  btn.setAttribute('aria-pressed', String(active));
  if (active) {
    count.textContent = sportFilter.size;
    count.hidden = false;
    reset.hidden = false;
  } else {
    count.hidden = true;
    reset.hidden = true;
  }
}

function syncHash() {
  const h = stateToHash();
  const target = h ? '#' + h : location.pathname;
  const current = location.hash || location.pathname;
  if (target === current) return;
  history.replaceState(null, '', target);
}

hashToState(location.hash.slice(1));

document.getElementById('total-reset').addEventListener('click', () => {
  for (const id of Object.keys(state)) delete state[id];
  openTiers.clear();
  render();
});

document.getElementById('sport-filter-btn').addEventListener('click', openSportFilterModal);

document.getElementById('sport-filter-reset').addEventListener('click', () => {
  sportFilter.clear();
  render();
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (calcColumns() !== lastColCount) render();
  }, 120);
});

render();
