'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Printer } from 'lucide-react';
import { SITE } from '@/data/site';
import { useAjustes } from '@/lib/useAjustes';
import {
  crearReclamo,
  type Constancia,
  type FormularioReclamo,
  type TipoDocumento,
} from '@/lib/reclamos';
import { Header } from './Header';
import { Footer } from './Footer';

/**
 * Libro de Reclamaciones virtual.
 *
 * Es obligatorio por el Código de Protección y Defensa del Consumidor, y la
 * norma condiciona el diseño más de lo que parece:
 *
 *   · NO se puede exigir cuenta ni registro previo para reclamar, así que
 *     esta página es pública y el envío va por una función abierta a `anon`.
 *   · Hay que entregar una constancia con el número de hoja. Por eso al
 *     terminar no se muestra un "gracias" cualquiera, sino el correlativo.
 *   · Hay que distinguir RECLAMO de QUEJA y explicarle al consumidor la
 *     diferencia: son cosas distintas ante INDECOPI.
 *   · Las cuatro notas al pie van literales; no son texto de relleno.
 */

const CANALES = ['Página web', 'WhatsApp', 'Teléfono', 'Presencial en el local', 'Delivery'];

const DOCUMENTOS: TipoDocumento[] = ['DNI', 'CE', 'Pasaporte', 'RUC'];

const HOY = new Date().toISOString().slice(0, 10);

const VACIO: FormularioReclamo = {
  local: '',
  canal: 'Página web',
  nombre: '',
  domicilio: '',
  tipo_documento: 'DNI',
  documento: '',
  correo: '',
  telefono: '',
  menor_edad: false,
  apoderado: '',
  tipo_bien: 'producto',
  moneda: 'PEN',
  monto: '',
  bien_detalle: '',
  tipo: 'reclamo',
  fecha_pedido: '',
  numero_pedido: '',
  detalle: '',
  pedido_cliente: '',
};

const campoBase =
  'w-full rounded-xl border border-white/12 bg-night-2 px-4 py-3 text-[15px] text-bone outline-none transition-colors placeholder:text-white/25 focus:border-sugu disabled:opacity-40';

