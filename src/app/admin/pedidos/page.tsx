'use client';

import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  BellRing,
  Bike,
  CreditCard,
  Download,
  ImageIcon,
  RefreshCw,
  Send,
  Truck,
} from 'lucide-react';
import {
  cambiarEstadoPedido,
  confirmarPago,
  fijarDelivery,
  fijarLinkPago,
  listarPedidos,
  verComprobante,
  type EstadoPedido,
  type MetodoPago,
  type PedidoAdmin,
} from '@/lib/admin';
import { Aviso, Cargando, Encabezado, claseCampo } from '@/components/admin/ui';
import { getSupabase } from '@/lib/supabase/client';
import { useAvisosStore } from '@/store/useAvisosStore';

const FILTROS: { id: EstadoPedido | 'todos'; label: string }[] = [
  { id: 'pendiente', label: 'Por cobrar' },
  { id: 'pagado', label: 'Pagados' },
  { id: 'entregado', label: 'Entregados' },
  { id: 'cancelado', label: 'Cancelados' },
  { id: 'todos', label: 'Todos' },
];

const COLOR_ESTADO: Record<EstadoPedido, string> = {
  pendiente: 'bg-amber-500/20 text-amber-400',
  pagado: 'bg-emerald-600/20 text-emerald-400',
  entregado: 'bg-sky-600/20 text-sky-400',
  cancelado: 'bg-white/10 text-bone-dim',
};

const ETIQUETA_METODO: Record<MetodoPago, string> = {
  yape: 'Yape',
  plin: 'Plin',
  tarjeta: 'Tarjeta',
};

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Deja solo dígitos y antepone el 51 de Perú si no lo trae ya. */
const numeroWhatsapp = (telefono: string) => {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.startsWith('51') ? digitos : `51${digitos}`;
};

