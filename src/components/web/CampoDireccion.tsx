'use client';

import { useEffect, useRef, useState } from 'react';
import {
  cargarGoogleMaps,
  distritoDeComponentes,
  hayGoogleMaps,
  sdkCargado,
  LIMITES_LIMA_CALLAO,
} from '@/lib/googleMaps';

export interface LugarElegido {
  direccion: string;
  distrito: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * Input de dirección con autocompletado de Google Maps, acotado a Lima y
 * Callao.
 *
 * Sin `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (o si el SDK no carga por cualquier
 * motivo) se queda como un input de texto normal: la dirección se sigue
 * pudiendo escribir a mano, tal como funcionaba antes de esto.
 */
export function CampoDireccion({
  value,
  onChange,
  onLugar,
  placeholder = 'Calle, número, referencia, distrito',
  className,
  id,
  required,
}: {
  value: string;
  onChange: (direccion: string) => void;
  /** se dispara cuando el cliente elige una sugerencia real, con distrito y coordenadas */
  onLugar?: (lugar: LugarElegido) => void;
  placeholder?: string;
  className: string;
  id?: string;
  required?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [listo, setListo] = useState(false);

  // las últimas funciones, en una ref: así el efecto no reinicia el Autocomplete en cada tecla
  const callbacks = useRef({ onChange, onLugar });
  callbacks.current = { onChange, onLugar };

  useEffect(() => {
    if (!hayGoogleMaps()) return;
    let vivo = true;
    cargarGoogleMaps()
      .then(() => {
        if (vivo) setListo(true);
      })
      .catch(() => {
        // sin SDK, el input se queda como texto normal
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!listo || !input.current || !sdkCargado()) return;

    const bounds = new google.maps.LatLngBounds(
      { lat: LIMITES_LIMA_CALLAO.sur, lng: LIMITES_LIMA_CALLAO.oeste },
      { lat: LIMITES_LIMA_CALLAO.norte, lng: LIMITES_LIMA_CALLAO.este }
    );

    const autocomplete = new google.maps.places.Autocomplete(input.current, {
      bounds,
      strictBounds: true,
      componentRestrictions: { country: 'pe' },
      fields: ['formatted_address', 'address_components', 'geometry'],
      types: ['address'],
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const lugar = autocomplete.getPlace();
      const direccion = lugar.formatted_address || input.current?.value || '';
      callbacks.current.onChange(direccion);
      callbacks.current.onLugar?.({
        direccion,
        distrito: distritoDeComponentes(lugar.address_components),
        lat: lugar.geometry?.location?.lat() ?? null,
        lng: lugar.geometry?.location?.lng() ?? null,
      });
    });

    return () => listener.remove();
  }, [listo]);

  return (
    <input
      ref={input}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      placeholder={placeholder}
      autoComplete="off"
      required={required}
    />
  );
}
