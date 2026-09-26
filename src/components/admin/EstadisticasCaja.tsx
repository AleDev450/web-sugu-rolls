'use client';

import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  NOMBRE_METODO,
  NOMBRE_PRODUCTO,
  type Pedido,
  arqueoPorMetodo,
  buscarVariante,
  diaLocal,
  dineroDe,
  rollsDe,
  soles,
  unidadesDe,
} from '@/lib/caja';

/**
 * Estadísticas de la caja de feria: lo que responde "¿cómo nos va?" sin
 * abrir el Excel. Todo sale de los pedidos que ya filtró la página (rango,
 * vendedor, cierre), así que los filtros de arriba mandan también aquí.
 *
 * Colores: los cinco primeros tonos de la paleta categórica, en su orden
 * fijo y validados contra el fondo del panel (#141414) para daltonismo y
 * contraste. El color va atado a la cosa, nunca a su puesto en el
 * ranking: el maki es siempre azul, el onigiri naranja y el poke bowl
 * verde, y cada forma de pago tiene el suyo aunque falte otra.
 */
const SERIE = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'] as const;

/** Fijo por forma de pago: si un día no hubo tarjeta, el Yape no cambia de color. */
const COLOR_PAGO: Record<string, string> = {
  efectivo: SERIE[0],
  yape: SERIE[1],
  tarjeta: SERIE[2],
};

const TINTA = '#B8B8B8';
const REJILLA = 'rgba(255,255,255,0.06)';
const FONDO = '#141414';

/** Más de esto entre cobro y entrega es alguien que se olvidó de tocar "Entregar". */
const MAX_MINUTOS_ATENCION = 120;

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const ejeTexto = { fill: TINTA, fontSize: 11 };

const solesCorto = (n: number) =>
  n >= 1000 ? `S/ ${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `S/ ${Math.round(n)}`;

const minutos = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)} min`;

/** "2026-09-26" -> "26/9", corto para el eje. */
const etiquetaDia = (dia: string) => {
  const [, m, d] = dia.split('-');
  return `${Number(d)}/${Number(m)}`;
};

