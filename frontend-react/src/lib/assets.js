export function resolveImageSrc(value, fallback = '') {
    const src = String(value || '').trim();
    if (!src) return fallback;

    if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://')) {
        return src;
    }

    if (src.startsWith('/')) return src;

    // Normaliza rutas legacy como img/productos/... para React.
    if (src.startsWith('img/')) return `/${src}`;

    return `/${src.replace(/^\.\//, '')}`;
}
