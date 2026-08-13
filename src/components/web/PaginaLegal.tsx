'use client';

import { useEffect, useState } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { traerAjustes, type AjustesSitio } from '@/lib/contenido';

/**
 * Convierte el Markdown ligero del panel en elementos de React.
 *
 * Se soporta a propósito muy poco —títulos con `###`, viñetas con `-`,
 * negrita con `**`— y NADA de HTML crudo: el texto lo escribe el admin desde
 * el panel y pintarlo con `dangerouslySetInnerHTML` abriría la puerta a que
 * una etiqueta mal pegada rompiera la página entera.
 */
function Markdown({ texto }: { texto: string }) {
  const bloques: React.ReactNode[] = [];
  let viñetas: string[] = [];

  const cerrarLista = (clave: string) => {
    if (viñetas.length === 0) return;
    bloques.push(
      <ul key={`ul-${clave}`} className="ml-5 list-disc space-y-2 text-bone-dim">
        {viñetas.map((v, i) => (
          <li key={i}>{negritas(v)}</li>
        ))}
      </ul>
    );
    viñetas = [];
  };

  texto.split(/\r?\n/).forEach((linea, i) => {
    const l = linea.trim();

    if (l.startsWith('- ')) {
      viñetas.push(l.slice(2));
      return;
    }
    cerrarLista(String(i));

    if (!l) return;

    if (l.startsWith('### ')) {
      bloques.push(
        <h2 key={i} className="mt-10 text-xl font-bold tracking-tight text-bone first:mt-0">
          {l.slice(4)}
        </h2>
      );
      return;
    }

    bloques.push(
      <p key={i} className="leading-relaxed text-bone-dim">
        {negritas(l)}
      </p>
    );
  });

  cerrarLista('fin');
  return <>{bloques}</>;
}

/** **texto** -> negrita. Se parte por el marcador y se alternan los trozos. */
function negritas(linea: string): React.ReactNode {
  return linea.split(/\*\*(.+?)\*\*/g).map((trozo, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-bold text-bone">
        {trozo}
      </strong>
    ) : (
      trozo
    )
  );
}

/**
 * Documento legal (términos o privacidad). El contenido sale del panel; si
 * todavía no se ha redactado, se dice claramente en vez de mostrar un vacío.
 */
export function PaginaLegal({
  titulo,
  campo,
}: {
  titulo: string;
  campo: 'terminos' | 'privacidad';
}) {
  const [ajustes, setAjustes] = useState<AjustesSitio | null>(null);

  useEffect(() => {
    void traerAjustes().then(setAjustes);
  }, []);

  const texto = ajustes?.[campo]?.trim() ?? '';
  const fecha = ajustes?.legales_actualizado;

  return (
    <>
      <Header />
      <main className="mx-auto w-[calc(100%-40px)] max-w-3xl pb-24 pt-32 sm:pt-40">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{titulo}</h1>

        {fecha && (
          <p className="mt-3 text-[13px] text-bone-dim">
            Última actualización: {new Date(fecha).toLocaleDateString('es', { dateStyle: 'long' })}
          </p>
        )}

        <div className="mt-10 space-y-4 text-[15px]">
          {ajustes === null ? (
            <p className="text-bone-dim">Cargando…</p>
          ) : texto ? (
            <Markdown texto={texto} />
          ) : (
            <p className="rounded-2xl border border-white/10 bg-night-2 p-6 text-bone-dim">
              Este documento todavía no está publicado. Escríbenos y te lo hacemos llegar.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
