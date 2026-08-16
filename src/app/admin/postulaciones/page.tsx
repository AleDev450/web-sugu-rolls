'use client';

import { useEffect, useState } from 'react';
import { Briefcase, ChevronDown, Download, Mail, Phone } from 'lucide-react';
import { listarPostulaciones, verCV, type PostulacionAdmin } from '@/lib/admin';
import { Aviso, Cargando, Encabezado } from '@/components/admin/ui';

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Postulaciones de "Trabaja con nosotros".
 *
 * Solo se leen aquí: no hay edición ni borrado, igual que el Libro de
 * Reclamaciones. El CV se descarga con un enlace firmado que caduca a los
 * cinco minutos, porque el bucket es privado.
 */
export default function PostulacionesAdmin() {
  const [items, setItems] = useState<PostulacionAdmin[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setItems(await listarPostulaciones());
      } catch (e) {
        setItems([]);
        setAviso({ tipo: 'error', texto: (e as Error).message });
      }
    })();
  }, []);

  const descargarCV = async (p: PostulacionAdmin) => {
    setDescargando(p.id);
    try {
      const url = await verCV(p.cv_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setDescargando(null);
    }
  };

  if (!items) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Trabaja con nosotros"
        bajada={
          items.length > 0
            ? `${items.length} postulación${items.length === 1 ? '' : 'es'} recibida${items.length === 1 ? '' : 's'}.`
            : 'Todavía no hay postulaciones.'
        }
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      {items.length === 0 ? (
        <p className="card p-16 text-center text-sm text-bone-dim">
          Cuando alguien postule desde /trabaja-con-nosotros, aparecerá aquí.
        </p>
      ) : (
        <div className="grid gap-4">
          {items.map((p) => {
            const abierta = abierto === p.id;
            return (
              <article key={p.id} className="card overflow-hidden">
                <button
                  onClick={() => setAbierto(abierta ? null : p.id)}
                  className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-sugu/10">
                    <Briefcase className="h-4 w-4 text-sugu" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{p.nombre}</span>
                      {p.puesto && (
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase text-bone-dim">
                          {p.puesto}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-[13px] text-bone-dim">{fecha(p.creado)}</p>
                  </div>

                  <ChevronDown
                    className={`h-4 w-4 flex-none text-bone-dim transition-transform ${abierta ? 'rotate-180' : ''}`}
                  />
                </button>

                {abierta && (
                  <div className="border-t border-white/10 p-5 sm:p-7">
                    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-[11px] uppercase tracking-widest text-white/35">
                          Correo
                        </dt>
                        <dd className="mt-1 text-[14px]">
                          <a
                            href={`mailto:${p.correo}`}
                            className="inline-flex items-center gap-2 transition-colors hover:text-sugu"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {p.correo}
                          </a>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-widest text-white/35">
                          Teléfono
                        </dt>
                        <dd className="mt-1 text-[14px]">
                          <a
                            href={`tel:${p.telefono.replace(/\s/g, '')}`}
                            className="inline-flex items-center gap-2 transition-colors hover:text-sugu"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {p.telefono}
                          </a>
                        </dd>
                      </div>
                      {p.mensaje && (
                        <div className="sm:col-span-2">
                          <dt className="text-[11px] uppercase tracking-widest text-white/35">
                            Mensaje
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed">
                            {p.mensaje}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <div className="mt-6 border-t border-white/10 pt-5">
                      <button
                        onClick={() => void descargarCV(p)}
                        disabled={descargando === p.id}
                        className="btn-primary disabled:pointer-events-none disabled:opacity-40"
                      >
                        <Download className="h-4 w-4" />
                        {descargando === p.id ? 'Abriendo…' : 'Descargar CV'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
