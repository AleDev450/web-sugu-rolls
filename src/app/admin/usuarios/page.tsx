'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { ajustarPuntos, borrarUsuario, listarUsuarios, type UsuarioAdmin } from '@/lib/admin';
import { Aviso, Campo, Cargando, Encabezado, Modal, claseCampo } from '@/components/admin/ui';

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
  const [ajuste, setAjuste] = useState<UsuarioAdmin | null>(null);
  const [recargar, setRecargar] = useState(0);

  const eliminar = async (u: UsuarioAdmin) => {
    const quien = [u.full_name, u.last_name].filter(Boolean).join(' ') || u.nickname;
    if (!confirm(`¿Eliminar la cuenta de ${quien}? No se puede deshacer.`)) return;
    try {
      await borrarUsuario(u.id);
      setAviso({ tipo: 'ok', texto: `Cuenta de ${quien} eliminada.` });
      setRecargar((n) => n + 1);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

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
  }, [pagina, buscar, recargar]);

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
                  <th className="p-4" />
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
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setAjuste(u)}
                          className="whitespace-nowrap rounded-lg border border-white/10 px-3 py-1.5 text-[12px] transition-colors hover:border-sugu/50 hover:text-sugu"
                        >
                          Ajustar puntos
                        </button>
                        <button
                          onClick={() => void eliminar(u)}
                          className="rounded-lg border border-white/10 p-2 text-bone-dim transition-colors hover:border-sugu hover:text-sugu"
                          aria-label={`Eliminar la cuenta de ${u.nickname}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
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

      <AjustePuntos
        usuario={ajuste}
        alCerrar={() => setAjuste(null)}
        alHecho={(texto) => {
          setAviso({ tipo: 'ok', texto });
          setAjuste(null);
          setRecargar((n) => n + 1);
        }}
        alFallar={(texto) => setAviso({ tipo: 'error', texto })}
      />
    </>
  );
}

/**
 * Suma o resta puntos a un cliente.
 *
 * Se pide siempre un motivo: el movimiento queda para siempre en el libro
 * mayor y dentro de un mes nadie recuerda por qué apareció.
 */
function AjustePuntos({
  usuario,
  alCerrar,
  alHecho,
  alFallar,
}: {
  usuario: UsuarioAdmin | null;
  alCerrar: () => void;
  alHecho: (texto: string) => void;
  alFallar: (texto: string) => void;
}) {
  const [signo, setSigno] = useState<1 | -1>(1);
  const [cantidad, setCantidad] = useState(100);
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (usuario) {
      setSigno(1);
      setCantidad(100);
      setMotivo('');
    }
  }, [usuario]);

  if (!usuario) return null;

  const delta = signo * Math.abs(cantidad || 0);
  const resultado = usuario.saldo + delta;
  const invalido = delta === 0 || resultado < 0;

  const aplicar = async () => {
    setTrabajando(true);
    try {
      const saldo = await ajustarPuntos(usuario.id, delta, motivo);
      alHecho(
        `${delta > 0 ? 'Sumados' : 'Restados'} ${Math.abs(delta)} puntos a ${usuario.nickname}. Saldo: ${saldo}.`
      );
    } catch (e) {
      alFallar((e as Error).message);
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <Modal abierto titulo={`Ajustar puntos · ${usuario.nickname}`} alCerrar={alCerrar}>
      <div className="space-y-5">
        <p className="text-[13px] text-bone-dim">
          Ahora tiene <b className="text-white">{usuario.saldo.toLocaleString('es')}</b> puntos
          disponibles y <b className="text-white">{usuario.ganados.toLocaleString('es')}</b>{' '}
          ganados en total.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="Operación">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSigno(1)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-[13px] transition-colors ${
                  signo === 1
                    ? 'border-emerald-500/60 bg-emerald-600/15 text-emerald-400'
                    : 'border-white/10 text-bone-dim hover:border-white/30'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                Sumar
              </button>
              <button
                type="button"
                onClick={() => setSigno(-1)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-[13px] transition-colors ${
                  signo === -1
                    ? 'border-sugu/60 bg-sugu/15 text-sugu'
                    : 'border-white/10 text-bone-dim hover:border-white/30'
                }`}
              >
                <Minus className="h-3.5 w-3.5" />
                Restar
              </button>
            </div>
          </Campo>

          <Campo etiqueta="Cantidad">
            <input
              type="number"
              min={1}
              max={100000}
              value={cantidad}
              onChange={(e) => setCantidad(Math.abs(Number(e.target.value)))}
              className={claseCampo}
            />
          </Campo>

          <Campo etiqueta="Motivo" ancho="completo">
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Premio del sorteo, corrección de un pedido…"
              className={claseCampo}
            />
          </Campo>
        </div>

        <div className="rounded-xl border border-white/10 bg-night p-4 text-[13px]">
          <p>
            Saldo resultante:{' '}
            <b className={resultado < 0 ? 'text-sugu' : 'text-white'}>
              {resultado.toLocaleString('es')} puntos
            </b>
          </p>
          <p className="mt-2 leading-relaxed text-bone-dim">
            {signo === 1
              ? 'Sumar puntos también cuenta para el nivel de su tarjeta.'
              : 'Restar puntos baja el saldo y también los puntos de nivel.'}
          </p>
          {resultado < 0 && (
            <p className="mt-2 text-sugu">Nadie puede quedar con saldo negativo.</p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={alCerrar} className="btn-ghost">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void aplicar()}
            disabled={invalido || trabajando}
            className="btn-primary disabled:pointer-events-none disabled:opacity-40"
          >
            {trabajando ? 'Aplicando…' : 'Aplicar ajuste'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
