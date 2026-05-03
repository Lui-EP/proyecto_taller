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

function extractZones(address = {}) {
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

  return {
    colony: rawColony,
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
      const zones = extractZones(item.address);
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
  if (!hasLocationIqKey()) {
    return [];
  }

  try {
    const remoteSuggestions = await fetchLocationIqCandidates(cleanQuery);
    return dedupeSuggestions(remoteSuggestions).slice(0, 6);
  } catch {
    return [];
  }
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
      const zones = extractZones(payload.address);
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




