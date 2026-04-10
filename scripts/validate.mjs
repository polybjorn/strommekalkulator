#!/usr/bin/env node
// Validates data.json consistency against itself and against index.html's SPORT_GROUPS.
// Exits 1 on any hard error, 0 with warnings allowed.
// Usage: node scripts/validate.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'data.json'), 'utf8'));
const html = readFileSync(join(root, 'index.html'), 'utf8');

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// --- extract SPORT_GROUPS from index.html ---
const spMatch = html.match(/const SPORT_GROUPS\s*=\s*(\[[\s\S]*?\n\s{4}\];)/);
if (!spMatch) {
  err('Could not locate SPORT_GROUPS in index.html');
}
const sportIdRe = /id:\s*'([^']+)'/g;
const validSports = new Set();
if (spMatch) {
  for (const m of spMatch[1].matchAll(sportIdRe)) validSports.add(m[1]);
}

// --- flatten services ---
const services = [];
for (const cat of data) for (const s of cat.items) services.push(s);
const serviceById = new Map(services.map((s) => [s.id, s]));

// --- duplicate service IDs ---
const seenServiceIds = new Set();
for (const s of services) {
  if (seenServiceIds.has(s.id)) err(`Duplicate service id: ${s.id}`);
  seenServiceIds.add(s.id);
}

// --- helpers ---
const tiersOf = (s) => {
  if (s.tiers) return s.tiers;
  if (s.regions && s.regions[0]) return s.regions[0].tiers || [];
  return [];
};
const tierCount = (s) => {
  if (s.tiers) return s.tiers.length;
  if (s.regions) return Math.max(0, ...s.regions.map((r) => (r.tiers || []).length));
  return 0;
};
const checkSports = (arr, where) => {
  if (!Array.isArray(arr)) return;
  for (const sid of arr) {
    if (!validSports.has(sid)) err(`Unknown sport id "${sid}" in ${where}`);
  }
  const seen = new Set();
  for (const sid of arr) {
    if (seen.has(sid)) warn(`Duplicate sport id "${sid}" in ${where}`);
    seen.add(sid);
  }
};
const checkIncludesRef = (obj, where) => {
  if (obj.includesService) {
    const target = serviceById.get(obj.includesService);
    if (!target) {
      err(`${where} includesService "${obj.includesService}" references unknown service`);
      return;
    }
    const tc = tierCount(target);
    const t = obj.includesTier ?? 0;
    if (t < 0 || t >= tc) {
      err(`${where} includesTier ${t} out of bounds for ${obj.includesService} (has ${tc} tiers)`);
    }
  }
};

