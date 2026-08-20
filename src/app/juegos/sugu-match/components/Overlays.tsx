'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ULTIMO_NIVEL } from '../game/config/levels';
import { tileEmoji, tileNombre, TILES } from '../game/config/tiles';
import { ESTRELLAS, laminaCss, LOGO, recorteCss } from '../game/render/interfaz';
import type { FrameId } from '../game/render/sprites';
import { useSuguMatchStore } from '../store/useSuguMatchStore';
import { SpriteImg } from './SpriteImg';

/**
 * Carteles que se pintan sobre el tablero.
 *
 * Todo esto es DOM, no Pixi: son textos, botones y cosas que tienen que poder
 * enfocarse con el teclado y leerse con un lector de pantalla. Meterlos en el
 * canvas los volvería invisibles para cualquiera que no juegue con el ratón.
 */

const entrada = {
  initial: { opacity: 0, scale: 0.9, y: 18 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.94, y: -10 },
  transition: { type: 'spring' as const, stiffness: 320, damping: 26 },
};

function Fondo({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="match-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div className="match-cartel" {...entrada}>
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Las mismas estrellas dibujadas del marcador, en grande. */
function Estrellas({ n }: { n: number }) {
  return (
    <div className="match-cartel__estrellas" aria-label={`${n} de 3 estrellas`}>
      {[1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className={`match-estrella match-estrella--grande${n >= i ? ' es-ganada' : ''}`}
          style={recorteCss(ESTRELLAS, n >= i ? ESTRELLAS.oro : ESTRELLAS.apagada)}
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15 * i, type: 'spring', stiffness: 400, damping: 14 }}
        />
      ))}
    </div>
  );
}

// --- menú de inicio -------------------------------------------------------

export function MenuInicio({ onJugar }: { onJugar: () => void }) {
  const best = useSuguMatchStore((s) => s.best);
  const nombre = useSuguMatchStore((s) => s.levelNombre);

  return (
    <Fondo>
      <p className="match-cartel__logo" style={laminaCss(LOGO)} role="img" aria-label="Sugu Match" />
      <p className="match-cartel__texto">
        Junta tres o más makis iguales. Forma líneas de cuatro para el maki rayado, cruces
        para la bomba y cinco en fila para el Rainbow Maki.
      </p>
      <p className="match-cartel__nivel">{nombre}</p>
      {best > 0 && <p className="match-cartel__best">Tu récord: {best.toLocaleString('es-PE')}</p>}
      <button type="button" className="match-boton" onClick={onJugar} autoFocus>
        JUGAR
      </button>
    </Fondo>
  );
}

// --- pausa ----------------------------------------------------------------

export function Pausa({ onSeguir, onSalir }: { onSeguir: () => void; onSalir: () => void }) {
  const sonido = useSuguMatchStore((s) => s.sonido);
  const musica = useSuguMatchStore((s) => s.musica);
  const toggleSonido = useSuguMatchStore((s) => s.toggleSonido);
  const toggleMusica = useSuguMatchStore((s) => s.toggleMusica);

  return (
    <Fondo>
      <p className="match-cartel__titulo">PAUSA</p>
      <div className="match-ajustes">
        <button type="button" className="match-chip" onClick={toggleSonido}>
          Efectos: {sonido ? 'ON' : 'OFF'}
        </button>
        <button type="button" className="match-chip" onClick={toggleMusica}>
          Música: {musica ? 'ON' : 'OFF'}
        </button>
      </div>
      <button type="button" className="match-boton" onClick={onSeguir} autoFocus>
        SEGUIR JUGANDO
      </button>
      <button type="button" className="match-boton match-boton--suave" onClick={onSalir}>
        REINICIAR NIVEL
      </button>
    </Fondo>
  );
}

// --- nivel completado -----------------------------------------------------

export function NivelCompletado({
  onSiguiente,
  onRepetir,
}: {
  onSiguiente: () => void;
  onRepetir: () => void;
}) {
  const result = useSuguMatchStore((s) => s.result);
  const best = useSuguMatchStore((s) => s.best);
  if (!result) return null;

  const hayMas = result.level < ULTIMO_NIVEL;
  const record = result.score >= best;

  return (
    <Fondo>
      <p className="match-cartel__titulo match-cartel__titulo--exito">¡NIVEL COMPLETADO!</p>
      <Estrellas n={result.stars} />
      <p className="match-cartel__score">{result.score.toLocaleString('es-PE')}</p>
      {record && <p className="match-cartel__best">¡Nuevo récord!</p>}
      <p className="match-cartel__texto">
        Movimientos usados: {result.movesUsed} · Te sobraron {result.movesLeft}
      </p>
      {hayMas ? (
        <button type="button" className="match-boton" onClick={onSiguiente} autoFocus>
          SIGUIENTE NIVEL
        </button>
      ) : (
        <p className="match-cartel__texto">
          Has terminado todos los niveles disponibles. ¡Vienen más!
        </p>
      )}
      <button type="button" className="match-boton match-boton--suave" onClick={onRepetir}>
        REPETIR NIVEL
      </button>
    </Fondo>
  );
}

// --- game over ------------------------------------------------------------

export function GameOver({ onReintentar }: { onReintentar: () => void }) {
  const result = useSuguMatchStore((s) => s.result);
  const objetivos = useSuguMatchStore((s) => s.objectives);
  if (!result) return null;

  const pendientes = objetivos.filter((o) => o.remaining > 0);

  return (
    <Fondo>
      <p className="match-cartel__titulo match-cartel__titulo--fallo">SIN MOVIMIENTOS</p>
      <p className="match-cartel__score">{result.score.toLocaleString('es-PE')}</p>
      {pendientes.length > 0 && (
        <>
          <p className="match-cartel__texto">Te faltó:</p>
          <ul className="match-pendientes">
            {pendientes.map((o, i) => (
              <li key={i}>
                {o.type === 'collect' && o.tile ? (
                  <>
                    <SpriteImg
                      frame={TILES[o.tile].frame as FrameId}
                      size={26}
                      fallback={tileEmoji(o.tile)}
                    />
                    <span>
                      {o.remaining} {tileNombre(o.tile)}
                    </span>
                  </>
                ) : (
                  <span>
                    {o.remaining} {o.layer === 'rope' ? 'cuerdas' : 'bloques de hielo'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="match-boton" onClick={onReintentar} autoFocus>
        REINTENTAR
      </button>
    </Fondo>
  );
}

// --- aviso efímero --------------------------------------------------------

export function AvisoFlotante() {
  const aviso = useSuguMatchStore((s) => s.aviso);
  const quitar = useSuguMatchStore((s) => s.quitarAviso);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => quitar(aviso.id), 1400);
    return () => clearTimeout(t);
  }, [aviso, quitar]);

  return (
    <AnimatePresence>
      {aviso && (
        <motion.p
          key={aviso.id}
          className={`match-aviso match-aviso--${aviso.tono}`}
          initial={{ opacity: 0, scale: 0.6, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.25, y: -20 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18 }}
        >
          {aviso.texto}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
