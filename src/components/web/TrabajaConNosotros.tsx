'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Briefcase, CheckCircle2, FileText, Upload } from 'lucide-react';
import { enviarPostulacion, type FormularioPostulacion } from '@/lib/postulaciones';
import { Header } from './Header';
import { Footer } from './Footer';

const VACIO: FormularioPostulacion = {
  nombre: '',
  correo: '',
  telefono: '',
  puesto: '',
  mensaje: '',
};

const campoBase =
  'w-full rounded-xl border border-white/12 bg-night-2 px-4 py-3 text-[15px] text-bone outline-none transition-colors placeholder:text-white/25 focus:border-sugu disabled:opacity-40';

/**
 * "Trabaja con nosotros": postulación pública, sin necesidad de cuenta.
 * El CV se sube a un bucket privado y solo el panel puede descargarlo.
 */
export function TrabajaConNosotros() {
  const [f, setF] = useState<FormularioPostulacion>(VACIO);
  const [cv, setCv] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const set = <K extends keyof FormularioPostulacion>(clave: K, valor: string) =>
    setF((prev) => ({ ...prev, [clave]: valor }));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!cv) {
      setError('Adjunta tu CV para postular.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await enviarPostulacion(f, cv);
      setEnviado(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Header />
      <main className="mx-auto w-[calc(100%-40px)] max-w-2xl pb-24 pt-32 sm:pt-40">
        {enviado ? (
          <section className="rounded-3xl border border-white/10 bg-night-2 p-8 text-center sm:p-12">
            <CheckCircle2 className="mx-auto h-12 w-12 text-sugu" />
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">
              ¡Postulación recibida!
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-bone-dim">
              Gracias por tu interés en Sugu Rolls. Revisamos tu CV y, si encajas con lo que
              buscamos, te contactamos al correo o teléfono que dejaste.
            </p>
            <Link href="/" className="btn-primary mt-8 inline-block">
              Volver al inicio
            </Link>
          </section>
        ) : (
          <>
            <header className="flex items-start gap-4">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-sugu/10">
                <Briefcase className="h-5 w-5 text-sugu" />
              </span>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Trabaja con nosotros
                </h1>
                <p className="mt-3 leading-relaxed text-bone-dim">
                  Déjanos tus datos y tu CV. Cuando abramos una vacante que encaje contigo, te
                  escribimos.
                </p>
              </div>
            </header>

            <form onSubmit={enviar} className="mt-10 space-y-5">
              <label className="block">
                <span className="mb-2 block text-[13px] font-medium text-bone">
                  Nombre completo <span className="text-sugu">*</span>
                </span>
                <input
                  required
                  value={f.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                  className={campoBase}
                  autoComplete="name"
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[13px] font-medium text-bone">
                    Correo <span className="text-sugu">*</span>
                  </span>
                  <input
                    required
                    type="email"
                    value={f.correo}
                    onChange={(e) => set('correo', e.target.value)}
                    className={campoBase}
                    autoComplete="email"
                    placeholder="tucorreo@ejemplo.com"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[13px] font-medium text-bone">
                    Teléfono <span className="text-sugu">*</span>
                  </span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    value={f.telefono}
                    onChange={(e) => set('telefono', e.target.value)}
                    className={campoBase}
                    autoComplete="tel"
                    placeholder="999 123 456"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-[13px] font-medium text-bone">
                  Puesto al que postulas
                </span>
                <input
                  value={f.puesto}
                  onChange={(e) => set('puesto', e.target.value)}
                  className={campoBase}
                  placeholder="Cocina, delivery, atención al cliente…"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[13px] font-medium text-bone">
                  Cuéntanos sobre ti (opcional)
                </span>
                <textarea
                  rows={4}
                  value={f.mensaje}
                  onChange={(e) => set('mensaje', e.target.value)}
                  className={campoBase}
                  placeholder="Experiencia, disponibilidad de horario…"
                />
              </label>

              <div>
                <span className="mb-2 block text-[13px] font-medium text-bone">
                  Tu CV <span className="text-sugu">*</span>
                </span>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/20 px-4 py-4 text-[14px] text-bone-dim transition-colors hover:border-sugu">
                  {cv ? (
                    <FileText className="h-5 w-5 flex-none text-sugu" />
                  ) : (
                    <Upload className="h-5 w-5 flex-none" />
                  )}
                  <span className="truncate">{cv ? cv.name : 'Sube tu CV en PDF o Word'}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => setCv(e.target.files?.[0] ?? null)}
                  />
                </label>
                <span className="mt-1.5 block text-[11px] text-white/40">Máximo 5 MB.</span>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-sugu/40 bg-sugu/10 px-4 py-3 text-[14px] text-bone"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="btn-primary w-full disabled:pointer-events-none disabled:opacity-40"
              >
                {enviando ? 'Enviando…' : 'Enviar postulación'}
              </button>
            </form>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
