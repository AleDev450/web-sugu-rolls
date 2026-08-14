'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Boxes,
  ExternalLink,
  FileText,
  Images,
  KeyRound,
  LayoutDashboard,
  LogOut,
  QrCode,
  Scale,
  Settings,
  SlidersHorizontal,
  ShoppingBag,
  Tags,
  Users,
  Trophy,
  UtensilsCrossed,
} from 'lucide-react';
import { cerrarSesion, esAdmin, usuarioActual } from '@/lib/admin';
import { hayBackend } from '@/lib/contenido';
import { Login } from './Login';

const MENU = [
  { href: '/admin', label: 'Resumen', icono: LayoutDashboard },
  { href: '/admin/pedidos', label: 'Pedidos', icono: ShoppingBag },
  { href: '/admin/usuarios', label: 'Usuarios', icono: Users },
  { href: '/admin/reclamos', label: 'Reclamaciones', icono: BookOpen },
  { href: '/admin/paginas', label: 'Páginas', icono: FileText },
  { href: '/admin/slider', label: 'Slider', icono: Images },
  { href: '/admin/categorias', label: 'Categorías', icono: Tags },
  { href: '/admin/productos', label: 'Productos', icono: UtensilsCrossed },
  { href: '/admin/paquetes', label: 'Paquetes', icono: Boxes },
  { href: '/admin/codigos', label: 'Códigos del juego', icono: KeyRound },
  { href: '/admin/ranking', label: 'Ranking del juego', icono: Trophy },
  { href: '/admin/qr', label: 'Código QR', icono: QrCode },
  { href: '/admin/legales', label: 'Documentos legales', icono: Scale },
  { href: '/admin/modulos', label: 'Módulos de la web', icono: SlidersHorizontal },
  { href: '/admin/ajustes', label: 'Ajustes del sitio', icono: Settings },
];

type Estado = 'cargando' | 'sin-backend' | 'anonimo' | 'sin-permiso' | 'listo';

/**
 * Envoltorio del panel: comprueba sesión y permisos antes de mostrar nada.
 * La seguridad real está en las políticas RLS de Supabase; esto solo evita
 * enseñar una interfaz que no funcionaría.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [correo, setCorreo] = useState<string | null>(null);
  /** Error del RPC `is_admin`, si la comprobación no llegó a ejecutarse. */
  const [fallo, setFallo] = useState<string | null>(null);
  const ruta = usePathname();

  const revisar = async () => {
    if (!hayBackend()) {
      setEstado('sin-backend');
      return;
    }
    const usuario = await usuarioActual();
    if (!usuario) {
      setEstado('anonimo');
      return;
    }
    setCorreo(usuario.email ?? null);
    const { admin, error } = await esAdmin();
    setFallo(error);
    setEstado(admin ? 'listo' : 'sin-permiso');
  };

  useEffect(() => {
    void revisar();
  }, []);

  if (estado === 'cargando') {
    return (
      <div className="grid min-h-screen place-items-center bg-night">
        <p className="text-sm text-bone-dim">Comprobando sesión…</p>
      </div>
    );
  }

  if (estado === 'sin-backend') {
    return (
      <Aviso
        titulo="Falta conectar Supabase"
        texto="Para usar el panel, crea un archivo .env.local con NEXT_PUBLIC_SUPABASE_URL y la clave pública del proyecto (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, o NEXT_PUBLIC_SUPABASE_ANON_KEY si es un proyecto antiguo), y ejecuta los scripts de /supabase en el SQL Editor."
      />
    );
  }

  if (estado === 'anonimo') return <Login alEntrar={revisar} />;

  if (estado === 'sin-permiso') {
    return (
      <Aviso
        titulo={fallo ? 'No se pudo comprobar el permiso' : 'Tu cuenta no es administrador'}
        texto={
          fallo
            ? `Supabase rechazó la llamada a is_admin(): ${fallo}. Vuelve a ejecutar supabase/schema.sql en el SQL Editor — probablemente falte la función o su permiso de ejecución.`
            : `La sesión de ${correo ?? 'este usuario'} no tiene permisos. Márcala como administrador en la tabla profiles (is_admin = true); si esa fila no existe, créala.`
        }
        alSalir={async () => {
          await cerrarSesion();
          void revisar();
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-night text-white">
      <aside className="hidden w-64 flex-none flex-col border-r border-white/10 bg-night-soft lg:flex">
        <div className="border-b border-white/10 p-6">
          <p className="text-lg font-extrabold tracking-tight">
            Sugu<span className="text-sugu">Rolls</span>
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-widest text-bone-dim">Panel</p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {MENU.map(({ href, label, icono: Icono }) => {
            const activo = ruta === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${
                  activo
                    ? 'bg-sugu text-white'
                    : 'text-bone-dim hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icono className="h-4 w-4 flex-none" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-white/10 p-4">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-bone-dim transition-colors hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Ver la web
          </a>
          <button
            onClick={async () => {
              await cerrarSesion();
              void revisar();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-bone-dim transition-colors hover:bg-white/5 hover:text-sugu"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
          {correo && (
            <p className="truncate px-4 pt-2 text-[11px] text-white/30">{correo}</p>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* navegación compacta en móvil */}
        <nav className="flex gap-1 overflow-x-auto border-b border-white/10 bg-night-soft p-3 lg:hidden">
          {MENU.map(({ href, label, icono: Icono }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-none items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                ruta === href ? 'bg-sugu text-white' : 'text-bone-dim'
              }`}
            >
              <Icono className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </nav>

        <main className="p-6 sm:p-10">{children}</main>
      </div>
    </div>
  );
}

function Aviso({
  titulo,
  texto,
  alSalir,
}: {
  titulo: string;
  texto: string;
  alSalir?: () => void;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-night p-6">
      <div className="max-w-lg rounded-3xl border border-white/10 bg-night-2 p-10 text-center">
        <h1 className="text-2xl font-bold">{titulo}</h1>
        <p className="mt-4 text-sm leading-relaxed text-bone-dim">{texto}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="btn-ghost">
            Ir a la web
          </Link>
          {alSalir && (
            <button onClick={alSalir} className="btn-primary">
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
