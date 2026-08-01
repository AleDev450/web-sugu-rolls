'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { guardarAjustes, traerAjustesAdmin } from '@/lib/admin';
import { Aviso, Campo, Cargando, Encabezado, claseCampo } from '@/components/admin/ui';

const CAMPOS: { clave: string; etiqueta: string; ayuda?: string; ancho?: 'completo' }[] = [
  { clave: 'nombre', etiqueta: 'Nombre del negocio' },
  { clave: 'eslogan', etiqueta: 'Eslogan' },
  { clave: 'descripcion', etiqueta: 'Descripción corta', ancho: 'completo' },
  { clave: 'telefono', etiqueta: 'Teléfono' },
  {
    clave: 'whatsapp',
    etiqueta: 'WhatsApp',
    ayuda: 'Solo dígitos con código de país, p. ej. 51999123456',
  },
  { clave: 'correo', etiqueta: 'Correo' },
  { clave: 'direccion', etiqueta: 'Dirección' },
  { clave: 'horario', etiqueta: 'Horario de atención', ancho: 'completo' },
  { clave: 'instagram', etiqueta: 'Instagram' },
  { clave: 'facebook', etiqueta: 'Facebook' },
  { clave: 'tiktok', etiqueta: 'TikTok' },
];

export default function AjustesAdmin() {
  const [datos, setDatos] = useState<Record<string, string> | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const fila = await traerAjustesAdmin();
        const limpio: Record<string, string> = {};
        for (const { clave } of CAMPOS) limpio[clave] = (fila as never)[clave] ?? '';
        setDatos(limpio);
      } catch (e) {
        setDatos({});
        setAviso({ tipo: 'error', texto: (e as Error).message });
      }
    })();
  }, []);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!datos) return;
    setGuardando(true);
    try {
      await guardarAjustes(datos);
      setAviso({ tipo: 'ok', texto: 'Ajustes guardados. La web ya muestra los cambios.' });
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  if (!datos) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Ajustes del sitio"
        bajada="Datos de contacto y redes que aparecen en toda la web."
      />

      {aviso && (
        <div className="mb-6">
          <Aviso {...aviso} />
        </div>
      )}

      <form onSubmit={enviar} className="card max-w-3xl p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {CAMPOS.map(({ clave, etiqueta, ayuda, ancho }) => (
            <Campo key={clave} etiqueta={etiqueta} ancho={ancho ?? 'normal'}>
              <input
                value={datos[clave] ?? ''}
                onChange={(e) => setDatos({ ...datos, [clave]: e.target.value })}
                className={claseCampo}
              />
              {ayuda && <span className="mt-1.5 block text-[11px] text-white/40">{ayuda}</span>}
            </Campo>
          ))}
        </div>

        <button type="submit" disabled={guardando} className="btn-primary mt-8">
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </>
  );
}
