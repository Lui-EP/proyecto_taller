export default function PageLoader({ text = 'Cargando...' }) {
    return (
        <div className="react-loader-wrap">
            <div className="react-loader-spinner" aria-hidden="true"></div>
            <p>{text}</p>
        </div>
    );
}
