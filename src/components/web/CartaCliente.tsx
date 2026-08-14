'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CATEGORIAS,
  PRODUCTOS,
  type Categoria,
  type CategoriaId,
  type Producto,
} from '@/data/productos';
import { traerCategorias, traerProductos } from '@/lib/contenido';
import { ProductoCard } from './ProductoCard';
import { Aparecer, TituloSeccion } from './Seccion';

type Filtro = CategoriaId | 'todos';

/** Carta con filtro por categoría. El contenido viene del panel. */
export function CartaCliente() {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  /*
   * Arranca vacío, no con el catálogo del código: al sembrarlo con datos
   * locales se veían las fotos ANTIGUAS un instante antes de que llegaran
   * las del panel. Mejor un esqueleto que enseñar algo que ya no existe.
   */
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>(CATEGORIAS);

  useEffect(() => {
    void traerProductos().then(setProductos);
    void traerCategorias().then(setCategorias);
  }, []);

  const visibles = useMemo(
    () =>
      productos === null
        ? []
        : filtro === 'todos'
          ? productos
          : productos.filter((p) => p.categoria === filtro),
    [filtro, productos]
  );

  const filtros: { id: Filtro; nombre: string }[] = [
    { id: 'todos', nombre: 'Todos' },
    ...categorias.map((c) => ({ id: c.id as Filtro, nombre: c.nombre })),
  ];

  return (
    <section className="wrap section">
      <TituloSeccion
        etiqueta="Carta"
        titulo="Nuestra"
        manuscrito="Carta"
        bajada="Todo se prepara al momento. Elige tus favoritos y arma tu pedido."
      />

      <div className="mt-10 flex flex-wrap justify-center gap-2.5">
        {filtros.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`relative rounded-full px-5 py-2.5 text-[13px] font-semibold transition-colors duration-300 ${
              filtro === f.id
                ? 'text-white'
                : 'border border-white/15 text-bone-dim hover:border-white/40 hover:text-white'
            }`}
            aria-pressed={filtro === f.id}
          >
            {filtro === f.id && (
              <motion.span
                layoutId="filtro-activo"
                className="absolute inset-0 rounded-full bg-sugu"
                transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              />
            )}
            <span className="relative">{f.nombre}</span>
          </button>
        ))}
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibles.map((producto, i) => (
          <Aparecer key={producto.id} delay={Math.min(i, 6) * 0.05}>
            <ProductoCard producto={producto} />
          </Aparecer>
        ))}
      </div>

      {visibles.length === 0 && (
        <p className="mt-16 text-center text-bone-dim">
          No hay productos en esta categoría todavía.
        </p>
      )}
    </section>
  );
}