// --- per-service checks ---
for (const s of services) {
  const here = `service ${s.id}`;

  // tier-level
  const tiers = tiersOf(s);
  const seenTierLabels = new Set();
  tiers.forEach((t, i) => {
    const twhere = `${here} tier[${i}] (${t.label || '?'})`;
    if (t.label && seenTierLabels.has(t.label)) warn(`${here}: duplicate tier label "${t.label}"`);
    if (t.label) seenTierLabels.add(t.label);
    if (t.price != null && (typeof t.price !== 'number' || t.price < 0)) {
      err(`${twhere}: invalid price ${t.price}`);
    }
    if (t.yearlyPrice != null && (typeof t.yearlyPrice !== 'number' || t.yearlyPrice < 0)) {
      err(`${twhere}: invalid yearlyPrice ${t.yearlyPrice}`);
    }
    checkSports(t.sports, twhere);
    if (t.includes) {
      for (const incId of t.includes) {
        if (!serviceById.has(incId)) err(`${twhere} includes "${incId}" — unknown service`);
        const tc = tierCount(serviceById.get(incId) || {});
        const it = (t.includesTiers && t.includesTiers[incId]) ?? 0;
        if (serviceById.has(incId) && (it < 0 || it >= tc)) {
          err(`${twhere} includesTiers[${incId}]=${it} out of bounds (has ${tc} tiers)`);
        }
      }
    }
    if (t.priceFrom) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t.priceFrom.date)) {
        err(`${twhere} priceFrom.date not YYYY-MM-DD: ${t.priceFrom.date}`);
      }
      if (typeof t.priceFrom.price !== 'number') err(`${twhere} priceFrom.price not a number`);
    }
    if (t.sources && !Array.isArray(t.sources)) err(`${twhere} sources must be an array`);
  });

  // addon-level
  if (s.addons) {
    const seenAddonIds = new Set();
    const choiceGroupCount = new Map();
    for (const a of s.addons) {
      const awhere = `${here} addon ${a.id}`;
      if (seenAddonIds.has(a.id)) err(`${here}: duplicate addon id "${a.id}"`);
      seenAddonIds.add(a.id);
      checkSports(a.sports, awhere);
      checkIncludesRef(a, awhere);
      if (a.requiresService && !serviceById.has(a.requiresService)) {
        err(`${awhere} requiresService "${a.requiresService}" — unknown service`);
      }
      if (a.minTier != null && (a.minTier < 0 || a.minTier >= tierCount(s))) {
        err(`${awhere} minTier=${a.minTier} out of bounds (service has ${tierCount(s)} tiers)`);
      }
      if (a.maxTier != null && (a.maxTier < 0 || a.maxTier >= tierCount(s))) {
        err(`${awhere} maxTier=${a.maxTier} out of bounds`);
      }
      if (a.minTier != null && a.maxTier != null && a.minTier > a.maxTier) {
        err(`${awhere} minTier(${a.minTier}) > maxTier(${a.maxTier})`);
      }
      if (a.choiceGroup) choiceGroupCount.set(a.choiceGroup, (choiceGroupCount.get(a.choiceGroup) || 0) + 1);
      if (a.includesUpgrade) {
        for (const [svcId, tierIdx] of Object.entries(a.includesUpgrade)) {
          if (!serviceById.has(svcId)) err(`${awhere} includesUpgrade["${svcId}"] — unknown service`);
          const tc = tierCount(serviceById.get(svcId) || {});
          if (tierIdx < 0 || tierIdx >= tc) err(`${awhere} includesUpgrade["${svcId}"]=${tierIdx} out of bounds`);
        }
      }
    }
    // cross-addon refs
    for (const a of s.addons) {
      if (a.requires && !seenAddonIds.has(a.requires)) err(`${here} addon ${a.id} requires "${a.requires}" — no such addon`);
      if (a.includesRequires && !seenAddonIds.has(a.includesRequires)) err(`${here} addon ${a.id} includesRequires "${a.includesRequires}" — no such addon`);
    }
    for (const [grp, n] of choiceGroupCount) {
      if (n < 2) warn(`${here}: choiceGroup "${grp}" has only ${n} member`);
    }
  }

  // points options
  if (s.pointsOptions) {
    const seenPtIds = new Set();
    for (const p of s.pointsOptions) {
      const pwhere = `${here} pointsOption ${p.id}`;
      if (seenPtIds.has(p.id)) err(`${here}: duplicate pointsOption id "${p.id}"`);
      seenPtIds.add(p.id);
      if (typeof p.points !== 'number' || p.points < 0) err(`${pwhere} invalid points ${p.points}`);
      checkSports(p.sports, pwhere);
      checkIncludesRef(p, pwhere);
    }
  }
}

// --- report ---
if (warnings.length) {
  console.error(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.error(`  warn: ${w}`);
}
if (errors.length) {
  console.error(`\nErrors (${errors.length}):`);
  for (const e of errors) console.error(`  ERROR: ${e}`);
  console.error('\nValidation FAILED');
  process.exit(1);
}
console.log(`OK — ${services.length} services, ${validSports.size} known sport ids${warnings.length ? `, ${warnings.length} warnings` : ''}`);
