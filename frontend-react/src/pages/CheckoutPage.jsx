import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';
import { resolveImageSrc } from '../lib/assets';
import PageLoader from '../components/PageLoader';
import SafeImage from '../components/SafeImage';

const CHIAPAS_VIEWBOX = '-94.600000,17.950000,-90.200000,14.450000';
const CHIAPAS_BOUNDS = [
    [14.45, -94.6],
    [17.95, -90.2],
];
const LOCATIONIQ_BASE_URL = 'https://us1.locationiq.com/v1';
const LOCAL_CHIAPAS_CITY_CENTERS = [
    {
        city: 'Tuxtla Gutierrez',
        aliases: ['tuxtla', 'tuxtla gutierrez'],
        lat: 16.7516,
        lng: -93.1166,
    },
    {
        city: 'Chiapa de Corzo',
        aliases: ['chiapa de corzo'],
        lat: 16.7076,
        lng: -93.011,
    },
    {
        city: 'San Cristobal de las Casas',
        aliases: ['san cristobal', 'san cristobal de las casas'],
        lat: 16.737,
        lng: -92.6376,
    },
    {
        city: 'Tapachula',
        aliases: ['tapachula'],
        lat: 14.9033,
        lng: -92.2575,
    },
];

const LOCAL_CHIAPAS_COLONY_CATALOG = [
    { id: 'tuxtla-bienestar-social', colony: 'Bienestar Social', aliases: ['bienestar social'], city: 'Tuxtla Gutierrez', lat: 16.744722, lng: -93.092917 },
    { id: 'tuxtla-24-junio', colony: '24 de Junio', aliases: ['24 de junio'], city: 'Tuxtla Gutierrez', lat: 16.7456, lng: -93.0942 },
    { id: 'tuxtla-santa-maria', colony: 'Santa Maria', aliases: ['santa maria'], city: 'Tuxtla Gutierrez', lat: 16.7463, lng: -93.0898 },
    { id: 'tuxtla-centro', colony: 'Centro', aliases: ['centro tuxtla', 'centro'], city: 'Tuxtla Gutierrez', lat: 16.7516, lng: -93.1166 },
    { id: 'tuxtla-teran', colony: 'Teran', aliases: ['teran'], city: 'Tuxtla Gutierrez', lat: 16.7592, lng: -93.1568 },
    { id: 'tuxtla-san-jose-teran', colony: 'San Jose Teran', aliases: ['san jose teran'], city: 'Tuxtla Gutierrez', lat: 16.7608, lng: -93.1529 },
    { id: 'tuxtla-plan-ayala', colony: 'Plan de Ayala', aliases: ['plan de ayala'], city: 'Tuxtla Gutierrez', lat: 16.7632, lng: -93.1451 },
    { id: 'tuxtla-las-granjas', colony: 'Las Granjas', aliases: ['las granjas', 'granjas'], city: 'Tuxtla Gutierrez', lat: 16.7722, lng: -93.1214 },
    { id: 'tuxtla-patria-nueva', colony: 'Patria Nueva', aliases: ['patria nueva'], city: 'Tuxtla Gutierrez', lat: 16.7797, lng: -93.109 },
    { id: 'tuxtla-albania-alta', colony: 'Albania Alta', aliases: ['albania alta'], city: 'Tuxtla Gutierrez', lat: 16.7729, lng: -93.0978 },
    { id: 'tuxtla-albania-baja', colony: 'Albania Baja', aliases: ['albania baja'], city: 'Tuxtla Gutierrez', lat: 16.7658, lng: -93.1034 },
    { id: 'tuxtla-xamaipak', colony: 'Xamaipak', aliases: ['xamaipak'], city: 'Tuxtla Gutierrez', lat: 16.7568, lng: -93.1429 },
    { id: 'tuxtla-moctezuma', colony: 'Moctezuma', aliases: ['moctezuma'], city: 'Tuxtla Gutierrez', lat: 16.7514, lng: -93.1294 },
    { id: 'tuxtla-las-palmas', colony: 'Las Palmas', aliases: ['las palmas'], city: 'Tuxtla Gutierrez', lat: 16.7478, lng: -93.1247 },
    { id: 'tuxtla-infonavit-grijalva', colony: 'Infonavit Grijalva', aliases: ['infonavit grijalva'], city: 'Tuxtla Gutierrez', lat: 16.7419, lng: -93.1036 },
    { id: 'tuxtla-retiro', colony: 'El Retiro', aliases: ['el retiro', 'retiro'], city: 'Tuxtla Gutierrez', lat: 16.7413, lng: -93.1135 },
    { id: 'tuxtla-potinaspak', colony: 'Potinaspak', aliases: ['potinaspak'], city: 'Tuxtla Gutierrez', lat: 16.7486, lng: -93.0998 },
    { id: 'tuxtla-laguitos', colony: 'Los Laguitos', aliases: ['los laguitos', 'laguitos'], city: 'Tuxtla Gutierrez', lat: 16.7893, lng: -93.1239 },
    { id: 'tuxtla-real-bosque', colony: 'Real del Bosque', aliases: ['real del bosque'], city: 'Tuxtla Gutierrez', lat: 16.8112, lng: -93.0912 },
    { id: 'tuxtla-arboledas', colony: 'Las Arboledas', aliases: ['las arboledas', 'arboledas'], city: 'Tuxtla Gutierrez', lat: 16.7687, lng: -93.1385 },
    { id: 'tuxtla-torres', colony: 'Las Torres', aliases: ['las torres', 'torres'], city: 'Tuxtla Gutierrez', lat: 16.739, lng: -93.1362 },
    { id: 'tuxtla-paso-limon', colony: 'Paso Limon', aliases: ['paso limon'], city: 'Tuxtla Gutierrez', lat: 16.7915, lng: -93.0962 },
    { id: 'tuxtla-diana-laura', colony: 'Diana Laura', aliases: ['diana laura'], city: 'Tuxtla Gutierrez', lat: 16.7862, lng: -93.0977 },
    { id: 'tuxtla-copoya', colony: 'Copoya', aliases: ['copoya'], city: 'Tuxtla Gutierrez', lat: 16.6907, lng: -93.1108 },
    { id: 'chiapa-bienestar-social', colony: 'Bienestar Social', aliases: ['bienestar social'], city: 'Chiapa de Corzo', lat: 16.742927, lng: -93.027281 },
    { id: 'chiapa-centro', colony: 'Centro', aliases: ['centro chiapa de corzo', 'centro'], city: 'Chiapa de Corzo', lat: 16.7076, lng: -93.011 },
    { id: 'chiapa-santa-elena', colony: 'Santa Elena', aliases: ['santa elena'], city: 'Chiapa de Corzo', lat: 16.7079, lng: -93.0183 },
    { id: 'chiapa-benito-juarez', colony: 'Benito Juarez', aliases: ['benito juarez'], city: 'Chiapa de Corzo', lat: 16.7111, lng: -93.0145 },
    { id: 'chiapa-revolucion', colony: 'Revolucion Mexicana', aliases: ['revolucion mexicana'], city: 'Chiapa de Corzo', lat: 16.7196, lng: -93.0194 },
    { id: 'chiapa-plan-chiapas', colony: 'Plan Chiapas', aliases: ['plan chiapas'], city: 'Chiapa de Corzo', lat: 16.7211, lng: -92.9953 },
    { id: 'chiapa-refugio', colony: 'El Refugio', aliases: ['el refugio', 'refugio'], city: 'Chiapa de Corzo', lat: 16.7035, lng: -93.0201 },
    { id: 'sancris-centro', colony: 'Centro', aliases: ['centro san cristobal', 'centro'], city: 'San Cristobal de las Casas', lat: 16.737, lng: -92.6376 },
    { id: 'sancris-guadalupe', colony: 'Barrio de Guadalupe', aliases: ['guadalupe'], city: 'San Cristobal de las Casas', lat: 16.7398, lng: -92.6315 },
    { id: 'sancris-mexicanos', colony: 'Barrio de Mexicanos', aliases: ['mexicanos'], city: 'San Cristobal de las Casas', lat: 16.7344, lng: -92.6402 },
    { id: 'tapachula-centro', colony: 'Centro', aliases: ['centro tapachula', 'centro'], city: 'Tapachula', lat: 14.9033, lng: -92.2575 },
    { id: 'tapachula-5-febrero', colony: '5 de Febrero', aliases: ['5 de febrero'], city: 'Tapachula', lat: 14.9019, lng: -92.2555 },
    { id: 'tapachula-los-llanos', colony: 'Los Llanos', aliases: ['los llanos'], city: 'Tapachula', lat: 14.9092, lng: -92.2697 },
];

