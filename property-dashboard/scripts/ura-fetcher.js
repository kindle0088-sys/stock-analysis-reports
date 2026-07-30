/**
 * URA API data fetcher module
 * Handles token acquisition and data fetching from URA Data Service
 */

import { svy21ToWgs84, projectSlug } from './svy21.js';

const URA_ACCESS_KEY = '45e72284-8979-4a7a-85cf-0d359c83c848';
const TOKEN_URL = 'https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1';
const API_BASE = 'https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1';

let _token = null;

export async function getToken() {
  const resp = await fetch(TOKEN_URL, {
    method: 'GET',
    headers: { 'AccessKey': URA_ACCESS_KEY }
  });
  if (!resp.ok) throw new Error(`URA token failed: ${resp.status}`);
  const data = await resp.json();
  if (data.Result) { _token = data.Result; return data.Result; }
  throw new Error(`URA token error: ${JSON.stringify(data)}`);
}

function headers() {
  if (!_token) throw new Error('Token not available. Call getToken() first.');
  return { 'AccessKey': URA_ACCESS_KEY, 'Token': _token };
}

async function fetchService(service, params = {}) {
  const qs = new URLSearchParams({ service, ...params }).toString();
  const url = `${API_BASE}?${qs}`;
  const resp = await fetch(url, { method: 'GET', headers: headers() });
  if (!resp.ok) throw new Error(`URA ${service} failed: ${resp.status}`);
  const data = await resp.json();
  return data.Result || [];
}

export async function fetchTransactions(batch = 1) {
  return fetchService('PMI_Resi_Transaction', { batch: String(batch) });
}

export async function fetchAllTransactions() {
  const all = [];
  for (let b = 1; b <= 4; b++) {
    console.log(`  Fetching batch ${b}/4...`);
    const data = await fetchTransactions(b);
    all.push(...data);
    const txCount = data.reduce((s, p) => s + (p.transaction?.length || 0), 0);
    console.log(`  Batch ${b}: ${data.length} projects, ${txCount} transactions`);
  }
  return all;
}

export async function fetchRentals(refPeriod) {
  return fetchService('PMI_Resi_Rental', { refPeriod });
}

export async function fetchDeveloperSales(refPeriod) {
  return fetchService('PMI_Resi_Developer_Sales', refPeriod ? { refPeriod } : {});
}

export { projectSlug };

function extractDistrict(district) {
  if (!district) return null;
  const d = parseInt(district, 10);
  return isNaN(d) ? null : d;
}

export function parseTenure(tenure) {
  if (!tenure) return { type: 'unknown', years: null, from: null };
  const lower = tenure.toLowerCase();
  if (lower.includes('freehold')) return { type: 'Freehold', years: null, from: null };
  const m = tenure.match(/(\d+)\s*years?\s*lease\s*commencing\s*from\s*(\d{4})/i);
  if (m) return { type: 'Leasehold', years: parseInt(m[1]), from: parseInt(m[2]) };
  const m2 = tenure.match(/(\d+)/);
  if (m2) return { type: 'Leasehold', years: parseInt(m2[1]), from: null };
  return { type: tenure, years: null, from: null };
}

export function processTransactions(rawData) {
  const map = new Map();

  for (const entry of rawData) {
    const name = (entry.project || '').trim();
    if (!name || !entry.transaction?.length) continue;

    const slug = projectSlug(name);
    if (!map.has(slug)) {
      map.set(slug, {
        id: slug, name, street: (entry.street || '').trim(),
        marketSegment: entry.marketSegment || '',
        x: entry.x, y: entry.y, coord: null, transactions: []
      });
    }

    const proj = map.get(slug);
    if (!proj.coord && proj.x != null && proj.y != null && proj.x > 0 && proj.y > 0) {
      try { proj.coord = svy21ToWgs84(proj.x, proj.y); } catch (e) { /* skip */ }
    }

    for (const t of entry.transaction) {
      if (!t.price || !t.area) continue;
      const areaSqf = t.area * 10.7639;
      proj.transactions.push({
        propertyType: t.propertyType || '',
        district: extractDistrict(t.district),
        tenure: parseTenure(t.tenure),
        typeOfSale: t.typeOfSale || 0,
        price: t.price,
        nettPrice: t.nettPrice || t.price,
        area: parseFloat(t.area),
        areaSqf,
        pricePsf: Math.round(t.price / areaSqf),
        floorRange: t.floorRange || '',
        contractDate: t.contractDate || '',
        noOfUnits: t.noOfUnits || 1
      });
    }
  }

  const result = [];
  for (const p of map.values()) {
    const tx = p.transactions;
    if (!tx.length) continue;
    const psfArr = tx.map(t => t.pricePsf).filter(Boolean);
    const years = [...new Set(tx.map(t => t.contractDate?.substring(0, 4)).filter(Boolean))].sort();
    const districts = [...new Set(tx.map(t => t.district).filter(d => d != null))].sort();

    tx.sort((a, b) => (b.contractDate || '').localeCompare(a.contractDate || ''));

    result.push({
      ...p,
      transactions: tx,
      stats: {
        totalTransactions: tx.length,
        minPrice: Math.min(...tx.map(t => t.price)),
        maxPrice: Math.max(...tx.map(t => t.price)),
        minPsf: psfArr.length ? Math.min(...psfArr) : 0,
        maxPsf: psfArr.length ? Math.max(...psfArr) : 0,
        avgPsf: psfArr.length ? Math.round(psfArr.reduce((a, b) => a + b, 0) / psfArr.length) : 0,
        years, districts,
        propertyTypes: [...new Set(tx.map(t => t.propertyType).filter(Boolean))],
        tenureTypes: [...new Set(tx.map(t => t.tenure.type).filter(Boolean))],
        dateRange: {
          min: tx.reduce((m, t) => !m || t.contractDate < m ? t.contractDate : m, null),
          max: tx.reduce((m, t) => !m || t.contractDate > m ? t.contractDate : m, null)
        }
      }
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export function processRentals(rawData) {
  const result = [];
  for (const entry of rawData) {
    if (!entry.rental) continue;
    for (const r of entry.rental) {
      const d = extractDistrict(r.district);
      if (d == null || !r.rent) continue;
      result.push({
        district: d,
        propertyType: r.propertyType || '',
        bedrooms: r.noOfBedRoom || 'NA',
        rent: r.rent || 0,
        areaSqf: r.areaSqft || '',
        areaSqm: r.areaSqm || '',
        leaseDate: r.leaseDate || ''
      });
    }
  }
  return result;
}
