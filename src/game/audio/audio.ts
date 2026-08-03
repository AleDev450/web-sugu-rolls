import { Howl, Howler } from 'howler';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * Audio con Howler. Los archivos van en /public/sonidos.
 * Mientras no existan, cae a un sintetizador WebAudio (el mismo truco del
 * prototipo) para que el juego nunca se quede mudo durante el desarrollo.
 */

type SfxId =
  | 'drop'
  | 'merge'
  | 'combo'
  | 'gameover'
  | 'win'
  | 'vip_arrive'
  | 'vip_serve'
  | 'vip_sad'
  | 'power'
  | 'festival';

const FILES: Record<SfxId, string> = {
  drop: '/sonidos/drop.mp3',
  merge: '/sonidos/merge.mp3',
  combo: '/sonidos/combo.mp3',
  gameover: '/sonidos/gameover.mp3',
  win: '/sonidos/win.mp3',
  vip_arrive: '/sonidos/vip-arrive.mp3',
  vip_serve: '/sonidos/vip-serve.mp3',
  vip_sad: '/sonidos/vip-sad.mp3',
  power: '/sonidos/power.mp3',
  festival: '/sonidos/festival.mp3',
};

const howls = new Map<SfxId, Howl>();
const unavailable = new Set<SfxId>();
let ctx: AudioContext | null = null;

const MUSIC_SRC = '/sonidos/audio_bts.mp3';
let music: Howl | null = null;
let musicId: number | undefined;
let musicBroken = false;
let musicRate = 1;
/** true mientras hay partida en curso, aunque el ajuste 🎵 la tenga silenciada */
let musicWanted = false;

function soundOn() {
  return useSettingsStore.getState().sound;
}

function musicOn() {
  return useSettingsStore.getState().music;
}

/**
 * Crea el Howl de la música y empieza a descargarla, sin sonar.
 *
 * Se llama al entrar a /juego para que el mp3 (2.7 MB) esté listo antes de que
 * el jugador pulse JUGAR: así se puede usar Web Audio en vez de streaming.
 */
function prepararMusica(): Howl | null {
  if (musicBroken) return null;
  if (music) return music;

  /*
   * `html5: false` = Web Audio. El mp3 se decodifica una vez y el bucle lo
   * hace el propio grafo de audio, sin cortes.
   *
   * Antes iba con `html5: true` (streaming) para arrancar sin esperar la
   * descarga. El precio era el bucle: el elemento <audio> llega al final,
   * dispara `ended` y el navegador tiene que volver a buscar y rellenar el
   * búfer — de ahí el silencio largo antes de que volviera a empezar. Con la
   * descarga adelantada ya no hace falta ese compromiso.
   */
  music = new Howl({ src: [MUSIC_SRC], loop: true, volume: 0.35, html5: false });

  music.once('loaderror', () => {
    musicBroken = true;
    music = null;
    musicId = undefined;
  });

  // Red de seguridad: si algún navegador ignora el loop, se relanza a mano.
  music.on('end', () => {
    if (!musicWanted || !musicOn() || !music || musicId === undefined) return;
    if (!music.playing(musicId)) music.play(musicId);
  });

  return music;
}

/** Adelanta la descarga de la música. Llamar al montar la pantalla del juego. */
export function preloadMusic() {
  prepararMusica();
}

/**
 * Música de fondo en loop. Llamar desde un gesto del usuario (click en JUGAR)
 * para que el navegador permita el autoplay.
 */
export function startMusic() {
  musicWanted = true;
  if (!musicOn()) return;

  const m = prepararMusica();
  if (!m) return;

  if (musicId === undefined) musicId = m.play();
  else if (!m.playing(musicId)) m.play(musicId);

  // el loop también por id: pasarlo solo en el constructor no siempre basta
  m.loop(true, musicId);
  if (musicRate !== 1) m.rate(musicRate, musicId);
}

export function stopMusic() {
  musicWanted = false;
  if (music && musicId !== undefined) music.stop(musicId);
  musicId = undefined;
  musicRate = 1;
}

/** Acelera/normaliza la música de fondo (BTS Festival). */
export function setMusicRate(rate: number) {
  musicRate = rate;
  if (music && musicId !== undefined) music.rate(rate, musicId);
}

// El interruptor 🎵 de Ajustes actúa al instante, también a mitad de partida.
useSettingsStore.subscribe((s, prev) => {
  if (s.music === prev.music) return;
  if (!s.music) {
    if (music && musicId !== undefined) music.pause(musicId);
  } else if (musicWanted) {
    startMusic();
  }
});

function audioCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    ctx = null;
  }
  return ctx;
}

function blip(freq: number, dur = 0.09, type: OscillatorType = 'sine', vol = 0.14) {
  const a = audioCtx();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  g.connect(a.destination);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.start();
  o.stop(a.currentTime + dur);
}

const SYNTH: Record<SfxId, (v: number) => void> = {
  drop: () => blip(220, 0.06, 'sine', 0.12),
  merge: (tier) => {
    blip(300 + tier * 70, 0.12, 'triangle', 0.2);
    setTimeout(() => blip(500 + tier * 90, 0.1, 'sine', 0.16), 50);
  },
  combo: (n) => blip(520 + n * 60, 0.1, 'square', 0.12),
  gameover: () => blip(160, 0.3, 'sawtooth', 0.18),
  win: () => {
    blip(660, 0.15, 'triangle', 0.2);
    setTimeout(() => blip(880, 0.2, 'sine', 0.18), 140);
  },
  // timbre de la puerta: el cliente VIP llega
  vip_arrive: () => {
    blip(880, 0.09, 'sine', 0.16);
    setTimeout(() => blip(1175, 0.12, 'sine', 0.14), 90);
  },
  // pedido entregado: acorde feliz ascendente
  vip_serve: () => {
    blip(523, 0.1, 'triangle', 0.18);
    setTimeout(() => blip(659, 0.1, 'triangle', 0.18), 80);
    setTimeout(() => blip(784, 0.16, 'triangle', 0.2), 160);
  },
  // el cliente se va triste: descendente suave
  vip_sad: () => {
    blip(392, 0.14, 'sine', 0.14);
    setTimeout(() => blip(294, 0.2, 'sine', 0.12), 130);
  },
  power: () => {
    blip(700, 0.08, 'square', 0.1);
    setTimeout(() => blip(1050, 0.14, 'triangle', 0.14), 70);
  },
  // fanfarria del BTS Festival
  festival: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => blip(f, 0.16, 'triangle', 0.2), i * 110)
    );
    setTimeout(() => blip(1318, 0.3, 'sine', 0.18), 470);
  },
};

function getHowl(id: SfxId): Howl | null {
  if (unavailable.has(id)) return null;
  let h = howls.get(id);
  if (!h) {
    h = new Howl({ src: [FILES[id]], volume: 0.6, preload: true });
    h.once('loaderror', () => {
      unavailable.add(id);
      howls.delete(id);
    });
    howls.set(id, h);
  }
  return h.state() === 'loaded' ? h : null;
}

export function play(id: SfxId, variant = 0) {
  if (!soundOn()) return;
  const h = getHowl(id);
  if (h) h.play();
  else SYNTH[id](variant);
}

/** Los navegadores exigen un gesto del usuario antes de sonar. */
export function unlockAudio() {
  audioCtx()?.resume();
  Howler.volume(1);
}

export function haptic(ms = 12) {
  if (!useSettingsStore.getState().haptic) return;
  navigator.vibrate?.(ms);
}
