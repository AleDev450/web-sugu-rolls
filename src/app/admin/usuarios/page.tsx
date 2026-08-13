'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { listarUsuarios, type UsuarioAdmin } from '@/lib/admin';
import { Aviso, Cargando, Encabezado } from '@/components/admin/ui';

const POR_PAGINA = 20;

/** Colores de cada nivel, para reconocerlo de un vistazo en la tabla. */
const NIVEL: Record<UsuarioAdmin['nivel'], { nombre: string; clase: string }> = {
  bronce: { nombre: 'Bronce', clase: 'bg-[#a9703f]/20 text-[#d79a63]' },
  plata: { nombre: 'Plata', clase: 'bg-slate-400/20 text-slate-300' },
  oro: { nombre: 'Oro', clase: 'bg-amber-400/20 text-amber-300' },
  platino: { nombre: 'Platino', clase: 'bg-sky-200/20 text-sky-100' },
  black: { nombre: 'Black', clase: 'bg-white/10 text-white' },
};

const soles = (n: number) => `S/ ${Number(n).toFixed(2)}`;
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' });

export default function UsuariosAdmin() {
  const [items, setItems] = useState<UsuarioAdmin[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [buscar, setBuscar] = useState('');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    setItems(null);

    // se espera a que deje de teclear antes de consultar
    const t = setTimeout(async () => {
      try {
        const r = await listarUsuarios(pagina, POR_PAGINA, buscar.trim());
        if (!vivo) return;
        setItems(r.items);
        setTotal(r.total);
        setAviso(null);
      } catch (e) {
        if (!vivo) return;
        setItems([]);
        setAviso({ tipo: 'error', texto: (e as Error).message });
      }
    }, buscar ? 350 : 0);

    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [pagina, buscar]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const descargar = () => {
    if (!items?.length) return;
    const csv = [
      'nickname,nombre,apellido,correo,telefono,direccion,nivel,puntos,ganados,pedidos,gastado,registrado',
      ...items.map((u) =>
        [
          u.nickname,
          u.full_name ?? '',
          u.last_name ?? '',
          u.correo ?? '',
          u.phone ?? '',
          u.address ?? '',
          NIVEL[u.nivel].nombre,
          u.saldo,
          u.ganados,
          u.pedidos,
          u.gastado,
          u.creado,
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios-sugu-p${pagina + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Encabezado
        titulo="Usuarios registrados"
        bajada={
          items
            ? `${total} cuentas${buscar ? ' que coinciden con la búsqueda' : ''}. Página ${pagina + 1} de ${paginas}.`
            : 'Cargando usuarios…'
        }
        accion={
          <button
            onClick={descargar}
            className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
            disabled={!items?.length}
          >
            <Download className="h-4 w-4" />
            Exportar página
          </button>
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={buscar}
          onChange={(e) => {
            setPagina(0);
            setBuscar(e.target.value);
          }}
          placeholder="Buscar por nombre, correo o teléfono…"
          className="w-full rounded-xl border border-white/10 bg-night py-3 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-white/30 focus:border-sugu"
        />
      </div>

      {!items ? (
        <Cargando />
      ) : items.length === 0 ? (
        <p className="card p-16 text-center text-sm text-bone-dim">
          {buscar ? 'Ninguna cuenta coincide con la búsqueda.' : 'Todavía no hay usuarios registrados.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-white/10 bg-night-soft">
                <tr className="text-[11px] uppercase tracking-widest text-bone-dim">
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Contacto</th>
                  <th className="p-4">Nivel</th>
                  <th className="p-4 text-right">Puntos</th>
                  <th className="p-4 text-right">Ganados</th>
                  <th className="p-4 text-right">Pedidos</th>
                  <th className="p-4 text-right">Gastado</th>
                  <th className="p-4">Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {items.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="p-4">
                      <p className="font-semibold">
                        {[u.full_name, u.last_name].filter(Boolean).join(' ') || u.nickname}
                      </p>
                      <p className="text-[12px] text-bone-dim">@{u.nickname}</p>
                    </td>
                    <td className="p-4 text-[13px] text-bone-dim">
                      {u.correo && <p className="truncate">{u.correo}</p>}
                      {u.phone && (
                        <a href={`tel:${u.phone}`} className="transition-colors hover:text-sugu">
                          {u.phone}
                        </a>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${NIVEL[u.nivel].clase}`}
                      >
                        {NIVEL[u.nivel].nombre}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold tabular-nums">
                      {u.saldo.toLocaleString('es')}
                    </td>
                    <td className="p-4 text-right tabular-nums text-bone-dim">
                      {u.ganados.toLocaleString('es')}
                    </td>
                    <td className="p-4 text-right tabular-nums text-bone-dim">{u.pedidos}</td>
                    <td className="p-4 text-right tabular-nums text-bone-dim">
                      {soles(u.gastado)}
                    </td>
                    <td className="p-4 text-[13px] text-bone-dim">{fecha(u.creado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav className="mt-6 flex items-center justify-between gap-4" aria-label="Paginación">
            <p className="text-[13px] text-bone-dim">
              Mostrando {pagina * POR_PAGINA + 1}–{pagina * POR_PAGINA + items.length} de {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={pagina === 0}
                className="rounded-xl border border-white/10 p-2.5 transition-colors hover:border-white/40 disabled:pointer-events-none disabled:opacity-30"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-[13px] tabular-nums text-bone-dim">
                {pagina + 1} / {paginas}
              </span>
              <button
                onClick={() => setPagina((p) => (p + 1 < paginas ? p + 1 : p))}
                disabled={pagina + 1 >= paginas}
                className="rounded-xl border border-white/10 p-2.5 transition-colors hover:border-white/40 disabled:pointer-events-none disabled:opacity-30"
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
