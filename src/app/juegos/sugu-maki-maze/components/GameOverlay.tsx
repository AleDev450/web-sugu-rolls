'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Gamepad2, Music, Volume2, VolumeX, X } from 'lucide-react';

import { audio } from '../game/AudioManager';
import { MAX_LIVES, OHASHI_MS, PTS, SHOYU_MS } from '../game/config';
import { useSuguMakiStore } from '../store/useSuguMakiStore';
import { formatearTiempo } from './GameHUD';
import { SpriteAnim, SpriteImg } from './SpriteImg';

/**
 * Todo lo que se pinta ENCIMA del tablero: menú, cuenta atrás, pausa, cartel
 * de nivel superado y game over.
 *
 * Ninguno de estos componentes toca el motor por su cuenta: reciben funciones
 * (`onJugar`, `onSalir`...) desde `SuguMakiGame`, que es quien manda.
 */

const fundido = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.22 },
};

const panel = {
  initial: { opacity: 0, scale: 0.9, y: 18 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.94, y: 10 },
  transition: { type: 'spring' as const, stiffness: 320, damping: 26 },
};

function formatearMiles(n: number): string {
  return n.toLocaleString('es-PE');
}

// --------------------------------------------------------------- menú

export function MenuInicio({ onJugar }: { onJugar: () => void }) {
  const best = useSuguMakiStore((s) => s.best);
  const [ayuda, setAyuda] = useState(false);

  return (
    <motion.div className="maze-overlay" {...fundido}>
      <motion.div className="maze-panel maze-panel-menu" {...panel}>
        <SpriteAnim anim="idle" size={92} fps={3} className="maze-menu-maki" />

        <h1 className="maze-titulo">
          SUGU
          <span>MAKI MAZE</span>
        </h1>
        <p className="maze-lema">¡Come, corre y domina el laberinto!</p>

        <div className="maze-record">
          MEJOR MARCA: <strong>{String(best).padStart(6, '0')}</strong>
        </div>

        <button type="button" className="maze-btn maze-btn-grande" onClick={onJugar}>
          JUGAR
        </button>

        <button type="button" className="maze-btn maze-btn-fantasma" onClick={() => setAyuda(true)}>
          <Gamepad2 size={16} /> INSTRUCCIONES
        </button>

        <Link href="/sugu-games" className="maze-volver">
          <ArrowLeft size={14} /> Volver a juegos
        </Link>
      </motion.div>

      <AnimatePresence>{ayuda && <ComoJugar onCerrar={() => setAyuda(false)} />}</AnimatePresence>
    </motion.div>
  );
}

