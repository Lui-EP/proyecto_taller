const LOCATIONIQ_BASE_URL = 'https://us1.locationiq.com/v1';
const LOCATIONIQ_DIRECTIONS_BASE_URL = `${LOCATIONIQ_BASE_URL}/directions`;

export const DEFAULT_CHIAPAS_COORDS = {
  lat: 16.7528,
  lng: -93.1167,
};

export const DEFAULT_CHIAPAS_REGION = {
  latitude: DEFAULT_CHIAPAS_COORDS.lat,
  longitude: DEFAULT_CHIAPAS_COORDS.lng,
  latitudeDelta: 0.09,
  longitudeDelta: 0.09,
};

const CHIAPAS_VIEWBOX = '-94.600000,17.950000,-90.200000,14.450000';

const LOCAL_CITY_CENTERS = [
  { city: 'Tuxtla Gutiérrez', aliases: ['tuxtla', 'tuxtla gutierrez'], lat: 16.7516, lng: -93.1166 },
  { city: 'Chiapa de Corzo', aliases: ['chiapa de corzo'], lat: 16.7076, lng: -93.011 },
  { city: 'San Cristóbal de las Casas', aliases: ['san cristobal', 'san cristobal de las casas'], lat: 16.737, lng: -92.6376 },
  { city: 'Tapachula', aliases: ['tapachula'], lat: 14.9033, lng: -92.2575 },
];

const LOCAL_COLONY_CATALOG = [
  { id: 'tuxtla-bienestar-social', colony: 'Bienestar Social', subdivision: '', city: 'Tuxtla Gutiérrez', aliases: ['bienestar social', 'bienestar social tuxtla'], lat: 16.744722, lng: -93.092917 },
  { id: 'tuxtla-santa-maria', colony: 'Santa María', subdivision: '', city: 'Tuxtla Gutiérrez', aliases: ['santa maria'], lat: 16.7463, lng: -93.0898 },
  { id: 'tuxtla-centro', colony: 'Centro', subdivision: '', city: 'Tuxtla Gutiérrez', aliases: ['centro tuxtla', 'centro'], lat: 16.7516, lng: -93.1166 },
  { id: 'tuxtla-potinaspak', colony: 'Potinaspak', subdivision: '', city: 'Tuxtla Gutiérrez', aliases: ['potinaspak'], lat: 16.7486, lng: -93.0998 },
  { id: 'tuxtla-teran', colony: 'Terán', subdivision: '', city: 'Tuxtla Gutiérrez', aliases: ['teran'], lat: 16.7592, lng: -93.1568 },
  { id: 'tuxtla-san-jose-teran', colony: 'San José Terán', subdivision: '', city: 'Tuxtla Gutiérrez', aliases: ['san jose teran'], lat: 16.7608, lng: -93.1529 },
  { id: 'tuxtla-plan-ayala', colony: 'Plan de Ayala', subdivision: '', city: 'Tuxtla Gutiérrez', aliases: ['plan de ayala'], lat: 16.7632, lng: -93.1451 },
  { id: 'tuxtla-las-granjas', colony: 'Las Granjas', subdivision: '', city: 'Tuxtla Gutiérrez', aliases: ['las granjas', 'granjas'], lat: 16.7722, lng: -93.1214 },
  { id: 'tuxtla-infonavit-grijalva', colony: 'Infonavit Grijalva', subdivision: '', city: 'Tuxtla Gutiérrez', aliases: ['infonavit grijalva'], lat: 16.7419, lng: -93.1036 },
  { id: 'tuxtla-las-torres', colony: 'Las Torres', subdivision: '', city: 'Tuxtla Gutiérrez', aliases: ['las torres', 'torres'], lat: 16.739, lng: -93.1362 },
  { id: 'chiapa-bienestar-social', colony: 'Bienestar Social', subdivision: '', city: 'Chiapa de Corzo', aliases: ['bienestar social chiapa', 'bienestar social chiapa de corzo'], lat: 16.742927, lng: -93.027281 },
  { id: 'chiapa-centro', colony: 'Centro', subdivision: '', city: 'Chiapa de Corzo', aliases: ['centro chiapa de corzo'], lat: 16.7076, lng: -93.011 },
  { id: 'chiapa-santa-elena', colony: 'Santa Elena', subdivision: '', city: 'Chiapa de Corzo', aliases: ['santa elena'], lat: 16.7079, lng: -93.0183 },
  { id: 'chiapa-benito-juarez', colony: 'Benito Juárez', subdivision: '', city: 'Chiapa de Corzo', aliases: ['benito juarez'], lat: 16.7111, lng: -93.0145 },
  { id: 'sancris-centro', colony: 'Centro', subdivision: '', city: 'San Cristóbal de las Casas', aliases: ['centro san cristobal'], lat: 16.737, lng: -92.6376 },
  { id: 'sancris-guadalupe', colony: 'Barrio de Guadalupe', subdivision: '', city: 'San Cristóbal de las Casas', aliases: ['guadalupe san cristobal', 'guadalupe'], lat: 16.7398, lng: -92.6315 },
  { id: 'tapachula-centro', colony: 'Centro', subdivision: '', city: 'Tapachula', aliases: ['centro tapachula'], lat: 14.9033, lng: -92.2575 },
];

