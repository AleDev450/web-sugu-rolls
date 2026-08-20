import { Howl, Howler } from 'howler';

/**
 * Sonido de Sugu Match.
 *
 * Mismo criterio que el resto del proyecto (`src/game/audio/audio.ts` y el
 * AudioManager de Sugu Maki Maze): si el mp3 no está, no se rompe nada — un
 * sintetizador de WebAudio hace el equivalente. Así el juego suena desde el
 * primer día y los archivos definitivos se pueden ir dejando caer en
 * /public/sonidos/sugu-match/ sin tocar una línea de código.
 *
 * A diferencia del arcade, aquí los timbres son suaves y redondos: un Match-3
 * de sushi kawaii no pide onda cuadrada de recreativa.
 */

export type SfxId =
  | 'select'
  | 'swap'
  | 'swapFail'
  | 'match'
  | 'combo'
  | 'special'
  | 'bomb'
  | 'rainbow'
  | 'booster'
  | 'shuffle'
  | 'star'
  | 'levelComplete'
  | 'gameOver';

/** Rutas de los audios. Ninguna otra parte del juego conoce estas cadenas. */
export const SOUND_FILES: Record<SfxId | 'bgm', string> = {
  bgm: '/sonidos/sugu-match/bgm.mp3',
  select: '/sonidos/sugu-match/select.mp3',
  swap: '/sonidos/sugu-match/swap.mp3',
  swapFail: '/sonidos/sugu-match/swap-fail.mp3',
  match: '/sonidos/sugu-match/match.mp3',
  combo: '/sonidos/sugu-match/combo.mp3',
  special: '/sonidos/sugu-match/special.mp3',
  bomb: '/sonidos/sugu-match/bomb.mp3',
  rainbow: '/sonidos/sugu-match/rainbow.mp3',
  booster: '/sonidos/sugu-match/booster.mp3',
  shuffle: '/sonidos/sugu-match/shuffle.mp3',
  star: '/sonidos/sugu-match/star.mp3',
  levelComplete: '/sonidos/sugu-match/level-complete.mp3',
  gameOver: '/sonidos/sugu-match/game-over.mp3',
};

class SoundManager {
  private howls = new Map<string, Howl>();
  /** Archivos que dieron error de carga: no se reintentan. */
  private rotos = new Set<string>();
  private ctx: AudioContext | null = null;

  private bgm: Howl | null = null;
  private bgmId: number | undefined;
  private bgmRoto = false;
  private bgmQuerida = false;

  sonidoOn = true;
  musicaOn = true;

  /** Los navegadores exigen un gesto del usuario antes de dejar sonar nada. */
  desbloquear() {
    this.audioCtx()?.resume();
    Howler.volume(1);
  }

  private audioCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private getHowl(id: SfxId): Howl | null {
    const src = SOUND_FILES[id];
    if (this.rotos.has(src)) return null;

    let h = this.howls.get(src);
    if (!h) {
      h = new Howl({ src: [src], volume: 0.5, preload: true });
      h.once('loaderror', () => {
        this.rotos.add(src);
        this.howls.delete(src);
      });
      this.howls.set(src, h);
    }
    return h.state() === 'loaded' ? h : null;
  }

  /**
   * `variante` sube el tono en las cadenas: cada eslabón de una cascada suena
   * un poco más agudo que el anterior. Es el truco que hace que un combo largo
   * se sienta como una escalada y no como el mismo ruido siete veces.
   */
  play(id: SfxId, variante = 0) {
    if (!this.sonidoOn) return;

    const h = this.getHowl(id);
    if (h) {
      const sonido = h.play();
      if (variante > 0) h.rate(Math.min(1 + variante * 0.09, 2), sonido);
      return;
    }
    SINTETIZADOR[id](variante, this);
  }

  // --- música -------------------------------------------------------------

  precargarMusica() {
    if (this.bgmRoto || this.bgm) return;
    this.bgm = new Howl({ src: [SOUND_FILES.bgm], loop: true, volume: 0.26 });
    this.bgm.once('loaderror', () => {
      this.bgmRoto = true;
      this.bgm = null;
      this.bgmId = undefined;
    });
  }

