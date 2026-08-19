import { Howl, Howler } from 'howler';

/**
 * Sonido de Sugu Maki Maze.
 *
 * Mismo criterio que el resto del proyecto (`src/game/audio/audio.ts`): si el
 * mp3 no está, no se rompe nada — un sintetizador de WebAudio hace un pitido
 * equivalente. Así el juego suena desde el primer día y los archivos definitivos
 * se pueden ir dejando caer en /public/sonidos/maki-maze sin tocar código.
 */

export type SfxId =
  | 'collect'
  | 'power'
  | 'eatEnemy'
  | 'item'
  | 'golden'
  | 'death'
  | 'levelComplete'
  | 'gameOver'
  | 'countdown'
  | 'start';

/**
 * Rutas de los audios. Cambiar aquí basta para reubicarlos; ninguna otra parte
 * del juego conoce estas cadenas.
 */
export const SOUND_FILES: Record<SfxId | 'bgm', string> = {
  bgm: '/sonidos/maki-maze/bgm.mp3',
  collect: '/sonidos/maki-maze/collect.mp3',
  power: '/sonidos/maki-maze/power.mp3',
  eatEnemy: '/sonidos/maki-maze/eat-enemy.mp3',
  item: '/sonidos/maki-maze/item.mp3',
  golden: '/sonidos/maki-maze/golden.mp3',
  death: '/sonidos/maki-maze/death.mp3',
  levelComplete: '/sonidos/maki-maze/level-complete.mp3',
  gameOver: '/sonidos/maki-maze/game-over.mp3',
  countdown: '/sonidos/maki-maze/countdown.mp3',
  start: '/sonidos/maki-maze/start.mp3',
};

class Audio {
  private howls = new Map<string, Howl>();
  /** Archivos que dieron error de carga: no se vuelven a intentar. */
  private rotos = new Set<string>();
  private ctx: AudioContext | null = null;

  private bgm: Howl | null = null;
  private bgmId: number | undefined;
  private bgmRoto = false;
  /** Hay partida en curso, aunque el jugador tenga el sonido apagado. */
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
      h = new Howl({ src: [src], volume: 0.55, preload: true });
      h.once('loaderror', () => {
        this.rotos.add(src);
        this.howls.delete(src);
      });
      this.howls.set(src, h);
    }
    return h.state() === 'loaded' ? h : null;
  }

  play(id: SfxId, variante = 0) {
    if (!this.sonidoOn) return;
    const h = this.getHowl(id);
    if (h) h.play();
    else SINTETIZADOR[id](variante, this);
  }

  // --- música ----------------------------------------------------------

  precargarMusica() {
    if (this.bgmRoto || this.bgm) return;
    this.bgm = new Howl({ src: [SOUND_FILES.bgm], loop: true, volume: 0.3, html5: false });
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
    this.setMusicRate(1);
  }

  /** Acelera la música cuando aprieta el reloj. */
  setMusicRate(rate: number) {
    if (this.bgm && this.bgmId !== undefined) this.bgm.rate(rate, this.bgmId);
  }

  setMusica(on: boolean) {
    this.musicaOn = on;
    if (!on) this.pauseMusic();
    else if (this.bgmQuerida) this.startMusic();
  }

  setSonido(on: boolean) {
    this.sonidoOn = on;
  }

  /** Pitido sintetizado. Público porque lo usa la tabla de abajo. */
  blip(freq: number, dur = 0.09, tipo: OscillatorType = 'square', vol = 0.11) {
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

  destroy() {
    this.stopMusic();
    this.howls.forEach((h) => h.unload());
    this.howls.clear();
    this.bgm?.unload();
    this.bgm = null;
  }
}

/**
 * Voces de repuesto. Son deliberadamente cortas y con onda cuadrada: es el
 * timbre de una recreativa de 8 bits, así que el sustituto no desentona.
 */
const SINTETIZADOR: Record<SfxId, (v: number, a: Audio) => void> = {
  // el arroz alterna dos notas para que morder en cadena tenga ritmo
  collect: (v, a) => a.blip(v % 2 ? 520 : 430, 0.045, 'square', 0.06),
  power: (_v, a) => {
    [392, 523, 659, 784].forEach((f, i) => setTimeout(() => a.blip(f, 0.09, 'square', 0.1), i * 55));
  },
  // cada enemigo de la cadena suena más agudo que el anterior
  eatEnemy: (v, a) => {
    a.blip(300 + v * 120, 0.08, 'square', 0.12);
    setTimeout(() => a.blip(520 + v * 160, 0.12, 'triangle', 0.12), 70);
  },
  item: (_v, a) => {
    a.blip(660, 0.07, 'triangle', 0.11);
    setTimeout(() => a.blip(880, 0.1, 'triangle', 0.1), 60);
  },
  golden: (_v, a) => {
    [659, 784, 988, 1319].forEach((f, i) =>
      setTimeout(() => a.blip(f, 0.12, 'triangle', 0.13), i * 80)
    );
  },
  death: (_v, a) => {
    [520, 440, 360, 280, 200].forEach((f, i) =>
      setTimeout(() => a.blip(f, 0.14, 'sawtooth', 0.11), i * 90)
    );
  },
  levelComplete: (_v, a) => {
    [523, 659, 784, 1046, 1319].forEach((f, i) =>
      setTimeout(() => a.blip(f, 0.13, 'triangle', 0.13), i * 95)
    );
  },
  gameOver: (_v, a) => {
    [392, 330, 262, 196].forEach((f, i) =>
      setTimeout(() => a.blip(f, 0.24, 'sawtooth', 0.12), i * 190)
    );
  },
  countdown: (_v, a) => a.blip(660, 0.11, 'square', 0.1),
  start: (_v, a) => {
    a.blip(880, 0.1, 'square', 0.13);
    setTimeout(() => a.blip(1319, 0.22, 'square', 0.13), 110);
  },
};

/** Instancia única: el juego solo suena en una pestaña a la vez. */
export const audio = new Audio();