export function getLocationIqApiKey() {
  return String(process.env.EXPO_PUBLIC_LOCATIONIQ_API_KEY || '').trim();
}

export function hasLocationIqKey() {
  return Boolean(getLocationIqApiKey());
}

export function isValidCoords(coords) {
  return Number.isFinite(Number(coords?.lat)) && Number.isFinite(Number(coords?.lng));
}

export function toMapCoordinate(coords) {
  return {
    latitude: Number(coords?.lat || DEFAULT_CHIAPAS_COORDS.lat),
    longitude: Number(coords?.lng || DEFAULT_CHIAPAS_COORDS.lng),
  };
}

export function toRouteCoordinates(points = []) {
  return points
    .filter(isValidCoords)
    .map((point) => ({
      latitude: Number(point.lat),
      longitude: Number(point.lng),
    }));
}

export function buildRegionFromPoints(points = [], fallback = DEFAULT_CHIAPAS_REGION) {
  const valid = points.filter(isValidCoords);
  if (!valid.length) return fallback;
  if (valid.length === 1) {
    return {
      latitude: Number(valid[0].lat),
      longitude: Number(valid[0].lng),
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    };
  }

  const lats = valid.map((point) => Number(point.lat));
  const lngs = valid.map((point) => Number(point.lng));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.012, (maxLat - minLat) * 1.8),
    longitudeDelta: Math.max(0.012, (maxLng - minLng) * 1.8),
  };
}

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractZones(address = {}, displayName = '') {
  const normalizedDisplay = normalizeText(displayName);
  const rawColony = String(
    address.neighbourhood
    || address.suburb
    || address.residential
    || address.quarter
    || address.hamlet
    || ''
  ).trim();

  const subdivision = String(
    address.city_district
    || address.borough
    || address.allotments
    || ''
  ).trim();

  const city = String(
    address.city
    || address.town
    || address.village
    || address.municipality
    || ''
  ).trim();

  const inferredColony = rawColony || LOCAL_COLONY_CATALOG.find((entry) => {
    const cityMatches = !city || normalizeText(entry.city) === normalizeText(city);
    if (!cityMatches) return false;
    return [entry.colony, ...entry.aliases].some((alias) => normalizedDisplay.includes(normalizeText(alias)));
  })?.colony || '';

  return {
    colony: inferredColony,
    subdivision,
    city,
  };
}

function buildSuggestion({
  lat,
  lng,
  display,
  colony = '',
  subdivision = '',
  city = '',
  source = 'local',
  placeId = '',
}) {
  return {
    lat: Number(lat),
    lng: Number(lng),
    display: String(display || '').trim(),
    colony: String(colony || '').trim(),
    subdivision: String(subdivision || '').trim(),
    city: String(city || '').trim(),
    source,
    placeId,
  };
}

function buildLocalCatalogSuggestions(query) {
  const normalized = normalizeText(query);
  if (normalized.length < 3) return [];

  const colonyMatches = LOCAL_COLONY_CATALOG.filter((entry) => {
    const candidates = [entry.colony, entry.subdivision, entry.city, ...entry.aliases];
    return candidates.some((candidate) => normalizeText(candidate).includes(normalized) || normalized.includes(normalizeText(candidate)));
  }).map((entry) => buildSuggestion({
    lat: entry.lat,
    lng: entry.lng,
    display: [entry.colony, entry.subdivision, entry.city, 'Chiapas, México'].filter(Boolean).join(', '),
    colony: entry.colony,
    subdivision: entry.subdivision,
    city: entry.city,
    source: 'catalogo-local',
    placeId: entry.id,
  }));

  const cityMatches = LOCAL_CITY_CENTERS
    .filter((entry) => [entry.city, ...entry.aliases].some((candidate) => normalizeText(candidate).includes(normalized) || normalized.includes(normalizeText(candidate))))
    .map((entry) => buildSuggestion({
      lat: entry.lat,
      lng: entry.lng,
      display: `${entry.city}, Chiapas, México`,
      colony: '',
      subdivision: '',
      city: entry.city,
      source: 'catalogo-local',
      placeId: entry.city,
    }));

  return dedupeSuggestions([...colonyMatches, ...cityMatches]);
}

