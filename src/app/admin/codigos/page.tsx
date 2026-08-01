'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Download, Plus } from 'lucide-react';
import { generarCodigos, listarCodigos, type CodigoAdmin } from '@/lib/admin';
import {
  Aviso,
  Campo,
  Cargando,
  Encabezado,
  Modal,
  claseCampo,
} from '@/components/admin/ui';

/** Códigos de acceso al juego: uno por consumo, de un solo uso. */
export default function CodigosAdmin() {
  const [items, setItems] = useState<CodigoAdmin[] | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ cantidad: 20, etiqueta: '', vence: '' });
  const [recien, setRecien] = useState<string[]>([]);
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
      const nuevos = await generarCodigos(form.cantidad, form.etiqueta, form.vence || undefined);
      setRecien(nuevos.map((n) => n.nuevo_codigo));
      setModal(false);
      setAviso({ tipo: 'ok', texto: `Se generaron ${nuevos.length} códigos.` });
      void cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  };

  const copiar = (texto: string) => {
    void navigator.clipboard.writeText(texto);
    setAviso({ tipo: 'ok', texto: 'Copiado al portapapeles.' });
  };

  const descargar = () => {
    if (!items) return;
    const csv = [
      'codigo,etiqueta,creado,vence,usado',
      ...items.map((c) =>
        [c.code, c.label ?? '', c.created_at, c.expires_at ?? '', c.redeemed_at ?? ''].join(',')
      ),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `codigos-sugu-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!items) return <Cargando />;

  const disponibles = items.filter((c) => !c.redeemed_at).length;

  return (
    <>
      <Encabezado
        titulo="Códigos del juego"
        bajada={`${disponibles} sin usar de ${items.length} generados. Cada código sirve para una sola partida.`}
        accion={
          <div className="flex gap-3">
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
              onClick={() => copiar(recien.join('\n'))}
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
                onClick={() => copiar(c)}
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
              <th className="p-4">Vence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {items.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-white/[0.03]">
                <td className="p-4">
                  <button
                    onClick={() => copiar(c.code)}
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
                  {c.expires_at ? new Date(c.expires_at).toLocaleDateString('es') : 'Sin caducidad'}
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

          <Campo etiqueta="Vencimiento (opcional)">
            <input
              type="date"
              value={form.vence}
              onChange={(e) => setForm({ ...form, vence: e.target.value })}
              className={`${claseCampo} [color-scheme:dark]`}
            />
          </Campo>

          <Campo etiqueta="Etiqueta del lote" ancho="completo">
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
    </>
  );
}
