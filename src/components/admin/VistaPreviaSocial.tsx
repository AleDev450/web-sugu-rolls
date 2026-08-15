import Image from 'next/image';

/** Cómo se ve la tarjeta al pegar el enlace en WhatsApp o Facebook (Open Graph). */
export function VistaPreviaSocial({
  dominio,
  titulo,
  descripcion,
  imagen,
}: {
  dominio: string;
  titulo: string;
  descripcion: string;
  imagen: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white text-black">
      <div className="relative aspect-[1.91/1] w-full bg-neutral-100">
        <Image src={imagen} alt="" fill sizes="360px" className="object-cover" unoptimized />
      </div>
      <div className="space-y-0.5 border-t border-black/10 bg-neutral-50 p-3">
        <p className="truncate text-[10px] uppercase tracking-wide text-neutral-500">{dominio}</p>
        <p className="truncate text-[13px] font-semibold leading-tight text-neutral-900">
          {titulo}
        </p>
        <p className="line-clamp-2 text-[11px] leading-snug text-neutral-500">{descripcion}</p>
      </div>
    </div>
  );
}
