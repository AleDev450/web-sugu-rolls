'use client';

import { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Header } from '@/components/web/Header';
import { Footer } from '@/components/web/Footer';
import { Campo, FormIngreso, FormRegistro, campoClase } from '@/components/web/CuentaForms';
import { TarjetaSugu } from '@/components/web/TarjetaSugu';
import { CanjesPerfil } from '@/components/web/CanjesPerfil';
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
      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-32 sm:pt-40">
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
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Hola, {perfil.full_name || perfil.nickname}
          </h1>
          {correo && <p className="mt-1.5 text-sm text-bone-dim">{correo}</p>}
        </div>
        <button
          onClick={async () => {
            await salir();
            alRecargar();
          }}
          className="inline-flex items-center gap-2 text-[13px] text-bone-dim transition-colors hover:text-sugu"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </header>

      {tarjeta && (
        <div className="mt-10 sm:max-w-md">
          <TarjetaSugu
            tarjeta={tarjeta}
            nombre={`${perfil.full_name ?? ''} ${perfil.last_name ?? ''}`.trim() || perfil.nickname}
          />
        </div>
      )}

      {tarjeta && <CanjesPerfil saldo={tarjeta.saldo} alCanjear={alRefrescarTarjeta} />}

      <section className="mt-12">
        <h2 className="text-xl font-bold tracking-tight">Mis pedidos</h2>
        {pedidos.length === 0 ? (
          <p className="card mt-5 p-12 text-center text-sm text-bone-dim">
            Todavía no has hecho ningún pedido.
          </p>
        ) : (
          <div className="mt-5 grid gap-4">
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
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold tracking-tight">Mis datos</h2>
        <div className="card mt-5 grid gap-4 p-8 sm:grid-cols-2">
          <Campo etiqueta="Nombre">
            <input
              value={datos.full_name}
              onChange={(e) => setDatos({ ...datos, full_name: e.target.value })}
              className={campoClase}
            />
          </Campo>
          <Campo etiqueta="Apellido">
            <input
              value={datos.last_name}
              onChange={(e) => setDatos({ ...datos, last_name: e.target.value })}
              className={campoClase}
            />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input
              value={datos.phone}
              onChange={(e) => setDatos({ ...datos, phone: e.target.value })}
              className={campoClase}
            />
          </Campo>
          <Campo etiqueta="Dirección de entrega">
            <input
              value={datos.address}
              onChange={(e) => setDatos({ ...datos, address: e.target.value })}
              className={campoClase}
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
      </section>
    </>
  );
}
