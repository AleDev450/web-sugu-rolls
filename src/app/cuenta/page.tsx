'use client';

import { useCallback, useEffect, useState } from 'react';
import { Inbox, LogOut, Package, UserRound } from 'lucide-react';
import { Header } from '@/components/web/Header';
import { Footer } from '@/components/web/Footer';
import { Campo, FormIngreso, FormRegistro } from '@/components/web/CuentaForms';
import { EstatusSocio, ProgresoNivel, TarjetaSugu } from '@/components/web/TarjetaSugu';
import { SeccionPerfil, Vacio } from '@/components/web/SeccionPerfil';
import { CanjesPerfil } from '@/components/web/CanjesPerfil';
import { useCartStore } from '@/store/useCartStore';
import {
  ESTADO_PEDIDO,
  guardarPerfil,
  correoActual,
  miPerfil,
  misPedidos,
  miTarjeta,
  salir,
  type Pedido,
  type Perfil,
  type Tarjeta,
} from '@/lib/tienda';

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });

const COLOR_ESTADO: Record<Pedido['estado'], string> = {
  pendiente: 'bg-amber-500/20 text-amber-400',
  pagado: 'bg-emerald-600/20 text-emerald-400',
  entregado: 'bg-sky-600/20 text-sky-400',
  cancelado: 'bg-white/10 text-bone-dim',
};