async function descargarXLSX(pedidos: PedidoAdmin[]) {
  const ExcelJS = (await import('exceljs')).default;
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Pedidos');

  hoja.columns = [
    { header: 'Número', key: 'numero', width: 10 },
    { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Cliente', key: 'cliente', width: 26 },
    { header: 'Teléfono', key: 'telefono', width: 14 },
    { header: 'Dirección', key: 'direccion', width: 32 },
    { header: 'Método de pago', key: 'metodo', width: 15 },
    { header: 'Items', key: 'items', width: 46 },
    { header: 'Subtotal', key: 'subtotal', width: 12 },
    { header: 'Delivery', key: 'delivery', width: 12 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Puntos', key: 'puntos', width: 10 },
  ];

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0263B' } };
  encabezado.alignment = { vertical: 'middle' };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  for (const p of pedidos) {
    hoja.addRow({
      numero: p.numero,
      fecha: fecha(p.creado),
      estado: p.estado,
      cliente: p.nombre,
      telefono: p.telefono,
      direccion: p.direccion || '',
      metodo: p.metodo_pago ? ETIQUETA_METODO[p.metodo_pago] : '',
      items: p.items.map((i) => `${i.cantidad}x ${i.nombre}`).join('; '),
      subtotal: p.total,
      delivery: p.delivery,
      total: p.total + p.delivery,
      puntos: p.puntos,
    });
  }

  for (const clave of ['subtotal', 'delivery', 'total']) {
    hoja.getColumn(clave).numFmt = '"S/" #,##0.00';
  }

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Pedidos de la web. El pago se confirma a mano —Yape, transferencia o
 * efectivo— y ES ESE BOTÓN el que acredita los puntos al cliente.
 */
export default function PedidosAdmin() {
  const [items, setItems] = useState<PedidoAdmin[] | null>(null);
  const [filtro, setFiltro] = useState<EstadoPedido | 'todos'>('pendiente');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  /** costo de reparto en edición, por pedido */
  const [envios, setEnvios] = useState<Record<string, string>>({});
  /** enlace de pago con tarjeta en edición, por pedido */
  const [links, setLinks] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const avisosPendientes = useAvisosStore((s) => s.avisos);
  const marcarRecibido = useAvisosStore((s) => s.recibido);

  /**
   * `silencioso` es lo que usan el sondeo y el aviso en vivo: no vacía la
   * lista antes de traer la nueva (por eso no pasa por "Cargando…") y, si
   * falla, no lo dice — es solo un intento de refresco de fondo, no algo que
   * el admin pidió a propósito.
   */
  const cargar = async (
    f: EstadoPedido | 'todos',
    d: string,
    h: string,
    silencioso = false
  ) => {
    if (!silencioso) setItems(null);
    try {
      setItems(await listarPedidos(f === 'todos' ? undefined : f, d || undefined, h || undefined));
    } catch (e) {
      if (silencioso) return;
      setItems([]);
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  useEffect(() => {
    void cargar(filtro, desde, hasta);

    /*
     * Doble red para no depender de F5: Realtime avisa apenas hay un cambio
     * (pedido nuevo, pago confirmado desde otra pestaña…) y el sondeo cada
     * 30s cubre el rato en que el socket se cae y todavía no reconecta.
     */
    const sb = getSupabase();
    const canal = sb
      ?.channel('pedidos-lista')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => void cargar(filtro, desde, hasta, true)
      )
      .subscribe();

    const sondeo = setInterval(() => void cargar(filtro, desde, hasta, true), 30000);

    return () => {
      if (sb && canal) void sb.removeChannel(canal);
      clearInterval(sondeo);
    };
  }, [filtro, desde, hasta]);

  const cobrar = async (p: PedidoAdmin) => {
    setTrabajando(p.id);
    try {
      const puntos = await confirmarPago(p.id);
      setAviso({
        tipo: 'ok',
        texto: `Pedido #${p.numero} cobrado. Se acreditaron ${puntos} puntos a ${p.nombre}.`,
      });
      void cargar(filtro, desde, hasta);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setTrabajando(null);
    }
  };

  const mover = async (p: PedidoAdmin, estado: EstadoPedido) => {
    setTrabajando(p.id);
    try {
      await cambiarEstadoPedido(p.id, estado);
      setAviso({ tipo: 'ok', texto: `Pedido #${p.numero}: ${estado}.` });
      void cargar(filtro, desde, hasta);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setTrabajando(null);
    }
  };

  const guardarEnvio = async (p: PedidoAdmin) => {
    const monto = Number(envios[p.id] ?? p.delivery);
    if (!Number.isFinite(monto) || monto < 0) return;
    setTrabajando(p.id);
    try {
      await fijarDelivery(p.id, monto);
      setAviso({
        tipo: 'ok',
        texto: `Pedido #${p.numero}: delivery ${soles(monto)}.`,
      });
      void cargar(filtro, desde, hasta);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setTrabajando(null);
    }
  };

  const abrirComprobante = async (ruta: string) => {
    try {
      window.open(await verComprobante(ruta), '_blank', 'noopener');
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  const guardarLink = async (p: PedidoAdmin) => {
    const link = (links[p.id] ?? p.link_pago ?? '').trim();
    if (!link) return;
    setTrabajando(p.id);
    try {
      await fijarLinkPago(p.id, link);
      setAviso({ tipo: 'ok', texto: `Pedido #${p.numero}: enlace de pago guardado.` });
      void cargar(filtro, desde, hasta);
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setTrabajando(null);
    }
  };

  const enviarLinkPorWhatsapp = (p: PedidoAdmin) => {
    const link = (links[p.id] ?? p.link_pago ?? '').trim();
    if (!link || !p.telefono) return;
    const mensaje = `¡Hola ${p.nombre}! Aquí tienes el enlace para pagar con tarjeta tu pedido #${p.numero}: ${link}`;
    window.open(
      `https://wa.me/${numeroWhatsapp(p.telefono)}?text=${encodeURIComponent(mensaje)}`,
      '_blank',
      'noopener'
    );
  };

  const porCobrar = items?.filter((p) => p.estado === 'pendiente').length ?? 0;

  return (
    <>
      <Encabezado
        titulo="Pedidos"
        bajada={
          items
            ? `${items.length} pedidos en esta vista${porCobrar ? ` · ${porCobrar} esperando pago` : ''}.`
            : 'Cargando pedidos…'
        }
        accion={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (!items || items.length === 0) return;
                setDescargando(true);
                void descargarXLSX(items).finally(() => setDescargando(false));
              }}
              disabled={!items || items.length === 0 || descargando}
              className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {descargando ? 'Generando…' : 'Descargar Excel'}
            </button>
            <button onClick={() => void cargar(filtro, desde, hasta)} className="btn-ghost">
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
          </div>
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
              filtro === f.id ? 'bg-sugu text-white' : 'bg-white/5 text-bone-dim hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />

        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          aria-label="Desde"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-bone-dim outline-none transition-colors [color-scheme:dark] focus:border-sugu"
        />
        <span className="text-[13px] text-bone-dim">a</span>
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          aria-label="Hasta"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-bone-dim outline-none transition-colors [color-scheme:dark] focus:border-sugu"
        />
        {(desde || hasta) && (
          <button
            onClick={() => {
              setDesde('');
              setHasta('');
            }}
            className="text-[13px] text-bone-dim underline underline-offset-4 hover:text-sugu"
          >
            Limpiar fechas
          </button>
        )}
      </div>

      {!items ? (
        <Cargando />
      ) : items.length === 0 ? (
        <p className="card p-16 text-center text-sm text-bone-dim">
          No hay pedidos en esta vista.
        </p>
      ) : (
        <div className="grid gap-5">
          {items.map((p) => {
            const sinRecibir = avisosPendientes.some((a) => a.id === p.id);
            return (
            <article
              key={p.id}
              className={`card p-7 ${sinRecibir ? 'border-sugu/60 shadow-[0_0_0_1px_rgba(227,19,35,0.3)]' : ''}`}
            >
              <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-bold">Pedido #{p.numero}</h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${COLOR_ESTADO[p.estado]}`}
                    >
                      {p.estado}
                    </span>
                    {p.metodo_pago && (
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase text-bone-dim">
                        {ETIQUETA_METODO[p.metodo_pago]}
                      </span>
                    )}
                    {sinRecibir && (
                      <button
                        onClick={() => marcarRecibido(p.id)}
                        className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-sugu/50 bg-sugu/15 px-3 py-1 text-[11px] font-bold uppercase text-sugu transition-colors hover:bg-sugu/25"
                      >
                        <BellRing className="h-3 w-3" />
                        Recibido
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-bone-dim">{fecha(p.creado)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold tracking-tight">
                    {soles(p.total + p.delivery)}
                  </p>
                  {p.delivery > 0 && (
                    <p className="mt-0.5 text-[12px] text-bone-dim">
                      {soles(p.total)} + {soles(p.delivery)} de envío
                    </p>
                  )}
                </div>
              </header>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div className="space-y-1.5 text-[13px]">
                  <p className="font-semibold text-white">{p.nombre}</p>
                  {p.telefono && (
                    <p>
                      <a href={`tel:${p.telefono}`} className="text-bone-dim hover:text-sugu">
                        {p.telefono}
                      </a>
                    </p>
                  )}
                  {p.correo && <p className="text-bone-dim">{p.correo}</p>}
                  <p className="text-bone-dim">{p.direccion || 'Sin dirección'}</p>
                  {p.nota && <p className="pt-2 italic text-bone-dim">“{p.nota}”</p>}
                </div>

                <ul className="space-y-1.5 text-[13px]">
                  {p.items.map((i, n) => (
                    <li key={n}>
                      <div className="flex justify-between gap-4">
                        <span>
                          <span className="text-bone-dim">{i.cantidad}×</span> {i.nombre}
                        </span>
                        <span className="flex-none tabular-nums text-bone-dim">
                          {soles(Number(i.precio) * i.cantidad)}
                        </span>
                      </div>

                      {/* lo que hay que preparar: por grupo, no todo junto */}
                      {i.opciones && Object.keys(i.opciones).length > 0 && (
                        <ul className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                          {Object.entries(i.opciones)
                            .filter(([, v]) => v.length > 0)
                            .map(([grupo, valores]) => (
                              <li key={grupo} className="text-[12px] text-bone-dim">
                                <span className="text-white/40">{grupo}:</span>{' '}
                                {valores.join(', ')}
                              </li>
                            ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/*
                Costo de reparto y comprobante: lo que hace falta ANTES de
                confirmar el pago, por eso van juntos y encima del botón.
              */}
              <div className="mt-6 flex flex-wrap items-end gap-4 border-t border-white/10 pt-5">
                <label className="flex-none">
                  <span className="mb-1.5 flex items-center gap-2 text-[11px] text-bone-dim">
                    <Bike className="h-3.5 w-3.5" />
                    Costo de delivery
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.50"
                      value={envios[p.id] ?? String(p.delivery)}
                      onChange={(e) => setEnvios({ ...envios, [p.id]: e.target.value })}
                      className="w-28 rounded-lg border border-white/10 bg-night px-3 py-2 text-sm outline-none transition-colors focus:border-sugu"
                    />
                    <button
                      onClick={() => void guardarEnvio(p)}
                      disabled={trabajando === p.id}
                      className="rounded-lg border border-white/10 px-4 text-[13px] transition-colors hover:border-sugu/50 hover:text-sugu disabled:pointer-events-none disabled:opacity-40"
                    >
                      Guardar
                    </button>
                  </div>
                </label>

                {p.metodo_pago === 'tarjeta' ? (
                  <div className="min-w-[260px] flex-1">
                    <span className="mb-1.5 flex items-center gap-2 text-[11px] text-bone-dim">
                      <CreditCard className="h-3.5 w-3.5" />
                      Enlace de pago con tarjeta
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="Pega aquí el enlace generado en tu pasarela"
                        value={links[p.id] ?? p.link_pago ?? ''}
                        onChange={(e) => setLinks({ ...links, [p.id]: e.target.value })}
                        className={`${claseCampo} !py-2`}
                      />
                      <button
                        onClick={() => void guardarLink(p)}
                        disabled={trabajando === p.id}
                        className="flex-none rounded-lg border border-white/10 px-4 text-[13px] transition-colors hover:border-sugu/50 hover:text-sugu disabled:pointer-events-none disabled:opacity-40"
                      >
                        Guardar
                      </button>
                      {(links[p.id] ?? p.link_pago) && (
                        <button
                          onClick={() => enviarLinkPorWhatsapp(p)}
                          disabled={!p.telefono}
                          className="inline-flex flex-none items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-4 text-[13px] text-emerald-400 transition-colors hover:bg-emerald-600/20 disabled:pointer-events-none disabled:opacity-40"
                          title={p.telefono ? undefined : 'Este pedido no tiene teléfono'}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Enviar
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <span className="mb-1.5 block text-[11px] text-bone-dim">Comprobante</span>
                    {p.comprobante ? (
                      <button
                        onClick={() => void abrirComprobante(p.comprobante!)}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-4 py-2 text-[13px] text-emerald-400 transition-colors hover:bg-emerald-600/20"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        Ver el {p.metodo_pago === 'plin' ? 'Plin' : 'Yape'} adjunto
                      </button>
                    ) : (
                      <p className="py-2 text-[13px] text-amber-400">Todavía sin adjuntar</p>
                    )}
                  </div>
                )}
              </div>

              <footer className="mt-4 flex flex-wrap items-center gap-3">
                {p.estado === 'pendiente' && (
                  <button
                    onClick={() => void cobrar(p)}
                    disabled={trabajando === p.id}
                    className="btn-primary disabled:pointer-events-none disabled:opacity-40"
                  >
                    <BadgeCheck className="h-4 w-4" />
                    Confirmar pago
                  </button>
                )}

                {p.estado === 'pagado' && (
                  <button
                    onClick={() => void mover(p, 'entregado')}
                    disabled={trabajando === p.id}
                    className="btn-ghost disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Truck className="h-4 w-4" />
                    Marcar entregado
                  </button>
                )}

                {p.estado !== 'cancelado' && (
                  <button
                    onClick={() => void mover(p, 'cancelado')}
                    disabled={trabajando === p.id}
                    className="inline-flex items-center gap-2 text-[13px] text-bone-dim transition-colors hover:text-sugu disabled:opacity-40"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancelar
                  </button>
                )}

                {p.puntos > 0 && (
                  <span className="ml-auto text-[13px] text-emerald-400">
                    +{p.puntos} puntos acreditados
                  </span>
                )}
              </footer>
            </article>
            );
          })}
        </div>
      )}
    </>
  );
}
