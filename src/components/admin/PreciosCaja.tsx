'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Save } from 'lucide-react';
import {
  type FilaPreciosCaja,
  guardarPreciosCaja,
  listarPreciosCaja,
  preciosVigentes,
  repreciarCajasAbiertas,
} from '@/lib/admin';
import { Aviso, Cargando } from '@/components/admin/ui';
import { MENU_CAJA, NOMBRE_PRODUCTO, type Precios, claveCaja, combinarPrecios, soles } from '@/lib/caja';

const claseCampo =
  'rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-bone outline-none transition-colors [color-scheme:dark] focus:border-sugu';

/**
 * Precios de la caja de feria.
 *
 * Tres capas, cada una hereda de la anterior: la CARTA (escrita en el
 * código), el precio BASE que pone el panel para todas las cajas, y los
 * precios PROPIOS de la caja de un cajero —en una feria el maki puede
 * valer más que en otra—. Un campo vacío hereda: así una caja solo lleva
 * lo que de verdad cambia.
 *
 * Al guardar, las ventas de las cajas abiertas pasan a los precios nuevos
 * (menos las líneas retocadas a mano). Lo cerrado no se toca.
 */
export default function PreciosCaja({
  vendedores,
  abiertos,
}: {
  /** cajeros que aparecen en la caja, para ofrecerlos sin tener que escribirlos */
  vendedores: string[];
  /** cajeros con la caja abierta ahora mismo */
  abiertos: string[];
}) {
  const [filas, setFilas] = useState<FilaPreciosCaja[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  /** '' = precio base; si no, el nombre del cajero tal como se escribe */
  const [caja, setCaja] = useState('');
  const [nueva, setNueva] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setFilas(await listarPreciosCaja());
    } catch (e) {
      const texto = e instanceof Error ? e.message : String(e);
      setError(
        texto.includes('caja_precios')
          ? 'Falta correr la migración 042 en Supabase para poder guardar precios.'
          : texto,
      );
      setFilas([]);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Todas las cajas que se pueden elegir: las que tienen precios y las que venden. */
  const cajas = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const v of vendedores) if (v.trim()) mapa.set(claveCaja(v), v.trim());
    for (const f of filas ?? []) if (f.caja) mapa.set(f.caja, f.nombre || f.caja);
    return Array.from(mapa.entries())
      .map(([clave, nombre]) => ({ clave, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [vendedores, filas]);

  const fila = filas?.find((f) => f.caja === (caja ? claveCaja(caja) : ''));
  /** Lo que heredaría esta capa si sus campos quedaran vacíos. */
  const heredado: Precios = useMemo(
    () => (caja ? preciosVigentes(filas ?? [], '') : combinarPrecios()),
    [caja, filas],
  );

  // al cambiar de caja, el formulario muestra lo que esa capa tiene guardado
  useEffect(() => {
    const propios = fila?.precios ?? {};
    setValores(
      Object.fromEntries(MENU_CAJA.map((m) => [m.clave, propios[m.clave] ? String(propios[m.clave]) : ''])),
    );
  }, [fila, caja]);

  async function guardar(precios: Precios) {
    if (!filas) return;
    setGuardando(true);
    setError(null);
    setOk(null);
    try {
      await guardarPreciosCaja(caja ? claveCaja(caja) : '', caja, precios);
      const ahora = await listarPreciosCaja();
      const cambiadas = await repreciarCajasAbiertas(filas, ahora);
      setFilas(ahora);
      setOk(
        cambiadas
          ? `Precios guardados. Se actualizaron ${cambiadas} ${cambiadas === 1 ? 'venta' : 'ventas'} de cajas abiertas.`
          : 'Precios guardados. Las cajas los reciben en cuanto tengan señal.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar los precios.');
    } finally {
      setGuardando(false);
    }
  }

  function enviar() {
    const precios: Precios = {};
    for (const [clave, texto] of Object.entries(valores)) {
      const n = Number(texto.replace(',', '.'));
      if (texto.trim() && n > 0) precios[clave] = Math.round(n * 100) / 100;
    }
    void guardar(precios);
  }

  if (filas === null) return <Cargando />;

  const conPropios = new Set((filas ?? []).filter((f) => f.caja).map((f) => f.caja));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {nueva === null ? (
          <>
            <select
              value={caja ? claveCaja(caja) : ''}
              onChange={(e) => {
                const elegida = cajas.find((c) => c.clave === e.target.value);
                setCaja(elegida?.nombre ?? '');
                setOk(null);
              }}
              aria-label="Caja"
              className={claseCampo}
            >
              <option value="">Precio base · todas las cajas</option>
              {cajas.map((c) => (
                <option key={c.clave} value={c.clave}>
                  Caja de {c.nombre}
                  {abiertos.some((a) => claveCaja(a) === c.clave) ? ' · abierta' : ''}
                  {conPropios.has(c.clave) ? ' · precios propios' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNueva('')}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-[13px] font-semibold text-bone-dim"
            >
              <Plus className="h-4 w-4" />
              Otra caja
            </button>
          </>
        ) : (
          <>
            <input
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nueva.trim()) {
                  setCaja(nueva.trim());
                  setNueva(null);
                }
              }}
              placeholder="Nombre del cajero, como lo escribe al abrir la caja"
              aria-label="Nombre del cajero"
              autoFocus
              className={`${claseCampo} w-80 max-w-full`}
            />
            <button
              type="button"
              disabled={!nueva.trim()}
              onClick={() => {
                setCaja(nueva.trim());
                setNueva(null);
              }}
              className="rounded-full bg-sugu px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              Elegir
            </button>
            <button
              type="button"
              onClick={() => setNueva(null)}
              className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold text-bone-dim"
            >
              Cancelar
            </button>
          </>
        )}
      </div>

      <p className="text-[12px] text-bone-dim">
        {caja
          ? `Precios solo para la caja de ${caja}. Deja vacío lo que deba seguir al precio base.`
          : 'Rige en todas las cajas que no tengan precios propios. Deja vacío lo que deba seguir al precio de carta.'}{' '}
        Al guardar, las ventas de las cajas abiertas pasan a los precios nuevos, salvo las que se
        corrigieron a mano. Lo cerrado no cambia.
      </p>

      {error && <Aviso tipo="error" texto={error} />}
      {ok && <Aviso tipo="ok" texto={ok} />}

      <section className="rounded-2xl border border-white/10 bg-night-2 p-4">
        <table className="w-full text-[13px]">
          <thead className="text-[11px] uppercase tracking-wider text-bone-dim">
            <tr>
              <th className="pb-2 text-left font-medium">Producto</th>
              <th className="pb-2 text-right font-medium">{caja ? 'Base' : 'Carta'}</th>
              <th className="pb-2 pl-3 text-right font-medium">{caja ? `Caja de ${caja}` : 'Base'}</th>
            </tr>
          </thead>
          <tbody>
            {MENU_CAJA.map((m, i) => {
              const nuevoProducto = i === 0 || MENU_CAJA[i - 1].producto !== m.producto;
              const valor = valores[m.clave] ?? '';
              const cambia = valor.trim() !== '' && Number(valor) !== heredado[m.clave];
              return (
                <tr key={m.clave} className={nuevoProducto ? 'border-t border-white/10' : ''}>
                  <td className="py-2">
                    {nuevoProducto && (
                      <span className="block text-[11px] uppercase tracking-wider text-bone-dim">
                        {NOMBRE_PRODUCTO[m.producto]}
                      </span>
                    )}
                    <span className="font-medium">{m.nombre}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-bone-dim">{soles(heredado[m.clave])}</td>
                  <td className="py-2 pl-3 text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-bone-dim">S/</span>
                      <input
                        inputMode="decimal"
                        value={valor}
                        onChange={(e) =>
                          setValores((v) => ({ ...v, [m.clave]: e.target.value.replace(/[^\d.,]/g, '') }))
                        }
                        placeholder={String(heredado[m.clave])}
                        aria-label={`Precio de ${m.nombre}`}
                        className={`w-20 rounded-lg border bg-night px-2 py-1.5 text-right tabular-nums outline-none focus:border-sugu ${
                          cambia ? 'border-amber-500/60 text-amber-300' : 'border-white/15'
                        }`}
                      />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {caja && conPropios.has(claveCaja(caja)) && (
            <button
              type="button"
              disabled={guardando}
              onClick={() => void guardar({})}
              className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold text-bone-dim disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" />
              Quitar precios propios
            </button>
          )}
          <button
            type="button"
            disabled={guardando}
            onClick={enviar}
            className="flex items-center gap-2 rounded-full bg-sugu px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            {guardando ? 'Guardando…' : 'Guardar precios'}
          </button>
        </div>
      </section>
    </div>
  );
}