/** Todos los días entre dos claves YYYY-MM-DD, para que un día sin ventas se vea como cero. */
function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const d = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  // tope: un rango enorme sin filtro no debe colgar el navegador
  while (d <= fin && dias.length < 400) {
    dias.push(diaLocal(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

function mediana(valores: number[]): number {
  if (!valores.length) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

/* ------------------------------------------------------------------ */
/* Piezas                                                              */
/* ------------------------------------------------------------------ */

function Tarjeta({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-night-2 p-4">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {nota && <p className="mt-0.5 text-[11px] text-bone-dim">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Dato({ et, valor, pie }: { et: string; valor: string; pie?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-night-2 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-bone-dim">{et}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{valor}</p>
      {pie && <p className="mt-0.5 text-[11px] text-bone-dim">{pie}</p>}
    </div>
  );
}

type FilaTooltip = { name?: string | number; value?: number | string; color?: string; payload?: unknown };

/** Tooltip oscuro, con el texto en tinta del panel y el color solo en el punto. */
function Globo({
  active,
  payload,
  label,
  formato,
}: {
  active?: boolean;
  payload?: FilaTooltip[];
  label?: string | number;
  formato: (v: number, nombre: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/15 bg-night px-3 py-2 text-[12px] shadow-lg">
      {label !== undefined && label !== '' && <p className="mb-1 font-semibold text-bone">{label}</p>}
      {payload.map((f) => (
        <p key={String(f.name)} className="flex items-center gap-2 text-bone-dim">
          <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />
          <span>{f.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-bone">
            {formato(Number(f.value ?? 0), String(f.name ?? ''))}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * Leyenda propia en vez de la de recharts: esa reordena las series y pinta
 * el texto del color de cada una. Aquí va en el orden de las barras y el
 * color queda solo en el punto.
 */
function Leyenda({ series }: { series: { nombre: string; color: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-bone-dim">
      {series.map((s) => (
        <li key={s.nombre} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
          {s.nombre}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Estadísticas                                                        */
/* ------------------------------------------------------------------ */

export default function EstadisticasCaja({
  pedidos,
  desde,
  hasta,
}: {
  pedidos: Pedido[];
  desde: string;
  hasta: string;
}) {
  const datos = useMemo(() => {
    const ordenados = [...pedidos].sort((a, b) => a.creado.localeCompare(b.creado));
    const primero = ordenados[0] ? diaLocal(ordenados[0].creado) : '';
    const ultimo = ordenados.length ? diaLocal(ordenados[ordenados.length - 1].creado) : '';
    const dias = primero ? diasEntre(desde || primero, hasta || ultimo) : [];

    /* --- por día --- */
    const porDia = new Map(
      dias.map((d) => [
        d,
        { dia: d, venta: 0, cobrado: 0, pedidos: 0, rolls: 0, onigiris: 0, pokebowls: 0, esperas: [] as number[] },
      ]),
    );
    /* --- por hora del día y día de la semana --- */
    const porHora = Array.from({ length: 24 }, (_, h) => ({ hora: h, pedidos: 0, venta: 0 }));
    const porSemana = DIAS_SEMANA.map((nombre) => ({ nombre, venta: 0, dias: new Set<string>() }));
    /* --- qué se vende --- */
    const porVariante = new Map<string, { unidades: number; venta: number }>();
    const porSabor = new Map<string, number>();
    const ventaPorProducto = { maki: 0, onigiri: 0, pokebowl: 0 };
    const esperas: number[] = [];

    for (const p of ordenados) {
      const cuando = new Date(p.creado);
      const dia = diaLocal(cuando);
      const fila = porDia.get(dia);
      const rolls = rollsDe(p.lineas);
      if (fila) {
        fila.venta += p.total;
        fila.cobrado += p.pagado ? dineroDe(p) : 0;
        fila.pedidos += 1;
        fila.rolls += rolls;
        fila.onigiris += unidadesDe(p.lineas, 'onigiri');
        fila.pokebowls += unidadesDe(p.lineas, 'pokebowl');
      }

      porHora[cuando.getHours()].pedidos += 1;
      porHora[cuando.getHours()].venta += p.total;
      porSemana[cuando.getDay()].venta += p.total;
      porSemana[cuando.getDay()].dias.add(dia);

      for (const l of p.lineas) {
        const nombre = NOMBRE_PRODUCTO[l.producto] ?? l.producto;
        const variante = buscarVariante(l.promo);
        const clave = variante ? `${nombre} ${variante.nombre}` : nombre;
        const v = porVariante.get(clave) ?? { unidades: 0, venta: 0 };
        v.unidades += l.cantidad;
        v.venta += l.total;
        porVariante.set(clave, v);
        if (l.producto in ventaPorProducto) ventaPorProducto[l.producto] += l.total;
        for (const s of l.sabores) porSabor.set(s, (porSabor.get(s) ?? 0) + l.cantidad);
      }

      if (p.entregadoEn) {
        const min = (Date.parse(p.entregadoEn) - Date.parse(p.creado)) / 60000;
        if (min >= 0 && min <= MAX_MINUTOS_ATENCION) {
          esperas.push(min);
          fila?.esperas.push(min);
        }
      }
    }

    const diario = Array.from(porDia.values()).map((d) => ({
      ...d,
      etiqueta: etiquetaDia(d.dia),
      atencion: d.esperas.length ? d.esperas.reduce((s, x) => s + x, 0) / d.esperas.length : null,
    }));

    // solo las horas en que hubo movimiento, más una de margen a cada lado
    const conVentas = porHora.filter((h) => h.pedidos > 0).map((h) => h.hora);
    const horas = conVentas.length
      ? porHora.slice(Math.max(0, Math.min(...conVentas) - 1), Math.min(24, Math.max(...conVentas) + 2))
      : [];

    const venta = ordenados.reduce((s, p) => s + p.total, 0);
    const diasConVenta = diario.filter((d) => d.pedidos > 0).length;
    const mejorDia = diario.reduce<(typeof diario)[number] | null>(
      (mejor, d) => (!mejor || d.venta > mejor.venta ? d : mejor),
      null,
    );
    const horaPico = porHora.reduce((a, b) => (b.pedidos > a.pedidos ? b : a), porHora[0]);

    return {
      diario,
      horas: horas.map((h) => ({ ...h, etiqueta: `${h.hora}h` })),
      semana: porSemana.map((s) => ({
        nombre: s.nombre,
        // promedio por día trabajado: tres sábados no deben ganarle a un domingo por ser tres
        promedio: s.dias.size ? s.venta / s.dias.size : 0,
        dias: s.dias.size,
      })),
      variantes: Array.from(porVariante.entries())
        .map(([nombre, v]) => ({ nombre, ...v }))
        .sort((a, b) => b.unidades - a.unidades),
      sabores: Array.from(porSabor.entries())
        .map(([nombre, unidades]) => ({ nombre, unidades }))
        .sort((a, b) => b.unidades - a.unidades),
      mezcla: [
        { nombre: 'Maki', valor: ventaPorProducto.maki, color: SERIE[0] },
        { nombre: 'Onigiri', valor: ventaPorProducto.onigiri, color: SERIE[1] },
        { nombre: 'Poke Bowl', valor: ventaPorProducto.pokebowl, color: SERIE[2] },
      ].filter((m) => m.valor > 0),
      pagos: arqueoPorMetodo(ordenados)
        .filter((a) => a.metodo !== 'canje' && a.monto > 0)
        .map((a) => ({ nombre: NOMBRE_METODO[a.metodo], valor: a.monto, color: COLOR_PAGO[a.metodo] })),
      canje: ordenados.filter((p) => p.metodo === 'canje').reduce((s, p) => s + p.total, 0),
      venta,
      ticket: ordenados.length ? venta / ordenados.length : 0,
      diasConVenta,
      ventaPorDia: diasConVenta ? venta / diasConVenta : 0,
      rolls: diario.reduce((s, d) => s + d.rolls, 0),
      onigiris: diario.reduce((s, d) => s + d.onigiris, 0),
      pokebowls: diario.reduce((s, d) => s + d.pokebowls, 0),
      atencionMedia: esperas.length ? esperas.reduce((s, x) => s + x, 0) / esperas.length : null,
      atencionMediana: esperas.length ? mediana(esperas) : null,
      medidos: esperas.length,
      mejorDia,
      horaPico: horaPico.pedidos ? horaPico.hora : null,
    };
  }, [pedidos, desde, hasta]);

  if (!pedidos.length) {
    return (
      <p className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-sm text-bone-dim">
        No hay ventas en ese rango para sacar estadísticas.
      </p>
    );
  }

  const variosDias = datos.diario.length > 1;
  const conAtencion = datos.diario.filter((d) => d.atencion !== null);

  return (
    <div className="grid gap-6">
      {/* ---------------- Cifras ---------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato
          et="Ticket promedio"
          valor={soles(datos.ticket)}
          pie={`${pedidos.length} pedidos en total`}
        />
        <Dato
          et="Venta por día"
          valor={soles(datos.ventaPorDia)}
          pie={`${datos.diasConVenta} ${datos.diasConVenta === 1 ? 'día' : 'días'} con ventas`}
        />
        <Dato
          et="Tiempo de atención"
          valor={datos.atencionMedia !== null ? minutos(datos.atencionMedia) : '—'}
          pie={
            datos.atencionMediana !== null
              ? `Mediana ${minutos(datos.atencionMediana)} · ${datos.medidos} pedidos medidos`
              : 'Sin entregas marcadas a mano todavía'
          }
        />
        <Dato
          et="Hora pico"
          valor={datos.horaPico !== null ? `${datos.horaPico}:00` : '—'}
          pie={
            datos.mejorDia && variosDias
              ? `Mejor día: ${datos.mejorDia.etiqueta} · ${soles(datos.mejorDia.venta)}`
              : undefined
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { et: 'Rolls de maki', total: datos.rolls, color: SERIE[0] },
          { et: 'Onigiris', total: datos.onigiris, color: SERIE[1] },
          { et: 'Poke bowls', total: datos.pokebowls, color: SERIE[2] },
        ].map((t) => (
          <div key={t.et} className="rounded-2xl border border-white/10 bg-night-2 p-4">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-bone-dim">
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
              {t.et}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{t.total}</p>
            {datos.diasConVenta > 1 && (
              <p className="mt-0.5 text-[11px] text-bone-dim">
                {(t.total / datos.diasConVenta).toFixed(1)} por día
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------------- Ingresos diarios ---------------- */}
        <Tarjeta
          titulo="Ingresos diarios"
          nota={variosDias ? 'Venta de cada día, incluidos los días en cero.' : 'Elige un rango de varios días para ver la evolución.'}
        >
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={datos.diario} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke={REJILLA} />
                <XAxis dataKey="etiqueta" tick={ejeTexto} axisLine={{ stroke: REJILLA }} tickLine={false} minTickGap={12} />
                <YAxis tick={ejeTexto} axisLine={false} tickLine={false} tickFormatter={solesCorto} width={56} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={<Globo formato={(v) => soles(v)} />}
                />
                <Bar dataKey="venta" name="Venta" fill={SERIE[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>

        {/* ---------------- Productos por día ---------------- */}
        <Tarjeta
          titulo="Productos por día"
          nota="Los makis se cuentan en rolls: un Dúo son dos rolls que cortar."
        >
          <Leyenda
            series={[
              { nombre: 'Rolls de maki', color: SERIE[0] },
              { nombre: 'Onigiris', color: SERIE[1] },
              { nombre: 'Poke bowls', color: SERIE[2] },
            ]}
          />
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={datos.diario} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={REJILLA} />
                <XAxis dataKey="etiqueta" tick={ejeTexto} axisLine={{ stroke: REJILLA }} tickLine={false} minTickGap={12} />
                <YAxis tick={ejeTexto} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={<Globo formato={(v) => `${v} und`} />}
                />
                <Bar dataKey="rolls" name="Rolls de maki" fill={SERIE[0]} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="onigiris" name="Onigiris" fill={SERIE[1]} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="pokebowls" name="Poke bowls" fill={SERIE[2]} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>

        {/* ---------------- Tiempo de atención ---------------- */}
        <Tarjeta
          titulo="Tiempo de atención promedio"
          nota={`Del cobro a "Entregar". Solo cuenta lo entregado a mano en la caja; más de ${MAX_MINUTOS_ATENCION} min se toma como olvido y no entra.`}
        >
          {conAtencion.length === 0 ? (
            <p className="grid h-64 place-items-center rounded-xl border border-dashed border-white/10 px-6 text-center text-[13px] text-bone-dim">
              Todavía no hay entregas con hora. Se empieza a medir desde que la caja se actualice
              y se corra la migración 041.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={datos.diario} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={REJILLA} />
                  <XAxis dataKey="etiqueta" tick={ejeTexto} axisLine={{ stroke: REJILLA }} tickLine={false} minTickGap={12} />
                  <YAxis
                    tick={ejeTexto}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={(v: number) => `${v}m`}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.25)' }}
                    content={<Globo formato={(v) => minutos(v)} />}
                  />
                  <Line
                    dataKey="atencion"
                    name="Atención"
                    stroke={SERIE[0]}
                    strokeWidth={2}
                    connectNulls
                    dot={{ r: 4, fill: SERIE[0], stroke: FONDO, strokeWidth: 2 }}
                    activeDot={{ r: 5, stroke: FONDO, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Tarjeta>

        {/* ---------------- Por hora ---------------- */}
        <Tarjeta titulo="Pedidos por hora" nota="A qué hora llega la gente: sirve para saber cuándo reforzar el puesto.">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={datos.horas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke={REJILLA} />
                <XAxis dataKey="etiqueta" tick={ejeTexto} axisLine={{ stroke: REJILLA }} tickLine={false} />
                <YAxis tick={ejeTexto} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={<Globo formato={(v) => `${v} pedidos`} />}
                />
                <Bar dataKey="pedidos" name="Pedidos" fill={SERIE[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>

        {/* ---------------- Mezcla de productos ---------------- */}
        <Tarjeta titulo="Qué deja más plata" nota="Parte de la venta que aporta cada producto.">
          <Dona datos={datos.mezcla} total={datos.venta} />
        </Tarjeta>

        {/* ---------------- Formas de pago ---------------- */}
        <Tarjeta
          titulo="Cómo pagan"
          nota={
            datos.canje > 0
              ? `Lo cobrado por cada vía. Además se entregaron ${soles(datos.canje)} en canjes, que no son plata.`
              : 'Lo cobrado por cada vía. Un pago mixto se reparte entre Yape y efectivo.'
          }
        >
          <Dona datos={datos.pagos} total={datos.pagos.reduce((s, p) => s + p.valor, 0)} />
        </Tarjeta>

        {/* ---------------- Lo más vendido ---------------- */}
        <Tarjeta titulo="Lo más vendido" nota="Unidades por producto y presentación.">
          <Barras filas={datos.variantes.map((v) => ({ nombre: v.nombre, valor: v.unidades, pie: soles(v.venta) }))} />
        </Tarjeta>

        {/* ---------------- Sabores ---------------- */}
        <Tarjeta titulo="Sabores de maki más pedidos" nota="Cuántas veces se eligió cada sabor.">
          {datos.sabores.length ? (
            <Barras filas={datos.sabores.map((s) => ({ nombre: s.nombre, valor: s.unidades }))} />
          ) : (
            <p className="text-[13px] text-bone-dim">No hay makis en este rango.</p>
          )}
        </Tarjeta>

        {/* ---------------- Día de la semana ---------------- */}
        {datos.semana.filter((s) => s.dias > 0).length > 1 && (
          <Tarjeta
            titulo="Venta promedio por día de la semana"
            nota="Promedio de los días que se trabajó: ayuda a elegir en qué ferias estar."
          >
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={datos.semana} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                  <CartesianGrid vertical={false} stroke={REJILLA} />
                  <XAxis dataKey="nombre" tick={ejeTexto} axisLine={{ stroke: REJILLA }} tickLine={false} />
                  <YAxis tick={ejeTexto} axisLine={false} tickLine={false} tickFormatter={solesCorto} width={56} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={<Globo formato={(v) => soles(v)} />}
                  />
                  <Bar dataKey="promedio" name="Promedio" fill={SERIE[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Tarjeta>
        )}
      </div>
    </div>
  );
}

/**
 * Dona de parte-del-todo, con la leyenda al lado y el número escrito: con
 * pocas porciones se lee de un vistazo, y el valor exacto nunca depende
 * solo del color.
 */
function Dona({ datos, total }: { datos: { nombre: string; valor: number; color: string }[]; total: number }) {
  if (!datos.length || total <= 0) {
    return <p className="text-[13px] text-bone-dim">Nada que mostrar en este rango.</p>;
  }
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={datos}
              dataKey="valor"
              nameKey="nombre"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={datos.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {datos.map((d) => (
                <Cell key={d.nombre} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<Globo formato={(v) => `${soles(v)} · ${Math.round((v / total) * 100)}%`} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid w-full gap-2 text-[13px]">
        {datos.map((d) => (
          <li key={d.nombre} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="font-medium">{d.nombre}</span>
            <span className="ml-auto tabular-nums text-bone-dim">{Math.round((d.valor / total) * 100)}%</span>
            <span className="w-24 text-right font-semibold tabular-nums">{soles(d.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Ranking en barras horizontales hechas con CSS. Una sola serie, un solo
 * color: el largo ya dice quién gana, y el nombre va escrito.
 */
function Barras({ filas }: { filas: { nombre: string; valor: number; pie?: string }[] }) {
  const mayor = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="grid gap-2.5">
      {filas.map((f) => (
        <li key={f.nombre} className="text-[13px]" title={`${f.nombre}: ${f.valor}`}>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="font-medium">{f.nombre}</span>
            {f.pie && <span className="text-[11px] text-bone-dim">{f.pie}</span>}
            <span className="ml-auto font-semibold tabular-nums">{f.valor}</span>
          </div>
          <div className="h-2 rounded-full bg-white/5">
            <div
              className="h-2 rounded-full"
              style={{ width: `${(f.valor / mayor) * 100}%`, background: SERIE[0] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
