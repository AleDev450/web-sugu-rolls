'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Gamepad2, Power } from 'lucide-react';
import { guardarModulos, traerAjustesAdmin } from '@/lib/admin';
import { Aviso, Cargando, Encabezado, Interruptor } from '@/components/admin/ui';
import { EstadoTienda } from '@/components/admin/EstadoTienda';

type Clave =
  | 'mod_carta'
  | 'mod_paquetes'
  | 'mod_catering'
  | 'mod_promociones'
  | 'mod_nosotros'
  | 'mod_contacto'
  | 'mod_cuenta'
  | 'mod_juego';

const MODULOS: { clave: Clave; titulo: string; ruta: string; bajada: string }[] = [
  { clave: 'mod_carta', titulo: 'Nuestra Carta', ruta: '/carta', bajada: 'Catálogo de productos y carrito.' },
  { clave: 'mod_paquetes', titulo: 'Promociones', ruta: '/paquetes', bajada: 'Combos para compartir.' },
  { clave: 'mod_catering', titulo: 'Catering', ruta: '/catering', bajada: 'Servicio para eventos y su formulario.' },
  { clave: 'mod_promociones', titulo: 'Sugu Games', ruta: '/promociones', bajada: 'El juego y sus premios.' },
  { clave: 'mod_nosotros', titulo: 'Nosotros', ruta: '/nosotros', bajada: 'Historia y equipo.' },
  { clave: 'mod_contacto', titulo: 'Contacto', ruta: '/contacto', bajada: 'Datos, mapa y formulario.' },
  {
    clave: 'mod_cuenta',
    titulo: 'Cuentas de cliente',
    ruta: '/cuenta',
    bajada: 'Registro, Sugu Club, puntos y canjes. Apagarlo quita el registro de la web.',
  },
  { clave: 'mod_juego', titulo: 'Juego Sugu Rolls', ruta: '/juego', bajada: 'El juego y su ranking.' },
];

type Estado = Record<Clave | 'solo_juego', boolean>;

/**
 * Encendido y apagado de cada parte de la web, sin desplegar nada.
 *
 * La portada no se puede apagar: es la puerta de entrada y dejarla fuera evita
 * que el sitio quede sin ningún sitio donde aterrizar.
 */
export default function ModulosAdmin() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const fila = (await traerAjustesAdmin()) as Record<string, unknown>;
        const leido = {} as Estado;
        for (const { clave } of MODULOS) leido[clave] = fila[clave] !== false;
        leido.solo_juego = fila.solo_juego === true;
        setEstado(leido);
      } catch (e) {
        setAviso({ tipo: 'error', texto: (e as Error).message });
      }
    })();
  }, []);

  const cambiar = async (parche: Partial<Estado>) => {
    if (!estado) return;
    const siguiente = { ...estado, ...parche };
    setEstado(siguiente);
    setGuardando(true);
    try {
      await guardarModulos(siguiente);
      setAviso({ tipo: 'ok', texto: 'Guardado. La web ya refleja el cambio.' });
    } catch (e) {
      setEstado(estado); // se revierte: no debe mentir sobre lo que hay en la base
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  if (!estado) return aviso ? <Aviso {...aviso} /> : <Cargando />;

  const soloJuego = estado.solo_juego;

  return (
    <>
      <Encabezado
        titulo="Módulos de la web"
        bajada="Enciende o apaga cada parte del sitio. Se aplica al instante, sin publicar de nuevo."
        accion={
          <a href="/" target="_blank" rel="noopener noreferrer" className="btn-ghost">
            <ExternalLink className="h-4 w-4" />
            Ver la web
          </a>
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <EstadoTienda alAvisar={setAviso} />

      {/* interruptor maestro: manda por encima de todo lo demás */}
      <section
        className={`card mb-6 p-7 transition-colors ${soloJuego ? 'border-sugu/50 bg-sugu/[0.06]' : ''}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-sugu/10">
              <Gamepad2 className="h-5 w-5 text-sugu" />
            </span>
            <div>
              <h2 className="font-bold">Modo solo juego</h2>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-bone-dim">
                Apaga la web entera y deja únicamente <b className="text-white">/juego</b>.
                Cualquier visita a otra página va directa al juego. Pensado para campañas donde
                solo interesa jugar.
              </p>
            </div>
          </div>
          <Interruptor
            activo={soloJuego}
            alCambiar={(v) => void cambiar({ solo_juego: v })}
            etiqueta={soloJuego ? 'Activo' : 'Apagado'}
          />
        </div>

        {soloJuego && (
          <p className="mt-5 flex items-center gap-2 border-t border-sugu/20 pt-5 text-[13px] text-sugu">
            <Power className="h-4 w-4 flex-none" />
            La web está en pausa. El panel sigue accesible en /admin para volver a encenderla.
          </p>
        )}
      </section>

      <div
        className={`grid gap-4 sm:grid-cols-2 ${soloJuego ? 'pointer-events-none opacity-40' : ''}`}
      >
        {MODULOS.map(({ clave, titulo, ruta, bajada }) => (
          <article key={clave} className="card flex flex-col justify-between gap-5 p-6">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold">{titulo}</h3>
                <Link
                  href={ruta}
                  target="_blank"
                  className="font-mono text-[11px] text-bone-dim transition-colors hover:text-sugu"
                >
                  {ruta}
                </Link>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-bone-dim">{bajada}</p>
            </div>

            <Interruptor
              activo={estado[clave]}
              alCambiar={(v) => void cambiar({ [clave]: v } as Partial<Estado>)}
              etiqueta={estado[clave] ? 'Visible' : 'Oculto'}
            />
          </article>
        ))}
      </div>

      <p className="mt-6 text-[13px] text-bone-dim">
        La portada no se puede apagar: es donde aterriza quien entra al dominio.
        {guardando && <span className="ml-2 text-white/40">Guardando…</span>}
      </p>
    </>
  );
}
