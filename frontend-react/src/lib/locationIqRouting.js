const LOCATIONIQ_DIRECTIONS_BASE_URL = 'https://us1.locationiq.com/v1/directions';

export function isValidCoords(coords) {
    return Number.isFinite(Number(coords?.lat)) && Number.isFinite(Number(coords?.lng));
}

export function getLocationIqApiKey() {
    return String(import.meta.env.VITE_LOCATIONIQ_API_KEY || '').trim();
}

export function buildStraightLineRoute(from, to) {
    const points = [from, to]
        .filter(isValidCoords)
        .map((point) => ({
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
    const raw = String(step?.maneuver?.instruction || '').trim();
    if (raw) return raw;

    const maneuverType = String(step?.maneuver?.type || '').trim();
    const modifier = String(step?.maneuver?.modifier || '').trim();
    const roadName = String(step?.name || '').trim();

    const pieces = [maneuverType, modifier, roadName].filter(Boolean);
    if (pieces.length) return pieces.join(' ').replace(/\s+/g, ' ').trim();

    return '';
}

function normalizeRouteSteps(route) {
    const rawLegs = route?.legs;
    const legs = Array.isArray(rawLegs) ? rawLegs : rawLegs ? [rawLegs] : [];

    return legs
        .flatMap((leg) => (Array.isArray(leg?.steps) ? leg.steps : []))
        .map((step, index) => ({
            id: `step-${index + 1}`,
            instruction: normalizeInstruction(step),
            distanceMeters: Number.isFinite(Number(step?.distance)) ? Number(step.distance) : null,
            durationSeconds: Number.isFinite(Number(step?.duration)) ? Number(step.duration) : null,
        }))
        .filter((step) => step.instruction);
}

function normalizeRouteResponse(data) {
    const routeEntry = Array.isArray(data?.routes) ? data.routes[0] : data?.routes;
    if (!routeEntry) return null;

    const rawCoordinates = Array.isArray(routeEntry?.geometry?.coordinates)
        ? routeEntry.geometry.coordinates
        : [];

    const coordinates = rawCoordinates
        .map((pair) => ({
            lat: Number(Array.isArray(pair) ? pair[1] : null),
            lng: Number(Array.isArray(pair) ? pair[0] : null),
        }))
        .filter(isValidCoords);

    return {
        source: 'locationiq',
        coordinates,
        distanceMeters: Number.isFinite(Number(routeEntry?.distance)) ? Number(routeEntry.distance) : null,
        durationSeconds: Number.isFinite(Number(routeEntry?.duration)) ? Number(routeEntry.duration) : null,
        steps: normalizeRouteSteps(routeEntry),
    };
}

export async function fetchLocationIqRoute({ from, to, profile = 'driving' }) {
    if (!isValidCoords(from) || !isValidCoords(to)) {
        return buildStraightLineRoute(from, to);
    }

    const apiKey = getLocationIqApiKey();
    if (!apiKey) {
        throw new Error('locationiq_key_missing');
    }

    const coordinates = `${Number(from.lng)},${Number(from.lat)};${Number(to.lng)},${Number(to.lat)}`;
    const params = new URLSearchParams({
        key: apiKey,
        steps: 'true',
        geometries: 'geojson',
        overview: 'full',
    });

    const endpoint = `${LOCATIONIQ_DIRECTIONS_BASE_URL}/${profile}/${coordinates}?${params.toString()}`;
    const response = await fetch(endpoint, {
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`locationiq_directions_${response.status}`);
    }

    const data = await response.json();
    const route = normalizeRouteResponse(data);
    if (!route || route.coordinates.length < 2) {
        return buildStraightLineRoute(from, to);
    }

    return route;
}
