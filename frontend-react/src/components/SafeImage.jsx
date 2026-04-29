export default function SafeImage({
    src,
    alt,
    fallback,
    className,
    loading = 'lazy',
}) {
    const safeSrc = src || fallback || '';

    return (
        <img
            src={safeSrc}
            alt={alt}
            className={className}
            loading={loading}
            onError={(event) => {
                event.currentTarget.onerror = null;
                if (fallback) event.currentTarget.src = fallback;
            }}
        />
    );
}
