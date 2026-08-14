'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Header } from './Header';
import { Footer } from './Footer';
import { traerAjustes, type AjustesSitio } from '@/lib/contenido';

/**
 * Estilos del documento.
 *
 * Se aplican con selectores de descendencia porque el HTML lo genera
 * `react-markdown` y no hay dónde colgar una clase en cada etiqueta.
 *
 * Los colores son los del sitio (`night-2`, `bone`, `sugu`), no grises
 * genéricos: así el documento legal es la misma tarjeta que el resto de la
 * web y no una isla con su propia paleta.
 */
const ESTILOS_MARKDOWN = [
  'mx-auto max-w-5xl rounded-2xl border border-white/10 bg-night-2 px-5 py-8 text-bone-dim shadow-xl sm:px-8 lg:px-12',

  // encabezados
  '[&_h1]:mb-8 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-bone',
  '[&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:border-b [&_h2]:border-white/10 [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-bone',
  '[&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-bone',
  '[&_h4]:mb-2 [&_h4]:mt-6 [&_h4]:font-semibold [&_h4]:text-bone',
  // el primer título no necesita separación: ya la da el padding de la tarjeta
  '[&>*:first-child]:mt-0',

  // texto corrido
  '[&_p]:mb-4 [&_p]:leading-7',
  '[&_strong]:font-semibold [&_strong]:text-bone',
  '[&_em]:italic',
  '[&_hr]:my-8 [&_hr]:border-white/10',

  // listas
  '[&_ul]:mb-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6',
  '[&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6',
  '[&_li]:leading-7 [&_li>ul]:mt-2 [&_li>ol]:mt-2',

  // enlaces
  '[&_a]:text-sugu [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-sugu-glow',

  // tablas — el contenedor con desplazamiento lo pone el override de abajo
  '[&_th]:border [&_th]:border-white/15 [&_th]:bg-night-3 [&_th]:p-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-bone',
  '[&_td]:border [&_td]:border-white/10 [&_td]:p-3 [&_td]:align-top',

  '[&_blockquote]:my-5 [&_blockquote]:rounded-r-xl [&_blockquote]:border-l-4 [&_blockquote]:border-sugu [&_blockquote]:bg-night-3 [&_blockquote]:px-5 [&_blockquote]:py-3',

  // código: lo único que sí va en monoespaciada
  '[&_code]:rounded [&_code]:bg-night-3 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-bone',
  '[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-night-3 [&_pre]:p-4',
].join(' ');

/**
 * Documento legal (términos, privacidad o cookies).
 *
 * El texto lo escribe el administrador desde el panel en Markdown y se pinta
 * con `react-markdown`. NO se usa `dangerouslySetInnerHTML`: react-markdown
 * ignora el HTML crudo salvo que se le añada `rehype-raw`, así que una
 * etiqueta mal pegada en el panel no puede romper la página ni inyectar nada.
 *
 * `remark-gfm` es lo que habilita tablas, tachados y listas de tareas; sin él
 * los `|---|` se veían literales.
 */
export function PaginaLegal({
  titulo,
  campo,
}: {
  titulo: string;
  campo: 'terminos' | 'privacidad' | 'cookies';
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

      <main className="mx-auto w-[calc(100%-32px)] max-w-5xl pb-24 pt-32 sm:w-[calc(100%-48px)] sm:pt-40">
        <header className="mx-auto mb-8 max-w-5xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{titulo}</h1>
          {fecha && (
            <p className="mt-3 text-[13px] text-bone-dim">
              Última actualización:{' '}
              {new Date(fecha).toLocaleDateString('es-PE', { dateStyle: 'long' })}
            </p>
          )}
        </header>

        {ajustes === null ? (
          <p className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-night-2 p-8 text-bone-dim">
            Cargando…
          </p>
        ) : texto ? (
          <article className={ESTILOS_MARKDOWN}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                /*
                 * Una tabla de tres columnas no cabe en un teléfono y empuja
                 * la página entera hacia los lados. Metiéndola en su propia
                 * caja con desplazamiento, se arrastra sola y el resto del
                 * documento sigue quieto.
                 */
                table: ({ children }) => (
                  <div className="my-7 overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[650px] border-collapse text-[14px]">
                      {children}
                    </table>
                  </div>
                ),
                a: ({ href, children }) => {
                  const externo = /^https?:\/\//.test(href ?? '');
                  return (
                    <a
                      href={href}
                      {...(externo
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {texto}
            </ReactMarkdown>
          </article>
        ) : (
          <p className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-night-2 p-8 text-bone-dim">
            Este documento todavía no está publicado. Escríbenos y te lo hacemos llegar.
          </p>
        )}
      </main>

      <Footer />
    </>
  );
}
