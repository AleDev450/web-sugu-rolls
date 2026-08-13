'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Scale } from 'lucide-react';
import { guardarAjustes, traerAjustesAdmin } from '@/lib/admin';
import { Aviso, Cargando, Encabezado } from '@/components/admin/ui';

type Campo = 'terminos' | 'privacidad';

const DOCS: { campo: Campo; titulo: string; ruta: string; ejemplo: string }[] = [
  {
    campo: 'terminos',
    titulo: 'Términos y condiciones',
    ruta: '/terminos',
    ejemplo: '### Pedidos\nLos pedidos se confirman por WhatsApp…',
  },
  {
    campo: 'privacidad',
    titulo: 'Política de privacidad',
    ruta: '/privacidad',
    ejemplo: '### Qué datos recogemos\nNombre, teléfono y dirección de entrega…',
  },
];

/**
 * Redacción de los documentos legales.
 *
 * Se escriben en Markdown ligero y NO se admite HTML: el texto se pinta como
 * elementos de React, así que una etiqueta mal pegada no puede romper la web.
 */
export default function LegalesAdmin() {
  const [textos, setTextos] = useState<Record<Campo, string> | null>(null);
  const [fecha, setFecha] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const fila = (await traerAjustesAdmin()) as Record<string, unknown>;
        setTextos({
          terminos: (fila.terminos as string) ?? '',
          privacidad: (fila.privacidad as string) ?? '',
        });
        setFecha((fila.legales_actualizado as string) ?? '');
      } catch (e) {
        setAviso({ tipo: 'error', texto: (e as Error).message });
        setTextos({ terminos: '', privacidad: '' });
      }
    })();
  }, []);

  const guardar = async () => {
    if (!textos) return;
    setGuardando(true);
    try {
      await guardarAjustes({
        ...textos,
        // se sella la fecha al guardar: la web la muestra como "última actualización"
        legales_actualizado: new Date().toISOString().slice(0, 10),
      });
      setFecha(new Date().toISOString().slice(0, 10));
      setAviso({ tipo: 'ok', texto: 'Documentos publicados. Ya se ven en la web.' });
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  if (!textos) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Términos y privacidad"
        bajada={
          fecha
            ? `Última publicación: ${new Date(fecha).toLocaleDateString('es', { dateStyle: 'long' })}.`
            : 'Todavía sin publicar. Hasta que escribas algo, las páginas avisan de que no están disponibles.'
        }
        accion={
          <button
            onClick={() => void guardar()}
            disabled={guardando}
            className="btn-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {guardando ? 'Publicando…' : 'Publicar cambios'}
          </button>
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <div className="card mb-6 flex items-start gap-4 p-6">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-sugu/10">
          <Scale className="h-4 w-4 text-sugu" />
        </span>
        <p className="text-[13px] leading-relaxed text-bone-dim">
          Se escribe en texto plano con tres atajos: <b className="text-white">### Título</b> para
          los apartados, <b className="text-white">- </b> al principio de una línea para viñetas y{' '}
          <b className="text-white">**negrita**</b>. No pegues HTML: no se interpreta, se mostraría
          tal cual.
        </p>
      </div>

      <div className="grid gap-6">
        {DOCS.map(({ campo, titulo, ruta, ejemplo }) => (
          <section key={campo} className="card p-7">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">{titulo}</h2>
              <a
                href={ruta}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-mono text-[11px] text-bone-dim transition-colors hover:text-sugu"
              >
                {ruta}
                <ExternalLink className="h-3 w-3" />
              </a>
            </header>

            <textarea
              value={textos[campo]}
              onChange={(e) => setTextos({ ...textos, [campo]: e.target.value })}
              rows={16}
              placeholder={ejemplo}
              className="w-full rounded-xl border border-white/10 bg-night px-4 py-3 font-mono text-[13px] leading-relaxed outline-none transition-colors placeholder:text-white/25 focus:border-sugu"
            />

            <p className="mt-2 text-[11px] text-white/35">
              {textos[campo].length.toLocaleString('es')} caracteres
            </p>
          </section>
        ))}
      </div>
    </>
  );
}
