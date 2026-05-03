const services = [
    {
        title: 'Clientes',
        icon: '👤',
        description: 'Gestiona cuentas, autenticación y perfiles de compradores y administradores.',
    },
    {
        title: 'Pedidos',
        icon: '🧾',
        description: 'Controla creación, estado y trazabilidad completa del ciclo de compra.',
    },
    {
        title: 'Repartidores',
        icon: '🛵',
        description: 'Asigna rutas, seguimiento y entregas para operaciones de última milla.',
    },
    {
        title: 'Vendedores',
        icon: '🏪',
        description: 'Administra tiendas, inventario y flujo de ventas por cada comercio local.',
    },
    {
        title: 'Productos',
        icon: '📦',
        description: 'Publica catálogo, categorías, stock y datos clave para el marketplace.',
    },
];

const stack = ['Arquitectura de Microservicios', 'Docker', 'AWS EC2', 'PostgreSQL'];

export default function LandingPage() {
    const apiBaseUrl = String(import.meta.env.VITE_API_URL || 'https://mercado-local.ddns.net').trim();
    const exploreUrl = apiBaseUrl || 'https://mercado-local.ddns.net';

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-slate-100">
            <section className="mx-auto flex w-full max-w-6xl flex-col px-6 pb-16 pt-20 md:pt-28">
                <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-8 shadow-2xl shadow-black/25 backdrop-blur md:p-12">
                    <p className="mb-4 inline-flex rounded-full border border-blue-300/40 bg-blue-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
                        Plataforma cloud para comercio local
                    </p>
                    <h1 className="max-w-4xl text-balance text-3xl font-black leading-tight text-white md:text-5xl">
                        MercadoLocal: El futuro de tu negocio en la nube
                    </h1>
                    <p className="mt-5 max-w-3xl text-pretty text-base leading-relaxed text-slate-300 md:text-lg">
                        Conecta compradores, vendedores y repartidores con una infraestructura moderna, segura y escalable.
                        Automatiza pedidos, seguimiento y operación desde una sola plataforma.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-4">
                        <a
                            href={exploreUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-2xl bg-blue-500 px-7 py-4 text-base font-bold text-white transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                            Explorar Plataforma
                        </a>
                        <span className="text-sm text-slate-400">
                            Endpoint activo: <strong className="text-slate-200">{apiBaseUrl}</strong>
                        </span>
                    </div>
                </div>
            </section>

            <section className="mx-auto w-full max-w-6xl px-6 pb-14">
                <div className="mb-6 flex items-end justify-between gap-4">
                    <h2 className="text-2xl font-extrabold text-white md:text-3xl">Microservicios principales</h2>
                    <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                        5 servicios
                    </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map((service) => (
                        <article
                            key={service.title}
                            className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow-lg shadow-black/20"
                        >
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15 text-2xl">
                                <span aria-hidden="true">{service.icon}</span>
                            </div>
                            <h3 className="text-lg font-bold text-white">{service.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate-300">{service.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="mx-auto w-full max-w-6xl px-6 pb-24">
                <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-6 md:p-10">
                    <h2 className="text-2xl font-extrabold text-white md:text-3xl">Base técnica de la plataforma</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-200 md:text-base">
                        MercadoLocal opera sobre una arquitectura desacoplada orientada a escalabilidad, con despliegue
                        en AWS y servicios independientes para cada dominio del negocio.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        {stack.map((item) => (
                            <span
                                key={item}
                                className="rounded-full border border-emerald-300/40 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-emerald-100"
                            >
                                {item}
                            </span>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}