  startMusic() {
    this.bgmQuerida = true;
    if (!this.musicaOn) return;
    this.precargarMusica();
    const m = this.bgm;
    if (!m) return;
    if (this.bgmId === undefined) this.bgmId = m.play();
    else if (!m.playing(this.bgmId)) m.play(this.bgmId);
    m.loop(true, this.bgmId);
  }

  pauseMusic() {
    if (this.bgm && this.bgmId !== undefined) this.bgm.pause(this.bgmId);
  }

  stopMusic() {
    this.bgmQuerida = false;
    if (this.bgm && this.bgmId !== undefined) this.bgm.stop(this.bgmId);
    this.bgmId = undefined;
  }

  setMusica(on: boolean) {
    this.musicaOn = on;
    if (!on) this.pauseMusic();
    else if (this.bgmQuerida) this.startMusic();
  }

  setSonido(on: boolean) {
    this.sonidoOn = on;
  }

  /** Nota sintetizada. Pública porque la usa la tabla de repuesto. */
  nota(freq: number, dur = 0.12, tipo: OscillatorType = 'sine', vol = 0.1) {
    const a = this.audioCtx();
    if (!a) return;

    const o = a.createOscillator();
    const g = a.createGain();
    o.type = tipo;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(a.destination);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.start();
    o.stop(a.currentTime + dur);
  }

  private acorde(freqs: number[], paso = 70, dur = 0.16, tipo: OscillatorType = 'triangle') {
    freqs.forEach((f, i) => setTimeout(() => this.nota(f, dur, tipo, 0.1), i * paso));
  }

  destroy() {
    this.stopMusic();
    this.howls.forEach((h) => h.unload());
    this.howls.clear();
    this.bgm?.unload();
    this.bgm = null;
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  /** Atajo para el sintetizador. */
  arpegio(freqs: number[], paso?: number, dur?: number, tipo?: OscillatorType) {
    this.acorde(freqs, paso, dur, tipo);
  }
}

/** Voces de repuesto mientras no haya mp3. */
const SINTETIZADOR: Record<SfxId, (v: number, a: SoundManager) => void> = {
  select: (_v, a) => a.nota(620, 0.06, 'sine', 0.07),
  swap: (_v, a) => a.nota(480, 0.07, 'sine', 0.08),
  swapFail: (_v, a) => {
    a.nota(220, 0.09, 'sawtooth', 0.07);
    setTimeout(() => a.nota(170, 0.11, 'sawtooth', 0.06), 70);
  },
  // cada eslabón de la cascada sube un tono: el combo se oye subir
  match: (v, a) => a.nota(480 + v * 70, 0.13, 'triangle', 0.1),
  combo: (v, a) => a.arpegio([520 + v * 60, 660 + v * 60, 820 + v * 60], 55, 0.13),
  special: (_v, a) => a.arpegio([660, 880, 1170], 60, 0.15),
  bomb: (_v, a) => {
    a.nota(120, 0.26, 'sawtooth', 0.13);
    setTimeout(() => a.nota(80, 0.3, 'sine', 0.11), 50);
  },
  rainbow: (_v, a) => a.arpegio([523, 659, 784, 1046, 1319, 1568], 55, 0.18),
  booster: (_v, a) => a.arpegio([700, 950], 60, 0.13),
  shuffle: (_v, a) => a.arpegio([400, 520, 640, 520, 400], 55, 0.1, 'sine'),
  star: (_v, a) => a.arpegio([880, 1170, 1560], 90, 0.2),
  levelComplete: (_v, a) => a.arpegio([523, 659, 784, 1046, 1319], 130, 0.28),
  gameOver: (_v, a) => a.arpegio([440, 370, 294, 220], 190, 0.3, 'sine'),
};

/** Instancia única: el juego solo suena en una pestaña a la vez. */
export const sonido = new SoundManager();
