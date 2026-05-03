const services = [
    {
        title: 'Clientes',
        short: 'CL',
        description: 'Gestiona cuentas, autenticación y perfiles de compradores y administradores.',
        tone: 'from-[#F4E5CD] to-[#EBD8B7]',
    },
    {
        title: 'Pedidos',
        short: 'PD',
        description: 'Controla creación, estados y trazabilidad completa del ciclo de compra.',
        tone: 'from-[#F1DFC2] to-[#E6CC9D]',
    },
    {
        title: 'Repartidores',
        short: 'RP',
        description: 'Asigna rutas, seguimiento y entregas para operaciones de última milla.',
        tone: 'from-[#EFDCC0] to-[#DFC093]',
    },
    {
        title: 'Vendedores',
        short: 'VD',
        description: 'Administra tiendas, inventario y flujo de ventas por cada comercio local.',
        tone: 'from-[#F3E4CC] to-[#E8D0A7]',
    },
    {
        title: 'Productos',
        short: 'PR',
        description: 'Publica catálogo, categorías, stock y datos clave para el marketplace.',
        tone: 'from-[#F6E9D4] to-[#E9D1AA]',
    },
];

const stack = ['Arquitectura de Microservicios', 'Docker', 'AWS EC2', 'PostgreSQL'];

const highlights = [
    { label: 'Servicios', value: '5' },
    { label: 'Base de datos', value: 'PostgreSQL' },
    { label: 'Infraestructura', value: 'AWS EC2' },
];

export default function LandingPage() {
    const apiBaseUrl = String(import.meta.env.VITE_API_URL || 'https://mercado-local.ddns.net').trim();
    const healthUrl = `${apiBaseUrl || 'https://mercado-local.ddns.net'}/health`;
    const appUrl = '/inicio';

    return (
        <main className="min-h-screen overflow-hidden bg-gradient-to-b from-[#FBF5EA] via-[#F7EEDC] to-[#EEDFC5] text-[#4B3217]">
            <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(circle_at_top,#F2DDBA_0%,rgba(242,221,186,0)_68%)]" />

            <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-16 md:pt-24">
                <div className="grid items-center gap-8 rounded-[2rem] border border-[#D9BE94] bg-white/80 p-8 shadow-[0_24px_70px_-30px_rgba(168,106,42,0.45)] backdrop-blur md:grid-cols-[1.1fr_0.9fr] md:p-12">
                    <div>
                        <p className="mb-4 inline-flex rounded-full border border-[#D9BE94] bg-[#F8F1E3] px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#A86A2A]">
                            Plataforma cloud para comercio local
                        </p>
                        <h1 className="max-w-3xl text-balance text-3xl font-black leading-tight text-[#4B3217] md:text-5xl">
                            MercadoLocal: El futuro de tu negocio en la nube
                        </h1>
                        <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-[#6B4A27] md:text-lg">
                            Conecta compradores, vendedores y repartidores con una infraestructura moderna, segura y escalable.
                            Automatiza pedidos, seguimiento y operación desde una sola plataforma.
                        </p>

                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            <a
                                href={appUrl}
                                className="inline-flex items-center justify-center rounded-2xl bg-[#A86A2A] px-8 py-4 text-base font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#8D571F] hover:shadow-[0_14px_28px_-12px_rgba(141,87,31,0.65)] focus:outline-none focus:ring-2 focus:ring-[#D9BE94]"
                            >
                                Ir a la App
                            </a>
                            <a
                                href={healthUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center rounded-2xl border border-[#A86A2A] bg-white px-8 py-4 text-base font-bold text-[#A86A2A] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#F8F1E3] focus:outline-none focus:ring-2 focus:ring-[#D9BE94]"
                            >
                                Ver API Health
                            </a>
                            <span className="rounded-xl border border-[#E7D2AE] bg-[#FCF7EC] px-4 py-2 text-sm text-[#8C6840]">
                                Endpoint activo: <strong className="text-[#6B4A27]">{apiBaseUrl}</strong>
                            </span>
                        </div>
                    </div>

                    <aside className="grid gap-3 rounded-3xl border border-[#E4CFAB] bg-gradient-to-br from-[#FEFAF2] to-[#F2E2C4] p-5">
                        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-[#A86A2A]">Resumen técnico</h2>
                        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                            {highlights.map((item) => (
                                <div key={item.label} className="rounded-2xl border border-[#E0C69D] bg-white/75 p-4">
                                    <p className="text-xs uppercase tracking-wide text-[#9A7A4F]">{item.label}</p>
                                    <p className="mt-1 text-lg font-extrabold text-[#4B3217]">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </aside>
                </div>
            </section>

            <section className="mx-auto w-full max-w-6xl px-6 pb-14">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                    <h2 className="text-2xl font-extrabold text-[#4B3217] md:text-3xl">Microservicios principales</h2>
                    <span className="rounded-full border border-[#D9BE94] bg-[#F8F1E3] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#A86A2A]">
                        5 servicios activos
                    </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map((service) => (
                        <article
                            key={service.title}
                            className="group relative overflow-hidden rounded-2xl border border-[#D9BE94] bg-white p-5 shadow-[0_18px_38px_-24px_rgba(168,106,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_40px_-20px_rgba(168,106,42,0.5)]"
                        >
                            <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${service.tone} text-base font-black text-[#7D4D1B]`}>
                                {service.short}
                            </div>
                            <h3 className="text-lg font-bold text-[#4B3217]">{service.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-[#6B4A27]">{service.description}</p>
                            <div className="mt-4 h-1 w-14 rounded-full bg-[#D9BE94] transition-all duration-300 group-hover:w-24 group-hover:bg-[#A86A2A]" />
                        </article>
                    ))}
                </div>
            </section>

            <section className="mx-auto w-full max-w-6xl px-6 pb-24">
                <div className="rounded-[2rem] border border-[#D9BE94] bg-white/80 p-6 shadow-[0_18px_42px_-28px_rgba(168,106,42,0.45)] md:p-10">
                    <h2 className="text-2xl font-extrabold text-[#4B3217] md:text-3xl">Base técnica de la plataforma</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#6B4A27] md:text-base">
                        MercadoLocal opera sobre una arquitectura desacoplada orientada a escalabilidad, con despliegue
                        en AWS y servicios independientes para cada dominio del negocio.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        {stack.map((item) => (
                            <span
                                key={item}
                                className="rounded-full border border-[#D9BE94] bg-[#F8F1E3] px-4 py-2 text-sm font-semibold text-[#A86A2A]"
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
