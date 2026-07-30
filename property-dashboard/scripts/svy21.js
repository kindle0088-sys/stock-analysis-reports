/**
 * SVY21 to WGS84 coordinate conversion for Singapore
 *
 * SVY21 is a Transverse Mercator projection used in Singapore.
 * Based on the public domain implementation by:
 *   https://github.com/cgcai/SVY21
 *
 * WGS84 ellipsoid constants:
 *   Semi-major axis (a)  = 6378137.0 m
 *   Flattening (f)       = 1/298.257223563
 *   Central Meridian     = 103°50' (103.833333°)
 *   False Easting        = 28001.642 m
 *   False Northing       = 38744.572 m
 *   Scale Factor         = 1.0
 */

const A = 6378137.0;
const F = 1 / 298.257223563;
const E2 = 2 * F - F * F;
const E4 = E2 * E2;
const E6 = E2 * E4;

const CENTRAL_LON = 103.8333333333; // 103°50' in decimal degrees
const FE = 28001.642;
const FN = 38744.572;
const K0 = 1.0;

const N = F / (2 - F);
const N2 = N * N;
const N3 = N2 * N;
const N4 = N3 * N;

const A0 = A * (1 - N + (5 / 4) * (N2 - N3) + (81 / 64) * (N4 - N3 * N));
const A1 = (3 / 2) * A * (N - N2 + (7 / 8) * (N3 - N4 + (11 / 16) * N4 * N));
const A2 = (15 / 16) * A * (N2 - N3 + (3 / 4) * (N4 - N3 * N));
const A3 = (35 / 48) * A * (N3 - N4 + (11 / 16) * N4 * N);
const A4 = (315 / 512) * A * (N4 - N3 * N);

function degToRad(d) { return d * Math.PI / 180; }
function radToDeg(r) { return r * 180 / Math.PI; }

function meridionalArc(phi) {
  return A0 * phi
    - A1 * Math.sin(2 * phi)
    + A2 * Math.sin(4 * phi)
    - A3 * Math.sin(6 * phi)
    + A4 * Math.sin(8 * phi);
}

/**
 * Convert SVY21 easting/northing to WGS84 lat/lng
 * @param {number} x - Easting (metres)
 * @param {number} y - Northing (metres)
 * @returns {{ lat: number, lng: number }}
 */
export function svy21ToWgs84(x, y) {
  if (x == null || y == null || x === 0 || y === 0) return null;
  
  const Nn = y - FN;
  const Xe = x - FE;
  
  // Initial guess for latitude
  let phi = Nn / A0;
  let M = meridionalArc(phi);
  let diff = Nn - M;
  
  // Iterate to refine latitude (usually converges in < 10 iterations)
  let iter = 0;
  while (Math.abs(diff) > 1e-10 && iter < 50) {
    phi += diff / A0;
    M = meridionalArc(phi);
    diff = Nn - M;
    iter++;
  }
  
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = sinPhi / cosPhi;
  const tan2Phi = tanPhi * tanPhi;
  const tan4Phi = tan2Phi * tan2Phi;
  const tan6Phi = tan4Phi * tan2Phi;
  
  const nu = A / Math.sqrt(1 - E2 * sinPhi * sinPhi);
  const rho = A * (1 - E2) / Math.pow(1 - E2 * sinPhi * sinPhi, 1.5);
  const eta2 = nu / rho - 1;
  
  const T1 = Xe / (cosPhi * nu);
  const T2 = T1 * T1;
  const T3 = T2 * T1;
  const T4 = T3 * T1;
  const T5 = T4 * T1;
  const T6 = T5 * T1;
  
  // Latitude correction
  const lat = phi
    - (tanPhi / (2 * rho * nu)) * T2
    + (tanPhi / (24 * rho)) * (5 + 3 * tan2Phi + eta2 - 9 * eta2 * tan2Phi) * T4
    - (tanPhi / (720 * rho)) * (61 + 90 * tan2Phi + 45 * tan4Phi) * T6;
  
  // Longitude correction
  const lon = CENTRAL_LON + radToDeg(
    T1 / cosPhi
    - (1 + 2 * tan2Phi + eta2) * T3 / (6 * cosPhi)
    + (5 + 28 * tan2Phi + 24 * tan4Phi + 6 * eta2 + 8 * eta2 * tan2Phi) * T5 / (120 * cosPhi)
  );
  
  return {
    lat: parseFloat(radToDeg(lat).toFixed(6)),
    lng: parseFloat(lon.toFixed(6))
  };
}

/**
 * Create a URL-safe slug from a project name
 */
export function projectSlug(name) {
  if (!name) return 'unknown';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