function ComoJugar({ onCerrar }: { onCerrar: () => void }) {
  return (
    <motion.div className="maze-overlay maze-overlay-encima" {...fundido}>
      <motion.div className="maze-panel maze-panel-ayuda" {...panel}>
        <button type="button" className="maze-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <X size={18} />
        </button>

        <h2 className="maze-subtitulo">INSTRUCCIONES</h2>

        <div className="maze-ayuda-bloque">
          <h3>CONTROLES</h3>
          <p className="maze-solo-escritorio">
            <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> o las flechas · <kbd>ESC</kbd> pausa
          </p>
          <p className="maze-solo-movil">
            Arrastra el dedo por el tablero: el joystick aparece donde lo pongas
          </p>
        </div>

        <ul className="maze-leyenda">
          <li>
            <SpriteImg frame="item.rice" size={26} />
            <span>
              <strong>Arroz</strong> — {PTS.rice} pts. Recógelo todo para pasar de nivel.
            </span>
          </li>
          <li>
            <SpriteImg frame="item.gari" size={26} />
            <span>
              <strong>Gari</strong> — {PTS.gari} pts y unos segundos de velocidad extra.
            </span>
          </li>
          <li>
            <SpriteImg frame="item.nigiri" size={26} />
            <span>
              <strong>Nigiri</strong> — {PTS.nigiri} pts.
            </span>
          </li>
          <li>
            <SpriteImg frame="item.shoyu" size={26} />
            <span>
              <strong>Shoyu</strong> — {PTS.shoyu} pts y un baño de salsa: durante {SHOYU_MS / 1000}{' '}
              segundos <em>todo vale el doble</em>.
            </span>
          </li>
          <li>
            <SpriteImg frame="item.ohashi" size={26} />
            <span>
              <strong>Ohashi</strong> — {PTS.ohashi} pts y {OHASHI_MS / 1000} segundos recogiendo el
              arroz de las casillas de al lado sin pasar por encima.
            </span>
          </li>
          <li>
            <SpriteImg frame="item.heart" size={26} />
            <span>
              <strong>Corazón</strong> — una vida más (hasta {MAX_LIVES}). Si ya las tienes todas,{' '}
              {PTS.heart} pts.
            </span>
          </li>
          <li>
            <SpriteImg frame="item.wasabi" size={26} />
            <span>
              <strong>Wasabi</strong> — activa el <em>SUGU POWER</em>: unos segundos para comerte a
              los enemigos ({PTS.enemyChain.join(' / ')} pts en cadena).
            </span>
          </li>
          <li>
            <SpriteImg frame="item.golden" size={26} />
            <span>
              <strong>Maki dorado</strong> — {PTS.golden} pts. Aparece una vez por nivel y se va en 8
              segundos.
            </span>
          </li>
        </ul>

        <p className="maze-ayuda-nota">
          Termina un nivel sin perder ninguna vida y te llevas {PTS.noDamage} pts de propina, más{' '}
          {PTS.perSecondLeft} por cada segundo que sobre en el reloj.
        </p>

        <div className="maze-ayuda-bloque">
          <h3>CUIDADO CON</h3>
          <div className="maze-enemigos">
            <span>
              <SpriteImg frame="enemy.chili.0" size={34} />
              Chile: va a por ti
            </span>
            <span>
              <SpriteImg frame="enemy.wasabi.0" size={34} />
              Wasabi: te corta el paso
            </span>
            <span>
              <SpriteImg frame="enemy.ebi.0" size={34} />
              Ebi: patrulla su zona
            </span>
            <span>
              <SpriteImg frame="enemy.sauce.0" size={34} />
              Salsa: impredecible
            </span>
          </div>
        </div>

        <button type="button" className="maze-btn" onClick={onCerrar}>
          ENTENDIDO
        </button>
      </motion.div>
    </motion.div>
  );
}

// ------------------------------------------------------------ cuenta atrás

/**
 * 3 · 2 · 1 · ¡SUGU! Al terminar avisa al motor, que es quien arranca el
 * reloj y suelta a los enemigos.
 */