const LOCAL_CHIAPAS_OVERRIDES = [
    {
        id: 'bienestar-social-chiapa-corzo',
        patterns: [/bienestar social/i, /chiapa de corzo/i],
        lat: 16.742927,
        lng: -93.027281,
        colony: 'Bienestar Social',
        subdivision: '',
        city: 'Chiapa de Corzo',
    },
    {
        id: 'bienestar-social-tuxtla',
        patterns: [/bienestar social/i, /(tuxtla|miguel hidalgo|santa maria|12 de octubre)/i],
        lat: 16.744722,
        lng: -93.092917,
        colony: 'Bienestar Social',
        subdivision: '',
        city: 'Tuxtla Gutierrez',
    },
];

export default function CheckoutPage() {
    const mercado = useMemo(() => getMercadoLocal(), []);
    const session = useSession();
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [deliveryMethod, setDeliveryMethod] = useState('delivery');
    const [pickupSellerId, setPickupSellerId] = useState('');
    const [customer, setCustomer] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
    });
    const [customerLocation, setCustomerLocation] = useState(null);
    const [locationStatus, setLocationStatus] = useState('idle');
    const [detectedAddress, setDetectedAddress] = useState('');
    const [detectedColony, setDetectedColony] = useState('');
    const [detectedSubdivision, setDetectedSubdivision] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
    const [suggestionsSource, setSuggestionsSource] = useState('');
    const [googlePlacesReady, setGooglePlacesReady] = useState(false);
    const locationIqApiKey = String(import.meta.env.VITE_LOCATIONIQ_API_KEY || '').trim();

    const checkoutMapContainerRef = useRef(null);
    const checkoutMapRef = useRef(null);
    const checkoutMarkerRef = useRef(null);
    const geocodeDebounceRef = useRef(null);
    const geocodeRequestIdRef = useRef(0);
    const manualAddressDebounceRef = useRef(null);
    const manualAddressRequestIdRef = useRef(0);
    const suppressManualGeocodeRef = useRef(false);
    const pinAnimationTimerRef = useRef(null);
    const googleMapsRef = useRef(null);
    const googleAutocompleteRef = useRef(null);
    const googlePlacesServiceRef = useRef(null);
    const searchAddressLocationRef = useRef(null);
    const scheduleGeoDetailsUpdateRef = useRef(null);

    const extractAddressZones = (address) => {
        const addr = address || {};
        const colony = String(
            addr.neighbourhood
            || addr.suburb
            || addr.residential
            || addr.quarter
            || addr.hamlet
            || addr.village
            || ''
        ).trim();

        const subdivisionFromName = [
            addr.suburb,
            addr.neighbourhood,
            addr.residential,
            addr.quarter,
            addr.city_district,
            addr.borough,
            addr.allotments,
        ]
            .map((value) => String(value || '').trim())
            .find((value) => /(fracc\.?|fraccionamiento|residencial)/i.test(value)) || '';

        const subdivision = String(
            subdivisionFromName
            || addr.city_district
            || addr.borough
            || addr.allotments
            || ''
        ).trim();

        return { colony, subdivision };
    };

    const reverseGeocodeLocationIq = async (lat, lng) => {
        if (!locationIqApiKey) {
            throw new Error('locationiq_key_missing');
        }

        const params = new URLSearchParams({
            key: locationIqApiKey,
            format: 'json',
            lat: String(lat),
            lon: String(lng),
            addressdetails: '1',
            normalizecity: '1',
            'accept-language': 'es',
        });
        const endpoint = `${LOCATIONIQ_BASE_URL}/reverse.php?${params.toString()}`;
        const response = await fetch(endpoint, {
            headers: {
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error('locationiq_reverse_error');
        }

        const data = await response.json();
        const display = String(data?.display_name || '').trim();
        if (!display) {
            throw new Error('locationiq_empty_reverse');
        }

        const zones = extractAddressZones(data?.address);
        return { display, colony: zones.colony, subdivision: zones.subdivision, source: 'locationiq' };
    };

    const reverseGeocodeNominatim = async (lat, lng) => {
        const endpoint = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=es&addressdetails=1&zoom=18`;
        const response = await fetch(endpoint, {
            headers: {
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('nominatim_reverse_error');
        }

        const data = await response.json();
        const display = String(data?.display_name || '').trim();
        if (!display) {
            throw new Error('nominatim_empty_reverse');
        }

        const zones = extractAddressZones(data?.address);
        return { display, colony: zones.colony, subdivision: zones.subdivision, source: 'nominatim' };
    };

    const reverseGeocodeAddress = async (lat, lng) => {
        if (locationIqApiKey) {
            try {
                return await reverseGeocodeLocationIq(lat, lng);
            } catch {
                // Fallback below.
            }
        }
        return reverseGeocodeNominatim(lat, lng);
    };

    const normalizeForMatch = (value) => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const loadGooglePlacesSdk = () => new Promise((resolve, reject) => {
        if (window.google?.maps?.places) {
            resolve(window.google.maps);
            return;
        }

        const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
        if (!apiKey) {
            reject(new Error('missing_google_key'));
            return;
        }

        const existing = document.querySelector('script[data-google-places="true"]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.google?.maps));
            existing.addEventListener('error', () => reject(new Error('google_places_load_error')));
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=es&region=MX&v=weekly`;
        script.async = true;
        script.defer = true;
        script.dataset.googlePlaces = 'true';
        script.onload = () => {
            if (window.google?.maps?.places) {
                resolve(window.google.maps);
                return;
            }
            reject(new Error('google_places_not_ready'));
        };
        script.onerror = () => reject(new Error('google_places_load_error'));
        document.head.appendChild(script);
    });

    const parseGoogleAddressParts = (components = []) => {
        const findByTypes = (typeList) => {
            const item = components.find((part) => (part.types || []).some((type) => typeList.includes(type)));
            return String(item?.long_name || '').trim();
        };

        return {
            colony: findByTypes(['neighborhood', 'sublocality_level_1', 'sublocality', 'political']),
            subdivision: findByTypes(['sublocality_level_2', 'administrative_area_level_3', 'administrative_area_level_4']),
        };
    };

    const extractAddressHints = (value) => {
        const raw = String(value || '').replace(/\n+/g, ', ').replace(/\s+/g, ' ').trim();
        const normalized = normalizeForMatch(raw);
        const colonyMatch = raw.match(/colonia\s+([^,]+)/i);
        const subdivisionMatch = raw.match(/fraccionamiento\s+([^,]+)/i) || raw.match(/fracc\.?\s+([^,]+)/i);
        const betweenMatch = raw.match(/entre\s+([^,]+?)\s+y\s+([^,]+?)(?:,|$)/i);
        const implicitZoneMatch = raw.match(/,\s*([^,]+?)\s+entre\s+/i);
        const baseAddress = raw
            .replace(/entre\s+[^,]+?\s+y\s+[^,]+/i, '')
            .replace(/\s*,\s*,/g, ',')
            .replace(/\s+,/g, ',')
            .replace(/,\s*$/, '')
            .trim();

        const cityHint = normalized.includes('tuxtla') ? 'tuxtla gutierrez'
            : normalized.includes('san cristobal') ? 'san cristobal de las casas'
            : normalized.includes('tapachula') ? 'tapachula'
            : normalized.includes('chiapa de corzo') ? 'chiapa de corzo'
            : '';

        const primaryTokens = normalized
            .split(/[,\s]+/)
            .filter((token) => token.length >= 4 && !['chiapas', 'mexico', 'calle', 'avenida', 'colonia', 'fraccionamiento'].includes(token))
            .slice(0, 5);

        const crossStreetA = betweenMatch ? String(betweenMatch[1] || '').trim() : '';
        const crossStreetB = betweenMatch ? String(betweenMatch[2] || '').trim() : '';
        const toTokenList = (text) => normalizeForMatch(text)
            .split(/[,\s]+/)
            .filter((token) => token.length >= 3 && !['calle', 'avenida', 'av', 'de', 'del', 'la', 'el', 'y', 'con', 'entre'].includes(token));

        return {
            raw,
            baseAddress,
            colony: colonyMatch ? colonyMatch[1].trim() : (implicitZoneMatch ? implicitZoneMatch[1].trim() : ''),
            subdivision: subdivisionMatch ? subdivisionMatch[1].trim() : '',
            crossStreetA,
            crossStreetB,
            crossStreetATokens: toTokenList(crossStreetA),
            crossStreetBTokens: toTokenList(crossStreetB),
            cityHint,
            primaryTokens,
        };
    };

    const fetchLocationIqCandidates = async (query, bounded = true, mode = 'search') => {
        if (!locationIqApiKey) {
            return [];
        }

        const params = new URLSearchParams({
            key: locationIqApiKey,
            q: query,
            format: 'json',
            addressdetails: '1',
            normalizecity: '1',
            countrycodes: 'mx',
            limit: '6',
            'accept-language': 'es',
        });

        if (bounded) {
            params.set('viewbox', CHIAPAS_VIEWBOX);
            params.set('bounded', '1');
        }

        const endpoint = `${LOCATIONIQ_BASE_URL}/${mode === 'autocomplete' ? 'autocomplete.php' : 'search.php'}?${params.toString()}`;
        const response = await fetch(endpoint, {
            headers: {
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error('locationiq_search_error');
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
    };

    const fetchNominatimCandidates = async (query, bounded = true) => {
        const params = new URLSearchParams({
            format: 'jsonv2',
            q: query,
            'accept-language': 'es',
            limit: '6',
            addressdetails: '1',
            countrycodes: 'mx',
        });

        if (bounded) {
            params.set('viewbox', CHIAPAS_VIEWBOX);
            params.set('bounded', '1');
        }

        const endpoint = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
        const response = await fetch(endpoint, {
            headers: {
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error('No se pudo buscar direccion');
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    };

    const scoreCandidate = (candidate, hints) => {
        const display = normalizeForMatch(candidate?.display_name || candidate?.display_place || candidate?.name || '');
        let score = Number(candidate?.importance || 0);

        if (display.includes('chiapas')) score += 5;
        if (display.includes('mexico')) score += 1;
        if (hints.cityHint && display.includes(normalizeForMatch(hints.cityHint))) score += 5;
        if (hints.colony && display.includes(normalizeForMatch(hints.colony))) score += 10;
        if (hints.subdivision && display.includes(normalizeForMatch(hints.subdivision))) score += 10;
        if (hints.crossStreetA && display.includes(normalizeForMatch(hints.crossStreetA))) score += 6;
        if (hints.crossStreetB && display.includes(normalizeForMatch(hints.crossStreetB))) score += 6;

        const crossAMatches = hints.crossStreetATokens.filter((token) => display.includes(token)).length;
        const crossBMatches = hints.crossStreetBTokens.filter((token) => display.includes(token)).length;
        score += crossAMatches * 1.2;
        score += crossBMatches * 1.2;
        if (crossAMatches > 0 && crossBMatches > 0) score += 4;

        for (const token of hints.primaryTokens) {
            if (display.includes(token)) score += 1.4;
        }

        return score;
    };

    const mapCandidateToLocation = (candidate, source = 'nominatim') => {
        const lat = Number(candidate?.lat);
        const lng = Number(candidate?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const zones = extractAddressZones(candidate?.address);
        const display = String(
            candidate?.display_name
            || candidate?.display_place
            || candidate?.name
            || ''
        ).trim();

        return {
            lat,
            lng,
            display,
            colony: zones.colony,
            subdivision: zones.subdivision,
            source,
        };
    };

    const getGooglePredictions = (input) => new Promise((resolve, reject) => {
        const service = googleAutocompleteRef.current;
        const mapsApi = googleMapsRef.current;
        if (!service || !mapsApi?.places) {
            reject(new Error('google_not_ready'));
            return;
        }

        const request = {
            input,
            componentRestrictions: { country: 'mx' },
            locationBias: new mapsApi.Circle({
                center: { lat: 16.75, lng: -93.11 },
                radius: 260000,
            }),
            types: ['geocode'],
        };

        service.getPlacePredictions(request, (predictions, status) => {
            if (status === mapsApi.places.PlacesServiceStatus.OK) {
                resolve(Array.isArray(predictions) ? predictions : []);
                return;
            }
            if (status === mapsApi.places.PlacesServiceStatus.ZERO_RESULTS) {
                resolve([]);
                return;
            }
            reject(new Error(String(status || 'google_prediction_error')));
        });
    });

    const resolveGooglePlace = (placeId) => new Promise((resolve, reject) => {
        const service = googlePlacesServiceRef.current;
        const mapsApi = googleMapsRef.current;
        if (!service || !mapsApi?.places) {
            reject(new Error('google_not_ready'));
            return;
        }

        service.getDetails(
            {
                placeId,
                fields: ['formatted_address', 'geometry.location', 'address_components', 'name'],
            },
            (place, status) => {
                if (status !== mapsApi.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
                    reject(new Error(String(status || 'google_place_details_error')));
                    return;
                }

                const lat = Number(place.geometry.location.lat());
                const lng = Number(place.geometry.location.lng());
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    reject(new Error('google_place_invalid_coords'));
                    return;
                }

                const parsed = parseGoogleAddressParts(place.address_components || []);
                resolve({
                    lat,
                    lng,
                    display: String(place.formatted_address || place.name || '').trim(),
                    colony: parsed.colony || '',
                    subdivision: parsed.subdivision || '',
                    source: 'google',
                });
            }
        );
    });

    const findLocalOverride = (rawQuery, hints) => {
        const safe = String(rawQuery || '').trim();
        if (!safe) return null;
        const normalizedRaw = normalizeForMatch(safe);
        const normalizedCityHint = normalizeForMatch(hints?.cityHint || '');
        const normalizedColonyHint = normalizeForMatch(hints?.colony || '');
        const normalizedSubdivisionHint = normalizeForMatch(hints?.subdivision || '');

        const buildDisplay = (zoneName, cityName) => (hints?.baseAddress
            ? `${hints.baseAddress}, ${zoneName}, ${cityName}, Chiapas, Mexico`
            : `${zoneName}, ${cityName}, Chiapas, Mexico`);

        const pickCityCenter = () => {
            let best = LOCAL_CHIAPAS_CITY_CENTERS[0];
            let bestScore = -1;
            for (const center of LOCAL_CHIAPAS_CITY_CENTERS) {
                let score = 0;
                for (const alias of center.aliases || []) {
                    const normalizedAlias = normalizeForMatch(alias);
                    if (!normalizedAlias) continue;
                    if (normalizedRaw.includes(normalizedAlias)) score += 6;
                    if (normalizedCityHint.includes(normalizedAlias)) score += 10;
                }
                if (score > bestScore) {
                    bestScore = score;
                    best = center;
                }
            }
            return best;
        };

        for (const item of LOCAL_CHIAPAS_OVERRIDES) {
            const matches = (item.patterns || []).every((pattern) => pattern.test(safe));
            if (!matches) continue;

            return {
                lat: Number(item.lat),
                lng: Number(item.lng),
                display: buildDisplay(item.colony, item.city),
                colony: item.colony || '',
                subdivision: item.subdivision || '',
                score: 999,
                source: 'local_override',
            };
        }

        const preferredCenter = pickCityCenter();
        const mentionedCities = LOCAL_CHIAPAS_CITY_CENTERS.filter((center) => (center.aliases || [])
            .some((alias) => normalizedRaw.includes(normalizeForMatch(alias))))
            .map((center) => normalizeForMatch(center.city));

        let bestCatalogMatch = null;
        for (const item of LOCAL_CHIAPAS_COLONY_CATALOG) {
            const aliases = Array.isArray(item.aliases) && item.aliases.length ? item.aliases : [item.colony];
            let aliasScore = 0;

            for (const alias of aliases) {
                const normalizedAlias = normalizeForMatch(alias);
                if (!normalizedAlias) continue;
                if (normalizedRaw.includes(normalizedAlias)) {
                    aliasScore = Math.max(aliasScore, 26 + Math.min(normalizedAlias.length, 18));
                }
                if (normalizedColonyHint && normalizedColonyHint.includes(normalizedAlias)) {
                    aliasScore = Math.max(aliasScore, 42);
                }
                if (normalizedSubdivisionHint && normalizedSubdivisionHint.includes(normalizedAlias)) {
                    aliasScore = Math.max(aliasScore, 36);
                }
            }

            if (!aliasScore) continue;

            let score = aliasScore;
            const itemCityNormalized = normalizeForMatch(item.city);
            const cityMatchedInQuery = normalizedRaw.includes(itemCityNormalized) || normalizedCityHint.includes(itemCityNormalized);
            const cityMatchesPreferred = itemCityNormalized === normalizeForMatch(preferredCenter?.city || '');

            if (cityMatchedInQuery) score += 22;
            else if (cityMatchesPreferred) score += 10;
            else score -= 4;

            if (mentionedCities.length && !mentionedCities.includes(itemCityNormalized)) {
                score -= 18;
            }

            if (!bestCatalogMatch || score > bestCatalogMatch.matchScore) {
                bestCatalogMatch = { ...item, matchScore: score };
            }
        }

        if (bestCatalogMatch) {
            return {
                lat: Number(bestCatalogMatch.lat),
                lng: Number(bestCatalogMatch.lng),
                display: buildDisplay(bestCatalogMatch.colony, bestCatalogMatch.city),
                colony: bestCatalogMatch.colony || '',
                subdivision: '',
                score: 840 + Number(bestCatalogMatch.matchScore || 0),
                source: 'local_catalog',
            };
        }

        const genericZone = String(hints?.colony || hints?.subdivision || '').trim();
        if (genericZone) {
            const center = preferredCenter || LOCAL_CHIAPAS_CITY_CENTERS[0];
            return {
                lat: Number(center.lat),
                lng: Number(center.lng),
                display: buildDisplay(genericZone, center.city),
                colony: String(hints?.colony || genericZone),
                subdivision: String(hints?.subdivision || ''),
                score: 5,
                source: 'local_guess',
            };
        }

        return null;
    };

    const searchAddressLocation = async (query) => {
        const hints = extractAddressHints(query);
        const preferredCity = hints.cityHint || 'chiapa de corzo';
        const localOverride = findLocalOverride(hints.raw, hints);
        const queries = [];
        const seen = new Set();
        const pushQuery = (text) => {
            const safe = String(text || '').trim();
            if (!safe) return;
            const key = normalizeForMatch(safe);
            if (seen.has(key)) return;
            seen.add(key);
            queries.push(safe);
        };

        if (hints.crossStreetA && hints.crossStreetB) {
            pushQuery(`${hints.crossStreetA} y ${hints.crossStreetB}, ${hints.colony || hints.subdivision || ''}, ${preferredCity}, Chiapas, Mexico`);
            pushQuery(`esquina ${hints.crossStreetA} con ${hints.crossStreetB}, ${hints.colony || ''}, ${preferredCity}, Chiapas, Mexico`);
        }

        if (hints.colony) {
            pushQuery(`colonia ${hints.colony}, ${hints.baseAddress || hints.raw}, ${preferredCity}, Chiapas, Mexico`);
            pushQuery(`colonia ${hints.colony}, ${preferredCity}, Chiapas, Mexico`);
        }
        if (hints.subdivision) {
            pushQuery(`fraccionamiento ${hints.subdivision}, ${hints.baseAddress || hints.raw}, ${preferredCity}, Chiapas, Mexico`);
            pushQuery(`fraccionamiento ${hints.subdivision}, ${preferredCity}, Chiapas, Mexico`);
        }

        if (hints.baseAddress) {
            pushQuery(`${hints.baseAddress}, ${hints.colony || ''}, ${preferredCity}, Chiapas, Mexico`);
        }

        pushQuery(`${hints.raw}, Chiapas, Mexico`);
        pushQuery(hints.raw);

        const allCandidates = [];
        for (const text of queries) {
            const queryCandidates = [];

            if (locationIqApiKey) {
                try {
                    const boundedLocationIq = await fetchLocationIqCandidates(text, true, 'search');
                    queryCandidates.push(...boundedLocationIq.map((item) => ({ item, source: 'locationiq' })));

                    if (queryCandidates.length < 3) {
                        const fallbackLocationIq = await fetchLocationIqCandidates(text, false, 'search');
                        queryCandidates.push(...fallbackLocationIq.map((item) => ({ item, source: 'locationiq' })));
                    }

                    if (queryCandidates.length < 3) {
                        const autoLocationIq = await fetchLocationIqCandidates(text, true, 'autocomplete');
                        queryCandidates.push(...autoLocationIq.map((item) => ({ item, source: 'locationiq' })));
                    }
                } catch {
                    // Continue with OpenStreetMap fallback.
                }
            }

            if (!locationIqApiKey || queryCandidates.length < 2) {
                try {
                    const boundedNominatim = await fetchNominatimCandidates(text, true);
                    queryCandidates.push(...boundedNominatim.map((item) => ({ item, source: 'nominatim' })));
                    if (queryCandidates.length < 3) {
                        const fallbackNominatim = await fetchNominatimCandidates(text, false);
                        queryCandidates.push(...fallbackNominatim.map((item) => ({ item, source: 'nominatim' })));
                    }
                } catch {
                    // Continue with next strategy.
                }
            }

            allCandidates.push(...queryCandidates);
            if (allCandidates.length >= 24) break;
        }

        const deduped = [];
        const candidateSeen = new Set();
        for (const candidate of allCandidates) {
            const item = candidate?.item || {};
            const source = String(candidate?.source || 'nominatim');
            const key = `${source}:${String(item?.place_id || '')}:${String(item?.lat || '')}:${String(item?.lon || '')}:${normalizeForMatch(item?.display_name || item?.display_place || item?.name || '')}`;
            if (candidateSeen.has(key)) continue;
            candidateSeen.add(key);
            deduped.push({ item, source });
        }

        if (!deduped.length && !localOverride) {
            throw new Error('Sin resultados');
        }

        const ranked = deduped
            .map(({ item, source }) => ({ item, source, score: scoreCandidate(item, hints) }))
            .sort((a, b) => b.score - a.score);

        const mapped = ranked
            .map(({ item, score, source }) => {
                const parsed = mapCandidateToLocation(item, source);
                if (!parsed) return null;
                return { ...parsed, score };
            })
            .filter(Boolean);

        if (!mapped.length && !localOverride) {
            throw new Error('Coordenadas invalidas');
        }

        if (localOverride) {
            const merged = [localOverride, ...mapped]
                .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
                .slice(0, 5);
            return {
                best: merged[0],
                suggestions: merged,
            };
        }

        return {
            best: mapped[0],
            suggestions: mapped.slice(0, 5),
        };
    };

    const animateCheckoutPin = () => {
        const markerRoot = checkoutMarkerRef.current?.getElement?.();
        const pin = markerRoot?.querySelector?.('.checkout-pin');
        if (!pin) return;

        pin.classList.remove('pin-bounce');
        if (pinAnimationTimerRef.current) {
            window.clearTimeout(pinAnimationTimerRef.current);
            pinAnimationTimerRef.current = null;
        }

        void pin.offsetWidth;
        pin.classList.add('pin-bounce');

        pinAnimationTimerRef.current = window.setTimeout(() => {
            pin.classList.remove('pin-bounce');
            pinAnimationTimerRef.current = null;
        }, 420);
    };

    const formatAddressFromGeo = (mainAddress, colony, subdivision) => {
        const lines = [];
        const safeMain = String(mainAddress || '').trim();
        const safeColony = String(colony || '').trim();
        const safeSubdivision = String(subdivision || '').trim();

        if (safeMain) lines.push(safeMain);
        if (safeColony) lines.push(`Colonia: ${safeColony}`);
        if (safeSubdivision && safeSubdivision.toLowerCase() !== safeColony.toLowerCase()) {
            lines.push(`Fraccionamiento: ${safeSubdivision}`);
        }

        return lines.join('\n');
    };

    const applyGeoDetailsToAddress = async (coords, showToast = true, overwriteAddress = true) => {
        try {
            const resolved = await reverseGeocodeAddress(coords.lat, coords.lng);
            const resolvedAddress = resolved.display;
            const resolvedColony = resolved.colony;
            const resolvedSubdivision = resolved.subdivision;
            const fullAddress = formatAddressFromGeo(resolvedAddress, resolvedColony, resolvedSubdivision);

            setDetectedAddress(resolvedAddress);
            setDetectedColony(resolvedColony);
            setDetectedSubdivision(resolvedSubdivision);

            if (fullAddress && overwriteAddress) {
                suppressManualGeocodeRef.current = true;
                setCustomer((prev) => ({ ...prev, address: fullAddress }));
            }

            if (showToast) {
                mercado.showToast('Ubicacion y direccion obtenidas');
            }
            return true;
        } catch {
            setDetectedAddress('');
            setDetectedColony('');
            setDetectedSubdivision('');

            setCustomer((prev) => {
                const currentAddress = String(prev.address || '').trim();
                if (!currentAddress) {
                    return { ...prev, address: 'No se pudo detectar la direccion automaticamente. Escribe tu direccion completa.' };
                }
                return prev;
            });

            if (showToast) {
                mercado.showToast('Ubicacion obtenida, pero no se pudo convertir a direccion', 'error');
            }
            return false;
        }
    };

    const scheduleGeoDetailsUpdate = (coords) => {
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
        setSuggestionsSource('');
        if (geocodeDebounceRef.current) {
            window.clearTimeout(geocodeDebounceRef.current);
            geocodeDebounceRef.current = null;
        }

        const requestId = geocodeRequestIdRef.current + 1;
        geocodeRequestIdRef.current = requestId;
        setLocationStatus('requesting');

        geocodeDebounceRef.current = window.setTimeout(async () => {
            const success = await applyGeoDetailsToAddress(coords, false);
            if (geocodeRequestIdRef.current !== requestId) return;
            setLocationStatus(success ? 'granted' : 'error');
        }, 420);
    };

    searchAddressLocationRef.current = searchAddressLocation;
    scheduleGeoDetailsUpdateRef.current = scheduleGeoDetailsUpdate;

    const applyAddressSuggestion = async (suggestion) => {
        let resolved = suggestion;
        if (suggestion?.source === 'google' && suggestion?.placeId) {
            setLocationStatus('requesting');
            try {
                resolved = await resolveGooglePlace(suggestion.placeId);
            } catch {
                setLocationStatus('error');
                mercado.showToast('No se pudo cargar esa sugerencia', 'error');
                return;
            }
        }

        const nextCoords = {
            lat: Number(resolved?.lat),
            lng: Number(resolved?.lng),
        };
        if (!Number.isFinite(nextCoords.lat) || !Number.isFinite(nextCoords.lng)) return;

        const fullAddress = formatAddressFromGeo(
            resolved?.display || '',
            resolved?.colony || '',
            resolved?.subdivision || ''
        );

        setCustomerLocation({
            lat: Number(nextCoords.lat.toFixed(6)),
            lng: Number(nextCoords.lng.toFixed(6)),
        });
        setDetectedAddress(resolved?.display || '');
        setDetectedColony(resolved?.colony || '');
        setDetectedSubdivision(resolved?.subdivision || '');

        if (fullAddress) {
            suppressManualGeocodeRef.current = true;
            setCustomer((prev) => ({ ...prev, address: fullAddress }));
        }

        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
        setSuggestionsSource('');
        setLocationStatus('granted');
        animateCheckoutPin();
        mercado.showToast('Sugerencia aplicada');
    };

    const loadCart = useCallback(async () => {
        setLoading(true);
        try {
            const list = await mercado.getCartDetailedItems();
            setItems(list);
        } catch {
            setItems([]);
            mercado.showToast('No se pudo cargar el carrito', 'error');
        } finally {
            setLoading(false);
        }
    }, [mercado]);

    useEffect(() => {
        void loadCart();
    }, [loadCart]);

    useEffect(() => {
        if (!session.user) return;
        
        const rawPhone = String(session.user.phone || session.user.seller_profile?.phone || '');
        const cleanPhone = rawPhone.replace(/\D/g, '').slice(0, 10);
        
        setCustomer((prev) => ({
            ...prev,
            name: session.user.name || '',
            email: session.user.email || '',
            phone: cleanPhone,
        }));
    }, [session.user]);

    useEffect(() => {
        let cancelled = false;

        loadGooglePlacesSdk()
            .then((mapsApi) => {
                if (cancelled || !mapsApi?.places) return;
                googleMapsRef.current = mapsApi;
                googleAutocompleteRef.current = new mapsApi.places.AutocompleteService();
                googlePlacesServiceRef.current = new mapsApi.places.PlacesService(document.createElement('div'));
                setGooglePlacesReady(true);
            })
            .catch(() => {
                if (cancelled) return;
                setGooglePlacesReady(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (deliveryMethod !== 'delivery') {
            setAddressSuggestions([]);
            setShowAddressSuggestions(false);
            setSuggestionsSource('');
            setLocationStatus('idle');
            return;
        }

        const rawAddress = String(customer.address || '').trim();
        if (!rawAddress) {
            setAddressSuggestions([]);
            setShowAddressSuggestions(false);
            setSuggestionsSource('');
            return;
        }

        if (suppressManualGeocodeRef.current) {
            suppressManualGeocodeRef.current = false;
            return;
        }

        if (rawAddress.length < 10) {
            setAddressSuggestions([]);
            setShowAddressSuggestions(false);
            setSuggestionsSource('');
            return;
        }

        if (manualAddressDebounceRef.current) {
            window.clearTimeout(manualAddressDebounceRef.current);
            manualAddressDebounceRef.current = null;
        }

        const requestId = manualAddressRequestIdRef.current + 1;
        manualAddressRequestIdRef.current = requestId;
        setLocationStatus('requesting');

        manualAddressDebounceRef.current = window.setTimeout(async () => {
            try {
                if (googlePlacesReady) {
                    const googlePredictions = await getGooglePredictions(rawAddress);
                    if (manualAddressRequestIdRef.current !== requestId) return;

                    if (googlePredictions.length) {
                        const googleSuggestions = googlePredictions.slice(0, 5).map((item) => ({
                            placeId: item.place_id,
                            display: String(item.description || item.structured_formatting?.main_text || '').trim(),
                            source: 'google',
                            lat: null,
                            lng: null,
                            colony: '',
                            subdivision: '',
                        }));

                        setAddressSuggestions(googleSuggestions);
                        setShowAddressSuggestions(true);
                        setSuggestionsSource('google');
                        setLocationStatus('idle');
                        return;
                    }
                }

                const searchFn = searchAddressLocationRef.current;
                if (!searchFn) {
                    setLocationStatus('idle');
                    return;
                }
                const result = await searchFn(rawAddress);
                if (manualAddressRequestIdRef.current !== requestId) return;

                const best = result.best;
                setCustomerLocation({
                    lat: Number(best.lat.toFixed(6)),
                    lng: Number(best.lng.toFixed(6)),
                });
                setDetectedAddress(best.display || rawAddress);
                setDetectedColony(best.colony || '');
                setDetectedSubdivision(best.subdivision || '');

                const alternativeSuggestions = (result.suggestions || [])
                    .filter((item, index) => index > 0)
                    .map((item) => ({
                        lat: Number(item.lat.toFixed(6)),
                        lng: Number(item.lng.toFixed(6)),
                        display: item.display || '',
                        colony: item.colony || '',
                        subdivision: item.subdivision || '',
                        source: item.source || '',
                    }));
                setAddressSuggestions(alternativeSuggestions);
                setShowAddressSuggestions(alternativeSuggestions.length > 0);
                const provider = String(result.best?.source || alternativeSuggestions[0]?.source || '');
                setSuggestionsSource(provider);
                setLocationStatus('granted');
            } catch {
                if (manualAddressRequestIdRef.current !== requestId) return;
                setAddressSuggestions([]);
                setShowAddressSuggestions(false);
                setSuggestionsSource('');
                setLocationStatus('idle');
            }
        }, 700);
    }, [customer.address, googlePlacesReady, deliveryMethod]);

    useEffect(() => {
        if (deliveryMethod !== 'delivery') return;
        if (!customerLocation || !checkoutMapContainerRef.current) return;

        const lat = Number(customerLocation.lat);
        const lng = Number(customerLocation.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        if (!checkoutMapRef.current) {
            const map = L.map(checkoutMapContainerRef.current, {
                attributionControl: false,
                maxBounds: CHIAPAS_BOUNDS,
                maxBoundsViscosity: 0.9,
            }).setView([lat, lng], 15);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
            map.setMaxBounds(CHIAPAS_BOUNDS);

            const icon = L.divIcon({
                className: 'courier-marker-wrap',
                html: '<div class="courier-marker checkout-pin">&#128205;</div>',
                iconSize: [52, 52],
                iconAnchor: [26, 40],
                popupAnchor: [0, -30],
            });

            const marker = L.marker([lat, lng], { icon }).addTo(map);

            map.on('click', (event) => {
                const nextPoint = event.latlng;
                const nextCoords = {
                    lat: Number(nextPoint.lat.toFixed(6)),
                    lng: Number(nextPoint.lng.toFixed(6)),
                };

                marker.setLatLng([nextCoords.lat, nextCoords.lng]);
                setCustomerLocation(nextCoords);
                scheduleGeoDetailsUpdateRef.current?.(nextCoords);
                animateCheckoutPin();
            });

            checkoutMapRef.current = map;
            checkoutMarkerRef.current = marker;

            window.setTimeout(() => {
                map.invalidateSize();
            }, 120);
        } else {
            checkoutMarkerRef.current?.setLatLng([lat, lng]);
            animateCheckoutPin();
            checkoutMapRef.current.flyTo([lat, lng], Math.max(checkoutMapRef.current.getZoom(), 15), {
                animate: true,
                duration: 1,
                easeLinearity: 0.25,
            });
        }
    }, [customerLocation, deliveryMethod]);


    useEffect(() => {
        if (deliveryMethod === 'delivery') return;
        if (checkoutMapRef.current) {
            checkoutMapRef.current.remove();
            checkoutMapRef.current = null;
            checkoutMarkerRef.current = null;
        }
    }, [deliveryMethod]);
    useEffect(() => () => {
        if (geocodeDebounceRef.current) {
            window.clearTimeout(geocodeDebounceRef.current);
            geocodeDebounceRef.current = null;
        }
        if (manualAddressDebounceRef.current) {
            window.clearTimeout(manualAddressDebounceRef.current);
            manualAddressDebounceRef.current = null;
        }
        if (pinAnimationTimerRef.current) {
            window.clearTimeout(pinAnimationTimerRef.current);
            pinAnimationTimerRef.current = null;
        }

        if (checkoutMapRef.current) {
            checkoutMapRef.current.remove();
            checkoutMapRef.current = null;
            checkoutMarkerRef.current = null;
        }
    }, []);

    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const isPickup = deliveryMethod === 'pickup';

    const pickupPoints = useMemo(() => {
        const map = new Map();

        items.forEach((item, index) => {
            const product = item.product || {};
            const sellerId = String(product.seller?.id || product.seller_id || `seller-${index}`);
            if (map.has(sellerId)) return;

            const sellerName = String(
                product.seller?.seller_profile?.business_name
                || product.seller?.name
                || product.seller_name
                || 'Vendedor'
            ).trim();

            const sellerLocation = String(product.seller?.seller_profile?.location || '').trim();

            map.set(sellerId, {
                id: sellerId,
                name: sellerName,
                location: sellerLocation || 'Ubicación de tienda por confirmar',
            });
        });

        return [...map.values()];
    }, [items]);

    useEffect(() => {
        if (!pickupPoints.length) {
            setPickupSellerId('');
            return;
        }

        if (!pickupPoints.some((point) => point.id === pickupSellerId)) {
            setPickupSellerId(pickupPoints[0].id);
        }
    }, [pickupPoints, pickupSellerId]);

    const selectedPickupPoint = useMemo(
        () => pickupPoints.find((point) => point.id === pickupSellerId) || pickupPoints[0] || null,
        [pickupPoints, pickupSellerId]
    );

    const requestCustomerLocation = () => {
        if (!navigator.geolocation) {
            setLocationStatus('unsupported');
            mercado.showToast('Tu navegador no soporta geolocalizacion', 'error');
            return;
        }

        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
        setSuggestionsSource('');
        setLocationStatus('requesting');
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const coords = {
                    lat: Number(position.coords.latitude),
                    lng: Number(position.coords.longitude),
                };
                setCustomerLocation(coords);
                const success = await applyGeoDetailsToAddress(coords, true);
                setLocationStatus(success ? 'granted' : 'error');
            },
            (error) => {
                if (error.code === 1) {
                    setLocationStatus('denied');
                    mercado.showToast('Permiso de ubicacion denegado', 'error');
                    return;
                }
                setLocationStatus('error');
                mercado.showToast('No se pudo obtener ubicacion', 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 0,
            }
        );
    };

    const changeQty = async (productId, delta) => {
        const current = items.find((item) => item.product.id === productId);
        if (!current) return;

        const maxStock = Math.max(1, Number(current.product.stock || 1));
        const next = Math.min(maxStock, Math.max(1, Number(current.quantity || 1) + delta));
        await mercado.updateCartItemQuantity(productId, next);
        session.syncState();
        await loadCart();
    };

    const removeItem = async (productId) => {
        await mercado.removeFromCart(productId);
        session.syncState();
        await loadCart();
    };

    const submitOrder = async (event) => {
        event.preventDefault();
        if (!items.length) {
            mercado.showToast('Tu carrito esta vacio', 'error');
            return;
        }
        if (String(customer.phone || '').trim().length !== 10) {
            mercado.showToast('El telefono debe tener exactamente 10 digitos', 'error');
            return;
        }
        if (isPickup && !selectedPickupPoint) {
            mercado.showToast('Selecciona una tienda para recoger', 'error');
            return;
        }

        const cleanAddress = String(customer.address || '').trim();
        if (!isPickup && !cleanAddress) {
            mercado.showToast('Escribe una direccion de entrega', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const pickupAddress = selectedPickupPoint
                ? `Recoger en tienda: ${selectedPickupPoint.name} - ${selectedPickupPoint.location}`
                : 'Recoger en tienda';
            const finalAddress = isPickup
                ? `${pickupAddress}${cleanAddress ? ` | Nota cliente: ${cleanAddress}` : ''}`
                : cleanAddress;

            const order = await mercado.OrdersAPI.create({
                customer: {
                    ...customer,
                    address: finalAddress,
                },
                location: !isPickup && customerLocation ? { ...customerLocation } : undefined,
                delivery_method: isPickup ? 'pickup' : 'delivery',
                pickup_point: isPickup && selectedPickupPoint ? { ...selectedPickupPoint } : undefined,
                items: items.map((item) => ({
                    product_id: item.product.id,
                    name: item.product.name,
                    quantity: Number(item.quantity || 1),
                    price: Number(item.product.price || 0),
                    image: item.product.images?.[0] || '',
                })),
                total: subtotal,
            });

            await mercado.clearCart();
            session.syncState();

            window.alert('Tu solicitud ha sido enviada por favor');

            const params = new URLSearchParams({ id: order.id });
            if (order.guest_token) params.set('token', order.guest_token);
            navigate(`/seguimiento-cliente?${params.toString()}`);
        } catch (error) {
            mercado.showToast(error.message || 'No se pudo confirmar el pedido', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <PageLoader text="Cargando pago..." />;
    }

    return (
        <div className="container checkout-react-page">
            <header className="checkout-header">
                <h1>Finalizar compra</h1>
                <p>Revisa tus productos y confirma tu pedido.</p>
            </header>

            {!session.user ? (
                <div className="guest-box">
                    <p>Estas comprando como invitado. Si te registras podras guardar historial y favoritos.</p>
                    <Link to="/registro" className="btn btn-secondary btn-sm">Registrarme</Link>
                </div>
            ) : null}

            <div className="checkout-layout">
                <section className="checkout-products">
                    <h2>Tu carrito</h2>
                    {!items.length ? (
                        <div className="empty-state">
                            <h3>Tu carrito esta vacio</h3>
                            <Link to="/catalogo" className="btn btn-primary">Ir al catalogo</Link>
                        </div>
                    ) : (
                        items.map((item) => (
                            <article key={item.product.id} className="checkout-item">
                                <SafeImage
                                    src={resolveImageSrc(item.product.images?.[0], mercado.createPlaceholderImage(item.product.name))}
                                    alt={item.product.name}
                                    fallback={mercado.createPlaceholderImage(item.product.name)}
                                    loading="lazy"
                                />
                                <div className="checkout-item-info">
                                    <h3>{item.product.name}</h3>
                                    <p>{mercado.formatPrice(item.product.price)} c/u</p>
                                    <p className="stock-note">Stock disponible: {item.product.stock || 0}</p>
                                    <div className="checkout-item-actions">
                                        <button type="button" onClick={() => changeQty(item.product.id, -1)}>-</button>
                                        <span>{item.quantity}</span>
                                        <button type="button" onClick={() => changeQty(item.product.id, 1)}>+</button>
                                        <button type="button" className="remove" onClick={() => removeItem(item.product.id)}>Quitar</button>
                                    </div>
                                </div>
                                <strong>{mercado.formatPrice(item.subtotal)}</strong>
                            </article>
                        ))
                    )}
                </section>

                <aside className="checkout-summary">
                    <h2>Resumen</h2>
                    <div className="summary-row"><span>Subtotal</span><strong>{mercado.formatPrice(subtotal)}</strong></div>
                    <div className="summary-row">
                        <span>{isPickup ? 'Recogida' : 'Envio'}</span>
                        <strong>{isPickup ? 'Recoges en tienda' : 'Coordinado con vendedor'}</strong>
                    </div>
                    <div className="summary-row total"><span>Total</span><strong>{mercado.formatPrice(subtotal)}</strong></div>

                    <form className="checkout-form" onSubmit={submitOrder}>
                        <label className="form-label">Nombre completo</label>
                        <input className="form-input" value={customer.name} onChange={(event) => setCustomer((prev) => ({ ...prev, name: event.target.value }))} required />

                        <label className="form-label">Correo</label>
                        <input className="form-input" type="email" value={customer.email} onChange={(event) => setCustomer((prev) => ({ ...prev, email: event.target.value }))} required />

                        <label className="form-label">Telefono</label>
                        <input className="form-input" type="tel" value={customer.phone} onChange={(event) => setCustomer((prev) => ({ ...prev, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} pattern="[0-9]{10}" maxLength="10" required />

                        <label className="form-label">Metodo de entrega</label>
                        <div className="delivery-method-row">
                            <button
                                type="button"
                                className={`delivery-method-btn ${deliveryMethod === 'delivery' ? 'is-active' : ''}`}
                                onClick={() => setDeliveryMethod('delivery')}
                            >
                                🚚 Entrega a domicilio
                            </button>
                            <button
                                type="button"
                                className={`delivery-method-btn ${deliveryMethod === 'pickup' ? 'is-active' : ''}`}
                                onClick={() => setDeliveryMethod('pickup')}
                            >
                                🏪 Recoger en tienda
                            </button>
                        </div>

                        {isPickup ? (
                            <div className="pickup-box">
                                <label className="form-label">Tienda para recoger</label>
                                <select
                                    className="form-input"
                                    value={pickupSellerId}
                                    onChange={(event) => setPickupSellerId(event.target.value)}
                                    required
                                >
                                    {pickupPoints.map((point) => (
                                        <option key={point.id} value={point.id}>
                                            {point.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="checkout-note">
                                    Dirección de recogida: <strong>{selectedPickupPoint?.location || 'Ubicación por confirmar'}</strong>
                                </p>
                                <p className="checkout-note">
                                    Se aparta tu producto por 2 horas. Si no pasas a recoger, la tienda puede liberar el apartado.
                                </p>
                                <label className="form-label">Nota para recoger (opcional)</label>
                                <textarea
                                    className="form-input form-textarea"
                                    value={customer.address}
                                    onChange={(event) => setCustomer((prev) => ({ ...prev, address: event.target.value }))}
                                    placeholder="Ejemplo: pasa mi hermana con INE, llego a las 6 pm"
                                />
                            </div>
                        ) : (
                            <>
                                <label className="form-label">Direccion de entrega</label>
                                <div className="checkout-location-row">
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        type="button"
                                        onClick={requestCustomerLocation}
                                        disabled={locationStatus === 'requesting'}
                                    >
                                        {locationStatus === 'requesting' ? 'Obteniendo...' : 'Usar mi ubicacion'}
                                    </button>
                                    <span className={`checkout-location-note ${customerLocation ? 'is-ok' : ''}`}>
                                        {locationStatus === 'requesting'
                                            ? 'Buscando direccion...'
                                            : detectedAddress
                                                ? detectedAddress
                                                : customerLocation
                                                    ? 'Ubicacion obtenida. Revisa la direccion antes de confirmar.'
                                                    : 'Opcional para ubicar mejor la entrega'}
                                    </span>
                                </div>

                                {(detectedColony || detectedSubdivision) ? (
                                    <div className="checkout-zone-list">
                                        {detectedColony ? <p className="checkout-colony-note">Colonia: {detectedColony}</p> : null}
                                        {detectedSubdivision ? <p className="checkout-subdivision-note">Fraccionamiento: {detectedSubdivision}</p> : null}
                                    </div>
                                ) : null}

                                <textarea
                                    className="form-input form-textarea"
                                    value={customer.address}
                                    onChange={(event) => setCustomer((prev) => ({ ...prev, address: event.target.value }))}
                                    required={deliveryMethod === 'delivery'}
                                />

                                {showAddressSuggestions && addressSuggestions.length ? (
                                    <div className="checkout-suggestions">
                                        <p className="checkout-suggestions-title">
                                            {suggestionsSource === 'google'
                                                ? 'Sugerencias de direccion (Google):'
                                                : suggestionsSource === 'locationiq'
                                                    ? 'Sugerencias de direccion (LocationIQ):'
                                                    : 'No es exacta. Elige una sugerencia cercana:'}
                                        </p>
                                        <div className="checkout-suggestions-list">
                                            {addressSuggestions.map((item, index) => (
                                                <button
                                                    key={`${item.placeId || `${item.lat}-${item.lng}`}-${index}`}
                                                    type="button"
                                                    className="checkout-suggestion-item"
                                                    onClick={() => { void applyAddressSuggestion(item); }}
                                                >
                                                    <span className="checkout-suggestion-main">{item.display || 'Ubicacion sugerida'}</span>
                                                    {(item.colony || item.subdivision) ? (
                                                        <span className="checkout-suggestion-sub">
                                                            {item.colony ? `Colonia: ${item.colony}` : ''}
                                                            {item.colony && item.subdivision ? ' | ' : ''}
                                                            {item.subdivision ? `Fraccionamiento: ${item.subdivision}` : ''}
                                                        </span>
                                                    ) : null}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {customerLocation ? (
                                    <div className="checkout-map-preview" aria-label="Vista previa del mapa de entrega">
                                        <p className="checkout-map-title">Vista previa de ubicacion</p>
                                        <div
                                            ref={checkoutMapContainerRef}
                                            className="checkout-map-frame courier-map"
                                            aria-label="Mapa de entrega"
                                        />
                                        <p className="checkout-map-helper">Haz clic en el mapa para mover el pin. Si escribes una direccion, el pin tambien se actualiza automaticamente.</p>
                                    </div>
                                ) : null}
                            </>
                        )}

                        <button className="btn btn-primary w-full" type="submit" disabled={submitting || !items.length}>
                            {submitting ? 'Confirmando...' : 'Confirmar compra'}
                        </button>
                    </form>
                </aside>
            </div>
        </div>
    );
}