function dedupeSuggestions(suggestions = []) {
  const seen = new Set();
  return suggestions.filter((item) => {
    const key = `${Number(item.lat).toFixed(5)}:${Number(item.lng).toFixed(5)}:${normalizeText(item.display)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchLocationIqCandidates(query) {
  const apiKey = getLocationIqApiKey();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    format: 'json',
    addressdetails: '1',
    normalizecity: '1',
    countrycodes: 'mx',
    limit: '6',
    bounded: '1',
    viewbox: CHIAPAS_VIEWBOX,
    'accept-language': 'es',
  });

  const response = await fetch(`${LOCATIONIQ_BASE_URL}/autocomplete.php?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`locationiq_search_${response.status}`);
  }

  const payload = await response.json();
  const list = Array.isArray(payload) ? payload : [];

  return list
    .map((item) => {
      const zones = extractZones(item.address, item.display_name);
      return buildSuggestion({
        lat: item.lat,
        lng: item.lon,
        display: item.display_name,
        colony: zones.colony,
        subdivision: zones.subdivision,
        city: zones.city,
        source: 'locationiq',
        placeId: String(item.place_id || ''),
      });
    })
    .filter((item) => isValidCoords(item) && item.display);
}

export async function searchAddressSuggestions(query) {
  const cleanQuery = String(query || '').trim();
  if (cleanQuery.length < 3) return [];

  const localSuggestions = buildLocalCatalogSuggestions(cleanQuery);
  if (!hasLocationIqKey()) {
    return localSuggestions;
  }

  try {
    const remoteSuggestions = await fetchLocationIqCandidates(cleanQuery);
    return dedupeSuggestions([...remoteSuggestions, ...localSuggestions]).slice(0, 6);
  } catch {
    return localSuggestions;
  }
}

function findNearestLocalAddress(lat, lng) {
  const candidates = LOCAL_COLONY_CATALOG.map((entry) => ({
    ...entry,
    distanceKm: distanceKm({ lat, lng }, entry),
  }));

  candidates.sort((left, right) => left.distanceKm - right.distanceKm);
  const nearest = candidates[0];
  if (!nearest || nearest.distanceKm > 12) return null;

  return buildSuggestion({
    lat: nearest.lat,
    lng: nearest.lng,
    display: [nearest.colony, nearest.subdivision, nearest.city, 'Chiapas, México'].filter(Boolean).join(', '),
    colony: nearest.colony,
    subdivision: nearest.subdivision,
    city: nearest.city,
    source: 'catalogo-local',
    placeId: nearest.id,
  });
}