export default function CuentaPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [correo, setCorreo] = useState<string | null>(null);
  const [tarjeta, setTarjeta] = useState<Tarjeta | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState<'ingreso' | 'registro'>('ingreso');

  /** Solo la tarjeta: se llama tras cada canje, que cambia el saldo al vuelo. */
  const refrescarTarjeta = useCallback(async () => {
    setTarjeta(await miTarjeta());
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    const p = await miPerfil();
    setPerfil(p);
    if (p) {
      setCorreo(await correoActual());
      const [t, ps] = await Promise.all([miTarjeta(), misPedidos().catch(() => [])]);
      setTarjeta(t);
      setPedidos(ps);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <>
      <Header />
      {/*
        Contenedor del panel: 1180px con 20px de aire a cada lado. El anterior
        (max-w-4xl, 896px) dejaba la tarjeta pequeña y desaprovechaba la
        pantalla en escritorio.
      */}
      {/*
        pt-36 en móvil: el header es fijo y con el logo mide ~120px de alto.
        Con pt-28 (112px) el saludo quedaba justo debajo y se veía tapado.
      */}
      <main className="mx-auto w-[calc(100%-40px)] max-w-[1180px] pb-24 pt-36 sm:pt-40">
        {cargando ? (
          <p className="py-24 text-center text-sm text-bone-dim">Cargando…</p>
        ) : !perfil ? (
          <Acceso modo={modo} setModo={setModo} alEntrar={cargar} />
        ) : (
          <Panel
            perfil={perfil}
            correo={correo}
            tarjeta={tarjeta}
            pedidos={pedidos}
            alRecargar={cargar}
            alRefrescarTarjeta={refrescarTarjeta}
          />
        )}
      </main>
      <Footer />
    </>
  );
}

function Acceso({
  modo,
  setModo,
  alEntrar,
}: {
  modo: 'ingreso' | 'registro';
  setModo: (m: 'ingreso' | 'registro') => void;
  alEntrar: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="title-xl text-center">
        {modo === 'ingreso' ? 'Entra a tu cuenta' : 'Crea tu cuenta'}
      </h1>
      <p className="mt-4 text-center text-sm text-bone-dim">
        {modo === 'ingreso'
          ? 'Para ver tus pedidos, tus puntos y tus canjes.'
          : 'Acumula puntos con cada compra y canjéalos por descuentos y productos.'}
      </p>

      <div className="card mt-10 p-8 sm:p-10">
        {modo === 'ingreso' ? (
          <FormIngreso alEntrar={alEntrar} />
        ) : (
          <FormRegistro alEntrar={alEntrar} />
        )}

        <p className="mt-6 text-center text-[13px] text-bone-dim">
          {modo === 'ingreso' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            onClick={() => setModo(modo === 'ingreso' ? 'registro' : 'ingreso')}
            className="text-sugu underline underline-offset-4"
          >
            {modo === 'ingreso' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}

function Panel({
  perfil,
  correo,
  tarjeta,
  pedidos,
  alRecargar,
  alRefrescarTarjeta,
}: {
  perfil: Perfil;
  correo: string | null;
  tarjeta: Tarjeta | null;
  pedidos: Pedido[];
  alRecargar: () => void;
  alRefrescarTarjeta: () => void;
}) {
  const [datos, setDatos] = useState({
    full_name: perfil.full_name ?? '',
    last_name: perfil.last_name ?? '',
    phone: perfil.phone ?? '',
    address: perfil.address ?? '',
  });
  const abrirCarrito = useCartStore((s) => s.abrir);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await guardarPerfil(datos);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
            Hola, {perfil.full_name || perfil.nickname}
          </h1>
          {correo && <p className="mt-1 truncate text-[13px] text-bone-dim">{correo}</p>}
        </div>
        <button
          onClick={async () => {
            await salir();
            alRecargar();
          }}
          className="inline-flex flex-none items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-[13px] text-bone-dim transition-colors hover:border-sugu/50 hover:text-sugu focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sugu"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Cerrar sesión
        </button>
      </header>

      {/*
        65 / 35 en escritorio. El panel se estira a la altura de la tarjeta con
        `items-stretch`, que es lo que evita el hueco vacío que quedaba debajo.
      */}
      {/*
        Móvil: carné, luego el progreso como tira aparte, luego el estatus.
        Tablet (md) ya reparte en dos columnas; a partir de lg va el 65/35.
        El progreso sale del carné en móvil para que no crezca de alto.
      */}
      {tarjeta && (
        <div className="mt-7 grid items-stretch gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
          <div className="flex flex-col gap-4">
            <TarjetaSugu
              tarjeta={tarjeta}
              socioId={perfil.id}
              nombre={
                `${perfil.full_name ?? ''} ${perfil.last_name ?? ''}`.trim() || perfil.nickname
              }
            />
            <div className="card p-5 sm:hidden">
              <ProgresoNivel tarjeta={tarjeta} />
              <p className="mt-3 text-[11px] leading-relaxed text-bone-dim/70">
                Canjear gasta tus puntos disponibles, pero no baja tu nivel.
              </p>
            </div>
          </div>
          <EstatusSocio tarjeta={tarjeta} />
        </div>
      )}

      {/* canjes y pedidos van a la par: uno gasta puntos, el otro los genera */}
      <div className="mt-4 grid items-stretch gap-4 sm:mt-6 sm:gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        {tarjeta && <CanjesPerfil saldo={tarjeta.saldo} alCanjear={alRefrescarTarjeta} />}

        <SeccionPerfil titulo="Mis pedidos" icono={Package}>
        {pedidos.length === 0 ? (
          <Vacio
            icono={Inbox}
            texto="Todavía no has hecho ningún pedido."
            accion={
              <button onClick={abrirCarrito} className="btn-primary !px-7 !py-3 text-[14px]">
                Pedir ahora
              </button>
            }
          />
        ) : (
          <div className="grid gap-4">
            {pedidos.map((p) => (
              <article key={p.id} className="card p-6">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold">Pedido #{p.numero}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${COLOR_ESTADO[p.estado]}`}
                    >
                      {ESTADO_PEDIDO[p.estado]}
                    </span>
                  </div>
                  <span className="font-bold tabular-nums">{soles(p.total)}</span>
                </header>

                <p className="mt-1.5 text-[12px] text-bone-dim">{fecha(p.creado)}</p>

                <ul className="mt-4 space-y-1 text-[13px] text-bone-dim">
                  {p.items.map((i, n) => (
                    <li key={n}>
                      {i.cantidad}× {i.nombre}
                    </li>
                  ))}
                </ul>

                {p.puntos > 0 && (
                  <p className="mt-4 text-[13px] text-emerald-400">+{p.puntos} puntos</p>
                )}
                {p.estado === 'pendiente' && (
                  <p className="mt-4 text-[13px] text-amber-400">
                    Esperando que confirmemos tu pago. Los puntos se acreditan en ese momento.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
        </SeccionPerfil>
      </div>

      <div className="mt-4 sm:mt-6">
        <SeccionPerfil titulo="Mis datos" icono={UserRound}>
          <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre">
            <input
              value={datos.full_name}
              onChange={(e) => setDatos({ ...datos, full_name: e.target.value })}
              className="campo-perfil"
            />
          </Campo>
          <Campo etiqueta="Apellido">
            <input
              value={datos.last_name}
              onChange={(e) => setDatos({ ...datos, last_name: e.target.value })}
              className="campo-perfil"
            />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input
              value={datos.phone}
              onChange={(e) => setDatos({ ...datos, phone: e.target.value })}
              className="campo-perfil"
            />
          </Campo>
          <Campo etiqueta="Dirección de entrega">
            <input
              value={datos.address}
              onChange={(e) => setDatos({ ...datos, address: e.target.value })}
              className="campo-perfil"
            />
          </Campo>

          <div className="flex items-center gap-4 sm:col-span-2">
            <button
              onClick={() => void guardar()}
              disabled={guardando}
              className="btn-primary disabled:pointer-events-none disabled:opacity-50"
            >
              Guardar cambios
            </button>
            {guardado && <span className="text-[13px] text-emerald-400">Datos guardados.</span>}
          </div>
          </div>
        </SeccionPerfil>
      </div>
    </>
  );
}
