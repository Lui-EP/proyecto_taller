import { useEffect, useMemo, useRef, useState } from 'react';

function splitWords(text) {
    return String(text || '')
        .split(/(\s+)/)
        .filter((part) => part.length > 0);
}

export default function SplitText({
    text,
    as: Tag = 'h1',
    className = '',
    delay = 0,
    stagger = 28,
    once = true,
}) {
    const rootRef = useRef(null);
    const [visible, setVisible] = useState(false);
    const parts = useMemo(() => splitWords(text), [text]);

    useEffect(() => {
        const node = rootRef.current;
        if (!node) return undefined;

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (!entry) return;
                if (entry.isIntersecting) {
                    setVisible(true);
                    if (once) observer.disconnect();
                } else if (!once) {
                    setVisible(false);
                }
            },
            { threshold: 0.2 }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [once]);

    return (
        <Tag
            ref={rootRef}
            className={`split-text ${visible ? 'is-visible' : ''} ${className}`.trim()}
            style={{ '--split-delay': `${delay}ms`, '--split-stagger': `${stagger}ms` }}
            aria-label={text}
        >
            {parts.map((part, index) => {
                const isWhitespace = /^\s+$/.test(part);
                if (isWhitespace) {
                    return <span key={`space-${index}`}>{part}</span>;
                }
                return (
                    <span key={`${part}-${index}`} className="split-text-word" style={{ '--word-index': index }} aria-hidden="true">
                        {part}
                    </span>
                );
            })}
        </Tag>
    );
}