export async function reverseGeocodeLocation(coords) {
  if (!isValidCoords(coords)) {
    throw new Error('coords_invalid');
  }

  const apiKey = getLocationIqApiKey();
  if (apiKey) {
    const params = new URLSearchParams({
      key: apiKey,
      format: 'json',
      lat: String(coords.lat),
      lon: String(coords.lng),
      addressdetails: '1',
      normalizecity: '1',
      'accept-language': 'es',
    });

    try {
      const response = await fetch(`${LOCATIONIQ_BASE_URL}/reverse.php?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`locationiq_reverse_${response.status}`);
      }

      const payload = await response.json();
      const display = String(payload?.display_name || '').trim();
      if (!display) {
        throw new Error('locationiq_reverse_empty');
      }
      const zones = extractZones(payload.address, display);
      return buildSuggestion({
        lat: coords.lat,
        lng: coords.lng,
        display,
        colony: zones.colony,
        subdivision: zones.subdivision,
        city: zones.city,
        source: 'locationiq-reverse',
        placeId: String(payload.place_id || ''),
      });
    } catch {
      // fallback below
    }
  }

  const local = findNearestLocalAddress(Number(coords.lat), Number(coords.lng));
  if (local) return local;

  return buildSuggestion({
    lat: coords.lat,
    lng: coords.lng,
    display: `${Number(coords.lat).toFixed(5)}, ${Number(coords.lng).toFixed(5)}`,
    colony: '',
    subdivision: '',
    city: '',
    source: 'coords',
  });
}

export async function resolveAddressToLocation(query) {
  const suggestions = await searchAddressSuggestions(query);
  return suggestions[0] || null;
}

export function distanceKm(from, to) {
  if (!isValidCoords(from) || !isValidCoords(to)) return null;
  const lat1 = Number(from.lat);
  const lng1 = Number(from.lng);
  const lat2 = Number(to.lat);
  const lng2 = Number(to.lng);
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

export function formatDistance(distanceMeters, fallbackKm = null) {
  if (Number.isFinite(Number(distanceMeters))) {
    return `${(Number(distanceMeters) / 1000).toFixed(2)} km`;
  }
  if (Number.isFinite(Number(fallbackKm))) {
    return `${Number(fallbackKm).toFixed(2)} km`;
  }
  return '--';
}

export function formatDuration(durationSeconds) {
  if (!Number.isFinite(Number(durationSeconds))) return '--';
  const totalMinutes = Math.max(1, Math.round(Number(durationSeconds) / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

export function buildStraightLineRoute(from, to) {
  const points = [from, to].filter(isValidCoords).map((point) => ({
    lat: Number(point.lat),
    lng: Number(point.lng),
  }));

  return {
    source: 'fallback',
    coordinates: points,
    distanceMeters: null,
    durationSeconds: null,
    steps: [],
  };
}

function normalizeInstruction(step) {
  const instruction = String(step?.maneuver?.instruction || '').trim();
  if (instruction) return instruction;
  const pieces = [
    String(step?.maneuver?.type || '').trim(),
    String(step?.maneuver?.modifier || '').trim(),
    String(step?.name || '').trim(),
  ].filter(Boolean);
  return pieces.join(' ').trim();
}

function normalizeRouteResponse(payload) {
  const routeEntry = Array.isArray(payload?.routes) ? payload.routes[0] : payload?.routes;
  if (!routeEntry) return null;

  const coordinates = Array.isArray(routeEntry?.geometry?.coordinates)
    ? routeEntry.geometry.coordinates
      .map((pair) => ({
        lat: Number(Array.isArray(pair) ? pair[1] : null),
        lng: Number(Array.isArray(pair) ? pair[0] : null),
      }))
      .filter(isValidCoords)
    : [];

  const legs = Array.isArray(routeEntry?.legs) ? routeEntry.legs : routeEntry?.legs ? [routeEntry.legs] : [];
  const steps = legs
    .flatMap((leg) => Array.isArray(leg?.steps) ? leg.steps : [])
    .map((step, index) => ({
      id: `step-${index + 1}`,
      instruction: normalizeInstruction(step),
      distanceMeters: Number.isFinite(Number(step?.distance)) ? Number(step.distance) : null,
      durationSeconds: Number.isFinite(Number(step?.duration)) ? Number(step.duration) : null,
    }))
    .filter((step) => step.instruction);

  return {
    source: 'locationiq',
    coordinates,
    distanceMeters: Number.isFinite(Number(routeEntry?.distance)) ? Number(routeEntry.distance) : null,
    durationSeconds: Number.isFinite(Number(routeEntry?.duration)) ? Number(routeEntry.duration) : null,
    steps,
  };
}

export async function fetchRoute({ from, to, profile = 'driving' }) {
  if (!isValidCoords(from) || !isValidCoords(to)) {
    return buildStraightLineRoute(from, to);
  }

  const apiKey = getLocationIqApiKey();
  if (!apiKey) {
    return buildStraightLineRoute(from, to);
  }

  const coordinates = `${Number(from.lng)},${Number(from.lat)};${Number(to.lng)},${Number(to.lat)}`;
  const params = new URLSearchParams({
    key: apiKey,
    steps: 'true',
    geometries: 'geojson',
    overview: 'full',
  });

  try {
    const response = await fetch(`${LOCATIONIQ_DIRECTIONS_BASE_URL}/${profile}/${coordinates}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`locationiq_directions_${response.status}`);
    }

    const payload = await response.json();
    const route = normalizeRouteResponse(payload);
    if (!route || route.coordinates.length < 2) {
      return buildStraightLineRoute(from, to);
    }
    return route;
  } catch {
    return buildStraightLineRoute(from, to);
  }
}
