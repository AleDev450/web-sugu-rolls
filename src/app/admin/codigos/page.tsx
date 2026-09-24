'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardCheck, Copy, Download, Plus, Trash2 } from 'lucide-react';
import { borrarCodigos, generarCodigos, listarCodigos, type CodigoAdmin } from '@/lib/admin';
import {
  Aviso,
  Campo,
  Cargando,
  ConfirmarPeligro,
  Encabezado,
  Modal,
  claseCampo,
} from '@/components/admin/ui';

/** Qué códigos borra el botón de la papelera. */
type Borrado = 'sin-usar' | 'todos';

/** Códigos de acceso al juego: uno por consumo, de un solo uso. */
export default function CodigosAdmin() {
  const [items, setItems] = useState<CodigoAdmin[] | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ cantidad: 20, etiqueta: '' });
  const [recien, setRecien] = useState<string[]>([]);
  const [borrado, setBorrado] = useState<Borrado | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = async () => {
    try {
      setItems(await listarCodigos());
    } catch (e) {
      setItems([]);
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const generar = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const nuevos = await generarCodigos(form.cantidad, form.etiqueta);
      setRecien(nuevos.map((n) => n.nuevo_codigo));
      setModal(false);
      setAviso({ tipo: 'ok', texto: `Se generaron ${nuevos.length} códigos.` });
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  const confirmarBorrado = async () => {
    if (!borrado) return;
    setBorrando(true);
    try {
      const n = await borrarCodigos(borrado === 'sin-usar');
      setRecien([]);
      setAviso({ tipo: 'ok', texto: `Se borraron ${n} códigos.` });
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    } finally {
      setBorrando(false);
      setBorrado(null);
    }
  };

  /*
   * Se espera al portapapeles y se avisa según el resultado. Antes se daba
   * por copiado siempre: si el navegador lo negaba —sin HTTPS, permiso
   * denegado— el mensaje decía que sí y se pegaba lo que hubiera de antes.
   */
  const copiar = async (texto: string, exito = 'Copiado al portapapeles.') => {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso({ tipo: 'ok', texto: exito });
    } catch {
      setAviso({
        tipo: 'error',
        texto: 'El navegador no dejó copiar. Usa «Exportar CSV» o cópialo a mano.',
      });
    }
  };

  /**
   * Los que todavía se pueden repartir, del más nuevo al más viejo. Es el
   * orden en que se quieren sacar: lo último generado es lo que aún no se
   * ha entregado a nadie.
   */
  const libres = (items ?? [])
    .filter((c) => !c.redeemed_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((c) => c.code);

  const copiarLibres = () =>
    copiar(
      libres.join('\n'),
      `${libres.length} códigos libres copiados. Pégalos donde los necesites.`,
    );

  /** Los libres en un .txt, uno por línea: listo para pegar o imprimir. */
  const descargarLibres = () => {
    if (!libres.length) return;
    const url = URL.createObjectURL(
      new Blob([libres.join('\n')], { type: 'text/plain;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `codigos-libres-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const descargar = () => {
    if (!items) return;
    const csv = [
      'codigo,etiqueta,creado,usado',
      ...items.map((c) => [c.code, c.label ?? '', c.created_at, c.redeemed_at ?? ''].join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `codigos-sugu-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!items) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Códigos del juego"
        bajada={`${libres.length} sin usar de ${items.length} generados. Cada código sirve para una sola partida y no caduca.`}
        accion={
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setBorrado('sin-usar')}
              className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
              disabled={items.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              Borrar códigos
            </button>
            <button
              onClick={() => void copiarLibres()}
              className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
              disabled={libres.length === 0}
            >
              <ClipboardCheck className="h-4 w-4" />
              Copiar libres ({libres.length})
            </button>
            <button
              onClick={descargarLibres}
              className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
              disabled={libres.length === 0}
            >
              <Download className="h-4 w-4" />
              Bajar libres
            </button>
            <button onClick={descargar} className="btn-ghost">
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
            <button onClick={() => setModal(true)} className="btn-primary">
              <Plus className="h-4 w-4" />
              Generar códigos
            </button>
          </div>
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      {recien.length > 0 && (
        <div className="card mb-6 p-7">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-bold">Códigos recién generados</h2>
            <button
              onClick={() => void copiar(recien.join('\n'))}
              className="inline-flex items-center gap-2 text-[13px] text-sugu"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar todos
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {recien.map((c) => (
              <button
                key={c}
                onClick={() => void copiar(c)}
                className="rounded-lg border border-sugu/40 bg-sugu/10 px-3.5 py-2 font-mono text-sm tracking-widest transition-colors hover:bg-sugu/20"
                title="Copiar"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-white/10 bg-night-soft">
            <tr className="text-[11px] uppercase tracking-widest text-bone-dim">
              <th className="p-4">Código</th>
              <th className="p-4">Etiqueta</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Generado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {items.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-white/[0.03]">
                <td className="p-4">
                  <button
                    onClick={() => void copiar(c.code)}
                    className="font-mono tracking-widest transition-colors hover:text-sugu"
                    title="Copiar"
                  >
                    {c.code}
                  </button>
                </td>
                <td className="p-4 text-bone-dim">{c.label ?? '—'}</td>
                <td className="p-4">
                  {c.redeemed_at ? (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase text-bone-dim">
                      Usado
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-600/20 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-400">
                      Disponible
                    </span>
                  )}
                </td>
                <td className="p-4 text-bone-dim">
                  {new Date(c.created_at).toLocaleDateString('es')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {items.length === 0 && (
          <p className="p-16 text-center text-sm text-bone-dim">
            Aún no has generado códigos.
          </p>
        )}
      </div>

      <Modal abierto={modal} titulo="Generar códigos" alCerrar={() => setModal(false)}>
        <form onSubmit={generar} className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="¿Cuántos?">
            <input
              required
              type="number"
              min={1}
              max={1000}
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: Number(e.target.value) })}
              className={claseCampo}
            />
          </Campo>

          <Campo etiqueta="Etiqueta del lote">
            <input
              value={form.etiqueta}
              onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
              className={claseCampo}
              placeholder="Promo agosto, Local Miraflores…"
            />
          </Campo>

          <div className="flex justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={() => setModal(false)} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Generar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmarPeligro
        abierto={borrado !== null}
        titulo="Borrar códigos"
        textoBoton={borrado === 'todos' ? 'Borrar todos' : 'Borrar los sin usar'}
        trabajando={borrando}
        alCerrar={() => setBorrado(null)}
        alConfirmar={confirmarBorrado}
        descripcion={
          <>
            {borrado === 'todos' ? (
              <p>
                Se borrarán <b>los {items.length} códigos</b>, incluidos los ya canjeados.
                Con ellos desaparecen <b>sus partidas y sus puestos en el ranking</b>, porque
                una partida no existe sin su código.
              </p>
            ) : (
              <p>
                Se borrarán los <b>{libres.length} códigos sin usar</b>. Los{' '}
                {items.length - libres.length} ya canjeados se quedan, junto con sus partidas y
                el ranking.
              </p>
            )}
            <p className="mt-3">Esto no se puede deshacer.</p>
            <button
              type="button"
              onClick={() => setBorrado(borrado === 'todos' ? 'sin-usar' : 'todos')}
              className="mt-3 text-[13px] underline underline-offset-4 hover:text-white"
            >
              {borrado === 'todos'
                ? 'Mejor borrar solo los que nunca se usaron'
                : 'Quiero borrar todos, incluidos los canjeados'}
            </button>
          </>
        }
      />
    </>
  );
}