export function LibroReclamaciones() {
  const ajustes = useAjustes();
  const [f, setF] = useState<FormularioReclamo>(VACIO);
  const [declara, setDeclara] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [constancia, setConstancia] = useState<Constancia | null>(null);

  const razonSocial = ajustes?.razon_social || 'INVERSIONES SUGU S.A.C.';
  const ruc = ajustes?.ruc || '20608920961';
  const direccion = ajustes?.direccion || SITE.direccion;

  const set = <K extends keyof FormularioReclamo>(clave: K, valor: FormularioReclamo[K]) =>
    setF((prev) => ({ ...prev, [clave]: valor }));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const hoja = await crearReclamo({ ...f, local: f.local || direccion });
      setConstancia(hoja);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Header />
      <main className="mx-auto w-[calc(100%-40px)] max-w-3xl pb-24 pt-32 sm:pt-40">
        {constancia ? (
          <HojaConstancia constancia={constancia} correo={f.correo} razonSocial={razonSocial} />
        ) : (
          <>
            <header className="flex items-start gap-4">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-sugu/10">
                <BookOpen className="h-5 w-5 text-sugu" />
              </span>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Libro de Reclamaciones
                </h1>
                <p className="mt-3 leading-relaxed text-bone-dim">
                  Conforme a lo establecido en el Código de la Protección y Defensa del Consumidor
                  contamos con un Libro de Reclamaciones a tu disposición para que puedas registrar
                  tu queja o reclamo acerca de algún pedido o transacción realizada.
                </p>
              </div>
            </header>

            {/* datos del proveedor: la hoja debe encabezarse con la razón social y el RUC */}
            <dl className="mt-8 grid gap-x-8 gap-y-3 rounded-2xl border border-white/10 bg-night-2 p-6 text-[14px] sm:grid-cols-2">
              <Dato etiqueta="Razón social" valor={razonSocial} />
              <Dato etiqueta="RUC" valor={ruc} />
              <Dato etiqueta="Nombre comercial" valor={ajustes?.nombre || SITE.nombre} />
              <Dato etiqueta="Dirección" valor={direccion} />
            </dl>

            <form onSubmit={enviar} className="mt-10 space-y-8" noValidate={false}>
              {/* ---------------- 1. local ---------------- */}
              <Bloque numero={1} titulo="Identificación del local">
                <Campo etiqueta="Local">
                  <input
                    value={f.local}
                    onChange={(e) => set('local', e.target.value)}
                    className={campoBase}
                    placeholder={direccion}
                  />
                </Campo>
                <Campo etiqueta="Canal de atención">
                  <select
                    value={f.canal}
                    onChange={(e) => set('canal', e.target.value)}
                    className={campoBase}
                  >
                    {CANALES.map((c) => (
                      <option key={c} value={c} className="bg-night-2">
                        {c}
                      </option>
                    ))}
                  </select>
                </Campo>
              </Bloque>

              {/* ---------------- 2. consumidor ---------------- */}
              <Bloque numero={2} titulo="Identificación del consumidor reclamante">
                <Campo etiqueta="Nombre completo" ancho="completo" obligatorio>
                  <input
                    required
                    value={f.nombre}
                    onChange={(e) => set('nombre', e.target.value)}
                    className={campoBase}
                    autoComplete="name"
                  />
                </Campo>

                <Campo etiqueta="Domicilio" ancho="completo" obligatorio>
                  <input
                    required
                    value={f.domicilio}
                    onChange={(e) => set('domicilio', e.target.value)}
                    className={campoBase}
                    autoComplete="street-address"
                  />
                </Campo>

                <Campo etiqueta="Tipo de documento" obligatorio>
                  <select
                    value={f.tipo_documento}
                    onChange={(e) => set('tipo_documento', e.target.value as TipoDocumento)}
                    className={campoBase}
                  >
                    {DOCUMENTOS.map((d) => (
                      <option key={d} value={d} className="bg-night-2">
                        {d}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo etiqueta="Número de documento" obligatorio>
                  <input
                    required
                    value={f.documento}
                    onChange={(e) => set('documento', e.target.value)}
                    className={campoBase}
                    inputMode="numeric"
                  />
                </Campo>

                <Campo etiqueta="Correo electrónico" obligatorio>
                  <input
                    required
                    type="email"
                    value={f.correo}
                    onChange={(e) => set('correo', e.target.value)}
                    className={campoBase}
                    autoComplete="email"
                    placeholder="tucorreo@ejemplo.com"
                  />
                </Campo>

                <Campo etiqueta="Teléfono fijo / celular" obligatorio>
                  <input
                    required
                    type="tel"
                    value={f.telefono}
                    onChange={(e) => set('telefono', e.target.value)}
                    className={campoBase}
                    autoComplete="tel"
                  />
                </Campo>

                <div className="sm:col-span-2">
                  <Casilla
                    marcada={f.menor_edad}
                    alCambiar={(v) => set('menor_edad', v)}
                    etiqueta="Soy menor de edad"
                  />
                  {/*
                    Un menor no puede reclamar solo: la hoja tiene que llevar
                    los datos de quien ejerce la representación.
                  */}
                  {f.menor_edad && (
                    <div className="mt-4">
                      <Campo
                        etiqueta="Padre, madre o apoderado"
                        ancho="completo"
                        obligatorio
                        ayuda="Nombre completo y número de documento de quien te representa."
                      >
                        <input
                          required
                          value={f.apoderado}
                          onChange={(e) => set('apoderado', e.target.value)}
                          className={campoBase}
                          placeholder="María Pérez · DNI 12345678"
                        />
                      </Campo>
                    </div>
                  )}
                </div>
              </Bloque>

              {/* ---------------- 3. bien contratado ---------------- */}
              <Bloque numero={3} titulo="Identificación del bien contratado">
                <div className="sm:col-span-2">
                  <Opciones
                    etiqueta="Tipo"
                    valor={f.tipo_bien}
                    alCambiar={(v) => set('tipo_bien', v as 'producto' | 'servicio')}
                    opciones={[
                      { valor: 'producto', texto: 'Producto' },
                      { valor: 'servicio', texto: 'Servicio' },
                    ]}
                  />
                </div>

                <Campo etiqueta="Tipo de moneda">
                  <select
                    value={f.moneda}
                    onChange={(e) => set('moneda', e.target.value as 'PEN' | 'USD')}
                    className={campoBase}
                  >
                    <option value="PEN" className="bg-night-2">
                      Soles (S/)
                    </option>
                    <option value="USD" className="bg-night-2">
                      Dólares (US$)
                    </option>
                  </select>
                </Campo>

                <Campo etiqueta="Monto reclamado">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={f.monto}
                    onChange={(e) => set('monto', e.target.value)}
                    className={campoBase}
                    placeholder="0.00"
                  />
                </Campo>

                <Campo etiqueta="Descripción" ancho="completo" obligatorio>
                  <textarea
                    required
                    rows={3}
                    value={f.bien_detalle}
                    onChange={(e) => set('bien_detalle', e.target.value)}
                    className={campoBase}
                    placeholder="Qué producto o servicio contrataste."
                  />
                </Campo>
              </Bloque>

              {/* ---------------- 4. reclamación ---------------- */}
              <Bloque numero={4} titulo="Detalle de la reclamación y pedido del consumidor">
                <div className="sm:col-span-2">
                  <Opciones
                    etiqueta="Tipo"
                    valor={f.tipo}
                    alCambiar={(v) => set('tipo', v as 'reclamo' | 'queja')}
                    opciones={[
                      { valor: 'reclamo', texto: 'Reclamo (1)' },
                      { valor: 'queja', texto: 'Queja (2)' },
                    ]}
                  />
                </div>

                <Campo etiqueta="Fecha del pedido">
                  <input
                    type="date"
                    max={HOY}
                    value={f.fecha_pedido}
                    onChange={(e) => set('fecha_pedido', e.target.value)}
                    className={campoBase}
                  />
                </Campo>

                <Campo etiqueta="Número de pedido" ayuda="Opcional.">
                  <input
                    value={f.numero_pedido}
                    onChange={(e) => set('numero_pedido', e.target.value)}
                    className={campoBase}
                  />
                </Campo>

                <Campo
                  etiqueta="Detalle del producto o servicio adquirido"
                  ancho="completo"
                  obligatorio
                >
                  <textarea
                    required
                    rows={5}
                    value={f.detalle}
                    onChange={(e) => set('detalle', e.target.value)}
                    className={campoBase}
                    placeholder="Cuéntanos qué pasó, con fechas y detalles."
                  />
                </Campo>

                <Campo
                  etiqueta="Pedido del consumidor"
                  ancho="completo"
                  obligatorio
                  ayuda="Qué esperas que hagamos: cambio, devolución, una explicación…"
                >
                  <textarea
                    required
                    rows={4}
                    value={f.pedido_cliente}
                    onChange={(e) => set('pedido_cliente', e.target.value)}
                    className={campoBase}
                  />
                </Campo>
              </Bloque>

              <Casilla
                marcada={declara}
                alCambiar={setDeclara}
                etiqueta="Declaro que la información brindada es verdadera y autorizo su uso para atender este reclamo."
              />

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-sugu/40 bg-sugu/10 px-4 py-3 text-[14px] text-bone"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  disabled={enviando || !declara}
                  className="btn-primary disabled:pointer-events-none disabled:opacity-40"
                >
                  {enviando ? 'Registrando…' : 'Registrar reclamo'}
                </button>
                <p className="text-[12px] text-white/40">
                  Recibirás el número de tu hoja al terminar. Guárdalo.
                </p>
              </div>
            </form>
          </>
        )}

        <NotasLegales />
      </main>
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* piezas                                                              */
/* ------------------------------------------------------------------ */

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-white/40">{etiqueta}</dt>
      <dd className="mt-1 font-semibold text-bone">{valor}</dd>
    </div>
  );
}

function Bloque({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-night-2 p-6 sm:p-7">
      <h2 className="mb-6 flex items-center gap-3 text-[15px] font-bold">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-sugu text-[12px] font-extrabold text-white">
          {numero}
        </span>
        {titulo}
      </h2>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Campo({
  etiqueta,
  ancho = 'medio',
  obligatorio = false,
  ayuda,
  children,
}: {
  etiqueta: string;
  ancho?: 'medio' | 'completo';
  obligatorio?: boolean;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${ancho === 'completo' ? 'sm:col-span-2' : ''}`}>
      <span className="mb-2 block text-[13px] font-medium text-bone">
        {etiqueta}
        {obligatorio && <span className="ml-1 text-sugu">*</span>}
      </span>
      {children}
      {ayuda && <span className="mt-1.5 block text-[11px] text-white/40">{ayuda}</span>}
    </label>
  );
}

function Casilla({
  marcada,
  alCambiar,
  etiqueta,
}: {
  marcada: boolean;
  alCambiar: (v: boolean) => void;
  etiqueta: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[14px] text-bone-dim">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(e) => alCambiar(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-none accent-[#E31323]"
      />
      {etiqueta}
    </label>
  );
}

/** Radios con aspecto de pastillas: en móvil se aciertan mucho mejor. */
function Opciones({
  etiqueta,
  valor,
  alCambiar,
  opciones,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  opciones: { valor: string; texto: string }[];
}) {
  return (
    <fieldset>
      <legend className="mb-2 block text-[13px] font-medium text-bone">{etiqueta}</legend>
      <div className="flex flex-wrap gap-3">
        {opciones.map((o) => (
          <label
            key={o.valor}
            className={`cursor-pointer rounded-xl border px-5 py-2.5 text-[14px] transition-colors ${
              valor === o.valor
                ? 'border-sugu bg-sugu/15 font-semibold text-bone'
                : 'border-white/12 text-bone-dim hover:border-white/30'
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              checked={valor === o.valor}
              onChange={() => alCambiar(o.valor)}
            />
            {o.texto}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Constancia. El número de hoja es lo único que le queda al consumidor para
 * demostrar que reclamó, así que ocupa el sitio principal y se puede imprimir.
 */
function HojaConstancia({
  constancia,
  correo,
  razonSocial,
}: {
  constancia: Constancia;
  correo: string;
  razonSocial: string;
}) {
  const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-PE', { dateStyle: 'long' });

  return (
    <section className="rounded-3xl border border-white/10 bg-night-2 p-8 text-center sm:p-12">
      <CheckCircle2 className="mx-auto h-12 w-12 text-sugu" />
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">
        Tu reclamo quedó registrado
      </h1>

      <p className="mt-6 text-[13px] uppercase tracking-widest text-white/40">Número de hoja</p>
      <p className="mt-1 text-5xl font-extrabold tabular-nums text-sugu">
        {String(constancia.numero).padStart(6, '0')}
      </p>

      <dl className="mx-auto mt-8 max-w-sm space-y-2 text-left text-[14px]">
        <Linea etiqueta="Fecha de registro" valor={fecha(constancia.creado)} />
        <Linea etiqueta="Plazo de respuesta" valor={`Hasta el ${fecha(constancia.vence)}`} />
        {correo && <Linea etiqueta="Te responderemos a" valor={correo} />}
        <Linea etiqueta="Proveedor" valor={razonSocial} />
      </dl>

      <p className="mx-auto mt-8 max-w-md text-[14px] leading-relaxed text-bone-dim">
        Guarda este número: es tu constancia. {razonSocial} tiene hasta treinta (30) días
        calendario para darte una respuesta.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={() => window.print()} className="btn-ghost">
          <Printer className="h-4 w-4" />
          Imprimir constancia
        </button>
        <Link href="/" className="btn-primary">
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}

function Linea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
      <dt className="text-bone-dim">{etiqueta}</dt>
      <dd className="text-right font-semibold text-bone">{valor}</dd>
    </div>
  );
}

/**
 * Las cuatro notas van LITERALES: son las que exige el reglamento del Libro
 * de Reclamaciones. No se resumen ni se reescriben.
 */
function NotasLegales() {
  const notas = [
    <>
      <b className="text-bone">RECLAMO:</b> Disconformidad relacionada a los productos o servicios.
    </>,
    <>
      <b className="text-bone">QUEJA:</b> Disconformidad no relacionada a los productos o servicios,
      se realiza para manifestar el malestar o descontento del consumidor respecto a la atención al
      público.
    </>,
    <>
      La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es
      requisito previo para interponer una denuncia ante el INDECOPI.
    </>,
    <>
      El proveedor deberá dar respuesta al reclamo en un plazo no mayor a treinta (30) días
      calendario, pudiendo ampliar el plazo hasta por treinta (30) días más, previa comunicación al
      consumidor.
    </>,
  ];

  return (
    <ol className="mt-12 space-y-3 border-t border-white/10 pt-8 text-[12px] leading-relaxed text-bone-dim">
      {notas.map((n, i) => (
        <li key={i} className="flex gap-2">
          <span className="flex-none text-white/40">({i + 1})</span>
          <span>{n}</span>
        </li>
      ))}
    </ol>
  );
}
