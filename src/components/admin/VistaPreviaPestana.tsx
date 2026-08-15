import Image from 'next/image';

/** Cómo se ve la pestaña del navegador: favicon + título recortado. */
export function VistaPreviaPestana({ favicon, titulo }: { favicon: string; titulo: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-neutral-200 p-3">
      <div className="flex max-w-[240px] items-center gap-2 rounded-t-lg border border-b-0 border-black/5 bg-white px-3 py-2 shadow-sm">
        <div className="relative h-4 w-4 flex-none overflow-hidden rounded-[2px]">
          <Image src={favicon} alt="" fill sizes="16px" className="object-contain" unoptimized />
        </div>
        <span className="truncate text-[11px] text-neutral-700">{titulo}</span>
      </div>
    </div>
  );
}
