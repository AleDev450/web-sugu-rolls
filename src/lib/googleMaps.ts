/**
 * Carga perezosa del SDK de Google Maps (Places + Distance Matrix), para el
 * autocompletado de dirección del checkout.
 *
 * Sin `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` esto nunca se llama: los campos de
 * dirección siguen siendo un input de texto normal, como antes. El mapa es
 * una mejora, no un requisito para pedir.
 */

/*
 * No se redeclara `Window.google` aquí: `BotonGoogle.tsx` ya lo hace para
 * Google Identity Services, y las dos librerías comparten ese mismo global
 * en tiempo de ejecución. Se lee con un cast local para no chocar con esa
 * declaración.
 */
export function sdkCargado(): typeof google | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { google?: typeof google }).google;
}

/** Caja que cubre Lima y Callao, para sesgar las sugerencias a la zona de reparto. */
export const LIMITES_LIMA_CALLAO = {
  norte: -11.6,
  sur: -12.6,
  este: -76.7,
  oeste: -77.3,
};

let cargando: Promise<void> | null = null;

/** ¿Hay clave configurada? Si no, ningún componente debe intentar cargar el SDK. */
export function hayGoogleMaps(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}

/** Inyecta el script una sola vez, aunque varios componentes lo pidan a la vez. */
export function cargarGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Solo en el navegador'));
  if (sdkCargado()?.maps?.places) return Promise.resolve();
  if (cargando) return cargando;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error('Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'));

  cargando = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&language=es&region=PE&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      cargando = null;
      reject(new Error('No se pudo cargar Google Maps'));
    };
    document.head.appendChild(script);
  });

  return cargando;
}

/** Distrito a partir de los componentes de la dirección que devuelve Google. */
export function distritoDeComponentes(
  componentes: google.maps.GeocoderAddressComponent[] | undefined
): string | null {
  if (!componentes) return null;
  const tipos = ['locality', 'sublocality_level_1', 'sublocality', 'administrative_area_level_2'];
  for (const tipo of tipos) {
    const c = componentes.find((c) => c.types.includes(tipo));
    if (c) return c.long_name;
  }
  return null;
}

/**
 * Distancia por carretera entre dos puntos, en kilómetros.
 *
 * Devuelve `null` ante cualquier problema (sin ruta, error de la API, cuota
 * agotada): el checkout sigue funcionando sin el estimado, que es opcional.
 */
export async function distanciaKm(
  origen: { lat: number; lng: number },
  destino: { lat: number; lng: number }
): Promise<number | null> {
  if (!sdkCargado()?.maps) return null;

  try {
    const servicio = new google.maps.DistanceMatrixService();
    const respuesta = await servicio.getDistanceMatrix({
      origins: [origen],
      destinations: [destino],
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.METRIC,
    });

    const elemento = respuesta.rows[0]?.elements[0];
    if (!elemento || elemento.status !== 'OK') return null;
    return elemento.distance.value / 1000;
  } catch {
    return null;
  }
}
