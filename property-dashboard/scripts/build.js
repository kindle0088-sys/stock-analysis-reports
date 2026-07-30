/**
 * Main build script — Singapore Property Dashboard
 *
 * Pipeline:
 *   getToken → fetchAllTransactions → fetchRentals
 *   → processTransactions → processRentals
 *   → generate JSON → write to site/data/
 *
 * Usage:
 *   node build.js --demo   (batch 1 only, for testing)
 *   node build.js          (full fetch, 4 batches)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getToken, fetchAllTransactions, fetchTransactions, fetchRentals, processTransactions, processRentals } from './ura-fetcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'site', 'data');
const PROJ_DIR = join(DATA, 'projects');

const D = {
  1: 'Raffles Place / Marina', 2: 'Anson / Tanjong Pagar', 3: 'Queenstown / Tiong Bahru',
  4: 'Sentosa / Harbourfront', 5: 'Bugis / City Hall', 6: 'High Street / Beach Road',
  7: 'Middle Road / Rochor', 8: 'Little India / Farrer Park', 9: 'Kallang / Whampoa',
  10: 'Tanglin / Holland / Bukit Timah', 11: 'Bt. Timah / Newton / Novena', 12: 'Balestier / Toa Payoh',
  13: 'MacPherson / Potong Pasir', 14: 'Eunos / Geylang / Paya Lebar', 15: 'Marine Parade / Katong',
  16: 'Bedok / Upper East Coast', 17: 'Changi / Loyang', 18: 'Tampines / Pasir Ris',
  19: 'Punggol / Sengkang / Hougang', 20: 'Ang Mo Kio / Bishan / Thomson',
  21: 'Upper Bukit Timah / Clementi', 22: 'Boon Lay / Jurong / Tuas', 23: 'Hillview / Dairy Farm',
  24: 'Lim Chu Kang / Tengah', 25: 'Kranji / Woodlands', 26: 'Upper Thomson / Springleaf',
  27: 'Yishun / Sembawang', 28: 'Seletar / Yio Chu Kang'
};
const SECT = { 1:'CCR',2:'CCR',3:'RCR',4:'CCR',5:'CCR',6:'CCR',7:'CCR',8:'RCR',9:'RCR',10:'CCR',
  11:'CCR',12:'RCR',13:'RCR',14:'RCR',15:'RCR',16:'OCR',17:'OCR',18:'OCR',19:'OCR',20:'RCR',
  21:'OCR',22:'OCR',23:'OCR',24:'OCR',25:'OCR',26:'OCR',27:'OCR',28:'OCR' };

function mkdir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }); }

async function main() {
  const t0 = Date.now();
  const demo = process.argv.includes('--demo');
  console.log('=== SG Property Dashboard Build ===');
  console.log('Mode:', demo ? 'DEMO (batch 1)' : 'FULL');
  console.log();

  mkdir(DATA); mkdir(PROJ_DIR);

  // 1. Token
  console.log('1/5 Getting URA token...');
  const tok = await getToken();
  console.log('  OK:', tok.substring(0, 12) + '...');

  // 2. Transactions
  console.log('\n2/5 Fetching transactions...');
  let raw;
  if (demo) {
    raw = await fetchTransactions(1);
    console.log(`  Demo: ${raw.length} projects from batch 1`);
  } else {
    raw = await fetchAllTransactions();
  }
  const txCount = raw.reduce((s, p) => s + (p.transaction?.length || 0), 0);
  console.log(`  Total: ${raw.length} projects, ${txCount} raw transactions`);

  // 3. Rentals
  console.log('\n3/5 Fetching rentals...');
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const y = String(now.getFullYear()).slice(-2);
  let rawRent = [];
  for (const rp of [`${y}Q${q}`, `${y}Q${q - 1 || 4}`, `${String(now.getFullYear() - 1).slice(-2)}Q4`]) {
    try { rawRent = await fetchRentals(rp); if (rawRent.length) { console.log(`  Found ${rawRent.length} rental records for ${rp}`); break; } }
    catch (e) { console.log(`  ${rp}: ${e.message}`); }
  }

  // 4. Process
  console.log('\n4/5 Processing data...');
  const projects = processTransactions(raw);
  const rentals = processRentals(rawRent);
  console.log(`  ${projects.length} projects, ${projects.reduce((s, p) => s + p.transactions.length, 0)} transactions`);
  console.log(`  ${rentals.length} rental records`);

  // 5. Generate output
  console.log('\n5/5 Generating files...');

  // 5a. Project index
  const idx = projects.map(p => ({
    id: p.id, name: p.name, street: p.street,
    district: p.stats.districts[0] || null,
    marketSegment: p.marketSegment,
    avgPsf: p.stats.avgPsf, minPsf: p.stats.minPsf, maxPsf: p.stats.maxPsf,
    totalTxns: p.stats.totalTransactions,
    dateRange: p.stats.dateRange,
    coord: p.coord,
    propertyTypes: p.stats.propertyTypes,
    tenureTypes: p.stats.tenureTypes,
    years: p.stats.years
  }));
  writeJSON(join(DATA, 'projects-index.json'), idx);
  console.log(`  projects-index.json (${idx.length})`);

  // 5b. Per-project
  let n = 0;
  for (const p of projects) {
    writeJSON(join(PROJ_DIR, `${p.id}.json`), {
      id: p.id, name: p.name, street: p.street,
      marketSegment: p.marketSegment, coord: p.coord,
      stats: p.stats,
      transactions: p.transactions.slice(0, 500).map(t => ({
        propertyType: t.propertyType, district: t.district,
        typeOfSale: t.typeOfSale, price: t.price, areaSqf: Math.round(t.areaSqf),
        pricePsf: t.pricePsf, floorRange: t.floorRange,
        contractDate: t.contractDate,
        tenureType: t.tenure.type,
        tenureYears: t.tenure.years
      }))
    });
    n++;
  }
  console.log(`  ${n} project detail files`);

  // 5c. Districts
  const dists = buildDistricts(projects, rentals);
  writeJSON(join(DATA, 'districts.json'), dists);
  console.log(`  districts.json (${dists.length})`);

  // 5d. Rentals
  writeJSON(join(DATA, 'rentals.json'), rentals);
  console.log(`  rentals.json (${rentals.length})`);

  // 5e. Market summary
  const summary = buildSummary(projects, dists);
  writeJSON(join(DATA, 'market-summary.json'), summary);
  console.log('  market-summary.json');

  // 5f. Build meta
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  writeJSON(join(DATA, 'build-meta.json'), {
    buildTime: new Date().toISOString(), elapsed: secs,
    projects: projects.length,
    transactions: projects.reduce((s, p) => s + p.transactions.length, 0),
    rentals: rentals.length, demo
  });
  console.log('  build-meta.json');

  console.log(`\n✅ Build complete in ${secs}s`);
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data), 'utf-8');
}

function buildDistricts(projects, rentals) {
  const map = {};
  for (let d = 1; d <= 28; d++) {
    map[d] = { district: d, name: D[d] || `D${d}`, sector: SECT[d] || 'OCR',
      projectCount: 0, totalTransactions: 0, psfArr: [],
      byYear: {}, rental: null };
  }
  for (const p of projects) {
    const d = p.stats.districts[0];
    if (!d || !map[d]) continue;
    map[d].projectCount++;
    map[d].totalTransactions += p.stats.totalTransactions;
    for (const t of p.transactions) {
      if (t.pricePsf > 0) map[d].psfArr.push(t.pricePsf);
      const yr = t.contractDate?.substring(0, 4);
      if (yr) {
        if (!map[d].byYear[yr]) map[d].byYear[yr] = { count: 0, sum: 0 };
        map[d].byYear[yr].count++;
        map[d].byYear[yr].sum += t.pricePsf || 0;
      }
    }
  }
  const rMap = {};
  for (const r of rentals) {
    if (r.propertyType === 'Non-landed Properties') {
      if (!rMap[r.district]) rMap[r.district] = { rents: [], byBedroom: {} };
      rMap[r.district].rents.push(r.rent);
      const bd = r.bedrooms;
      if (!rMap[r.district].byBedroom[bd]) rMap[r.district].byBedroom[bd] = [];
      rMap[r.district].byBedroom[bd].push(r.rent);
    }
  }
  return Object.values(map).map(d => {
    const arr = d.psfArr;
    const sorted = [...arr].sort((a, b) => a - b);
    const years = Object.fromEntries(Object.entries(d.byYear).map(([k, v]) => [k, { count: v.count, avgPsf: Math.round(v.sum / v.count) }]));
    const r = rMap[d.district];
    let rentalSummary = null;
    if (r && r.rents.length > 0) {
      const rSorted = [...r.rents].sort((a, b) => a - b);
      const byBd = {};
      for (const [bd, rents] of Object.entries(r.byBedroom)) {
        const s = [...rents].sort((a, b) => a - b);
        byBd[bd] = {
          median: s[Math.floor(s.length / 2)],
          lower: s[Math.floor(s.length * 0.25)],
          upper: s[Math.floor(s.length * 0.75)],
          count: s.length
        };
      }
      rentalSummary = {
        median: rSorted[Math.floor(rSorted.length / 2)],
        lower: rSorted[Math.floor(rSorted.length * 0.25)],
        upper: rSorted[Math.floor(rSorted.length * 0.75)],
        count: rSorted.length,
        byBedroom: byBd
      };
    }
    return {
      district: d.district, name: d.name, sector: d.sector,
      projectCount: d.projectCount, totalTransactions: d.totalTransactions,
      avgPsf: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0,
      medianPsf: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
      minPsf: sorted[0] || 0, maxPsf: sorted[sorted.length - 1] || 0,
      byYear: years,
      rental: rentalSummary
    };
  });
}

function buildSummary(projects, districts) {
  const segs = { CCR: [], RCR: [], OCR: [] };
  const segCnt = { CCR: 0, RCR: 0, OCR: 0 };
  for (const p of projects) {
    const s = p.marketSegment || 'OCR';
    if (segs[s]) { segs[s].push(p.stats.avgPsf); segCnt[s]++; }
  }
  const bySeg = {};
  for (const s of Object.keys(segs)) {
    bySeg[s] = { avgPsf: segs[s].length ? Math.round(segs[s].reduce((a, b) => a + b, 0) / segs[s].length) : 0, count: segCnt[s] };
  }
  const allPsf = projects.map(p => p.stats.avgPsf).filter(Boolean);
  return {
    buildTime: new Date().toISOString(),
    totalProjects: projects.length,
    totalTransactions: projects.reduce((s, p) => s + p.stats.totalTransactions, 0),
    overallAvgPsf: allPsf.length ? Math.round(allPsf.reduce((a, b) => a + b, 0) / allPsf.length) : 0,
    bySegment: bySeg
  };
}

main().catch(err => {
  console.error('\n❌ Build failed:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