export function CuentaAtras({ onFin }: { onFin: () => void }) {
  const [paso, setPaso] = useState(0);
  const pasos = ['3', '2', '1', '¡SUGU!'];

  useEffect(() => {
    audio.play('countdown');
    const id = window.setInterval(() => {
      setPaso((p) => {
        const siguiente = p + 1;
        if (siguiente >= pasos.length) {
          window.clearInterval(id);
          audio.play('start');
          // fuera del setState: no se avisa al motor durante el render
          window.setTimeout(onFin, 420);
          return p;
        }
        audio.play('countdown');
        return siguiente;
      });
    }, 720);

    return () => window.clearInterval(id);
    // se monta una vez por cuenta atrás; el efecto no depende de nada más
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div className="maze-overlay maze-overlay-suave" {...fundido}>
      <AnimatePresence mode="wait">
        <motion.div
          key={paso}
          className={`maze-cuenta${paso === pasos.length - 1 ? ' ya' : ''}`}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          {pasos[paso]}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ------------------------------------------------------------------ pausa

export function Pausa({ onSeguir, onSalir }: { onSeguir: () => void; onSalir: () => void }) {
  const sonido = useSuguMakiStore((s) => s.sonido);
  const musica = useSuguMakiStore((s) => s.musica);
  const toggleSonido = useSuguMakiStore((s) => s.toggleSonido);
  const toggleMusica = useSuguMakiStore((s) => s.toggleMusica);

  return (
    <motion.div className="maze-overlay" {...fundido}>
      <motion.div className="maze-panel" {...panel}>
        <h2 className="maze-titulo maze-titulo-chico">PAUSA</h2>

        <div className="maze-ajustes">
          <button
            type="button"
            className={`maze-chip${sonido ? ' on' : ''}`}
            onClick={toggleSonido}
            aria-pressed={sonido}
          >
            {sonido ? <Volume2 size={15} /> : <VolumeX size={15} />} Efectos
          </button>
          <button
            type="button"
            className={`maze-chip${musica ? ' on' : ''}`}
            onClick={toggleMusica}
            aria-pressed={musica}
          >
            <Music size={15} /> Música
          </button>
        </div>

        <button type="button" className="maze-btn maze-btn-grande" onClick={onSeguir}>
          CONTINUAR
        </button>
        <button type="button" className="maze-btn maze-btn-fantasma" onClick={onSalir}>
          SALIR
        </button>
      </motion.div>
    </motion.div>
  );
}

// ------------------------------------------------------- nivel completado

export function NivelCompletado() {
  const level = useSuguMakiStore((s) => s.level);
  const timeMs = useSuguMakiStore((s) => s.timeMs);
  const bonus = Math.floor(timeMs / 1000) * PTS.perSecondLeft;

  return (
    <motion.div className="maze-overlay maze-overlay-suave" {...fundido}>
      <motion.div
        className="maze-cartel"
        initial={{ scale: 0.6, opacity: 0, rotate: -4 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        exit={{ scale: 1.2, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      >
        <SpriteAnim anim="happy" size={64} fps={9} />
        <strong>¡NIVEL {level} COMPLETADO!</strong>
        <span>
          +{formatearMiles(PTS.levelComplete)} · bonus tiempo +{formatearMiles(bonus)}
        </span>
      </motion.div>
    </motion.div>
  );
}

// -------------------------------------------------------------- game over

export function GameOver({ onReiniciar }: { onReiniciar: () => void }) {
  const result = useSuguMakiStore((s) => s.result);
  const best = useSuguMakiStore((s) => s.best);
  if (!result) return null;

  const recordNuevo = result.score >= best && result.score > 0;

  return (
    <motion.div className="maze-overlay" {...fundido}>
      <motion.div className="maze-panel maze-panel-fin" {...panel}>
        <SpriteImg frame="player.dead" size={72} className="maze-fin-maki" />
        <h2 className="maze-titulo maze-titulo-chico">GAME OVER</h2>

        {recordNuevo && (
          <motion.div
            className="maze-nuevo-record"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <SpriteImg frame="ui.crown" size={22} /> ¡NUEVA MARCA!
          </motion.div>
        )}

        <dl className="maze-resumen">
          <div>
            <dt>Puntaje</dt>
            <dd className="maze-resumen-fuerte">{formatearMiles(result.score)}</dd>
          </div>
          <div>
            <dt>Nivel alcanzado</dt>
            <dd>Nivel {result.level}</dd>
          </div>
          <div>
            <dt>Tiempo jugado</dt>
            <dd>{formatearTiempo(result.duration)}</dd>
          </div>
          <div>
            <dt>Enemigos comidos</dt>
            <dd>{result.enemiesEaten}</dd>
          </div>
        </dl>

        <div className="maze-botellas">
          <span>
            <SpriteImg frame="item.rice" size={20} /> {result.collectedItems.rice}
          </span>
          <span>
            <SpriteImg frame="item.nigiri" size={20} /> {result.collectedItems.nigiri}
          </span>
          <span>
            <SpriteImg frame="item.gari" size={20} /> {result.collectedItems.gari}
          </span>
          <span>
            <SpriteImg frame="item.golden" size={20} /> {result.collectedItems.golden}
          </span>
        </div>

        <button type="button" className="maze-btn maze-btn-grande" onClick={onReiniciar}>
          JUGAR DE NUEVO
        </button>
        <Link href="/sugu-games" className="maze-btn maze-btn-fantasma">
          VOLVER A JUEGOS
        </Link>
      </motion.div>
    </motion.div>
  );
}

// ----------------------------------------------------------- aviso flotante

/** "¡SUGU POWER!", "¡SUGU BONUS!", "MAESTRO MAKI"... */
export function AvisoFlotante() {
  const aviso = useSuguMakiStore((s) => s.aviso);
  const quitar = useSuguMakiStore((s) => s.quitarAviso);

  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => quitar(aviso.id), 2000);
    return () => window.clearTimeout(id);
  }, [aviso, quitar]);

  return (
    <AnimatePresence>
      {aviso && (
        <motion.div
          key={aviso.id}
          className={`maze-aviso tono-${aviso.tono}`}
          initial={{ opacity: 0, y: 20, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -18, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 340, damping: 22 }}
        >
          {aviso.texto}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
