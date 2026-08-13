'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, ShoppingBag, User, X } from 'lucide-react';
import { NAV } from '@/data/site';
import { salir } from '@/lib/tienda';
import { moduloActivo, traerAjustes, type AjustesSitio } from '@/lib/contenido';
import { getSupabase } from '@/lib/supabase/client';
import { useCartStore } from '@/store/useCartStore';
import { Logo } from './Logo';

/**
 * Encabezado fijo: transparente sobre el hero de la portada y con fondo negro
 * al bajar. Fuera de la portada arranca ya con fondo, porque hay secciones de
 * fondo rojo (promociones) donde el botón rojo se perdería.
 * En móvil despliega un panel a pantalla completa.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const abrirCarrito = useCartStore((s) => s.abrir);
  const unidades = useCartStore((s) => s.items.reduce((t, i) => t + i.cantidad, 0));
  const [haySesion, setHaySesion] = useState(false);
  /* null mientras se consulta: se muestra el menú entero para no parpadear */
  const [ajustes, setAjustes] = useState<AjustesSitio | null>(null);
  const ruta = usePathname();
  const enPortada = ruta === '/';
  const compacto = scrolled || !enPortada;

  /*
   * La sesión se mira en Auth, no en `profiles`.
   *
   * Antes se usaba `miPerfil()`, que además de la sesión necesita que exista
   * la fila del perfil: si faltaba, el menú decía "Crear mi cuenta" a alguien
   * que ya había entrado. `onAuthStateChange` además reacciona al instante al
   * entrar o salir, sin esperar a cambiar de página.
   */
  useEffect(() => {
    const cliente = getSupabase();
    if (!cliente) return;

    void cliente.auth.getSession().then(({ data }) => setHaySesion(!!data.session));
    const { data: sub } = cliente.auth.onAuthStateChange((_e, sesion) =>
      setHaySesion(!!sesion)
    );
    return () => sub.subscription.unsubscribe();
  }, [ruta]);

  useEffect(() => {
    void traerAjustes().then(setAjustes);
  }, []);

  useEffect(() => {
    const alScroll = () => setScrolled(window.scrollY > 24);
    alScroll();
    window.addEventListener('scroll', alScroll, { passive: true });
    return () => window.removeEventListener('scroll', alScroll);
  }, []);

  // con el menú abierto no se hace scroll detrás
  useEffect(() => {
    document.body.style.overflow = menuAbierto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuAbierto]);

  const menu = ajustes ? NAV.filter((i) => moduloActivo(ajustes, i.href)) : NAV;
  const verCuenta = !ajustes || ajustes.mod_cuenta;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-premium ${
          compacto
            ? 'border-b border-white/10 bg-night/95 py-3.5 backdrop-blur-xl'
            : 'border-b border-transparent py-7'
        }`}
      >
        <div className="wrap flex items-center justify-between gap-8">
          <Logo ancho={compacto ? 100 : 126} prioridad className="transition-all duration-500" />

          <nav className="hidden items-center gap-10 lg:flex" aria-label="Principal">
            {menu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group relative text-[14px] font-medium text-bone-dim transition-colors hover:text-white"
              >
                {item.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-sugu transition-all duration-300 ease-premium group-hover:w-full" />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            {/*
              Entrada a la cuenta. La misma pantalla sirve para registrarse y
              para entrar, así que el texto cambia según haya sesión: quien no
              tiene cuenta ve una invitación, no un "mi cuenta" que no es suyo.
            */}
            {verCuenta && (
              <Link
                href="/cuenta"
                className="hidden items-center gap-2 rounded-full border border-white/15 px-5 py-3.5 text-[14px] font-medium text-bone-dim transition-colors hover:border-white/40 hover:text-white sm:inline-flex"
              >
                <User className="h-4.5 w-4.5" />
                {haySesion ? 'Mi cuenta' : 'Registrarme'}
              </Link>
            )}

            <button
              onClick={abrirCarrito}
              className="btn-primary relative !px-7 !py-3.5 text-[14px]"
            >
              <ShoppingBag className="h-4.5 w-4.5" />
              <span className="hidden sm:inline">Pedir ahora</span>
              {unidades > 0 && (
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[12px] font-bold text-sugu">
                  {unidades}
                </span>
              )}
            </button>

            <button
              onClick={() => setMenuAbierto(true)}
              className="rounded-full border border-white/15 p-2.5 text-white transition-colors hover:border-white/40 lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuAbierto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-night/[0.97] backdrop-blur-2xl lg:hidden"
          >
            <div className="wrap flex items-center justify-between py-4">
              <Logo ancho={110} />
              <button
                onClick={() => setMenuAbierto(false)}
                className="rounded-full border border-white/15 p-2.5 text-white"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="wrap mt-4 flex flex-col" aria-label="Principal móvil">
              {menu.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMenuAbierto(false)}
                    className="block border-b border-white/10 py-3 text-base font-semibold text-white transition-colors hover:text-sugu"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            <div className="wrap mt-6 space-y-2">
              {verCuenta && (
                <Link
                  href="/cuenta"
                  onClick={() => setMenuAbierto(false)}
                  className="btn-ghost w-full"
                >
                  <User className="h-4.5 w-4.5" />
                  {haySesion ? 'Mi cuenta y mis puntos' : 'Crear mi cuenta'}
                </Link>
              )}
              {haySesion && (
                <button
                  onClick={async () => {
                    await salir();
                    setMenuAbierto(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 py-3 text-[13px] text-bone-dim transition-colors hover:text-sugu"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
