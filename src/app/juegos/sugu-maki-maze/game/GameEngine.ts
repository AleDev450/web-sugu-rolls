import { Application, Container, Graphics, Sprite, Text, TextStyle, type Ticker } from 'pixi.js';
import gsap from 'gsap';

import { audio } from './AudioManager';
import { dibujarTablero, type Tablero } from './board';
import { Maze } from './collision';
import {
  BOARD_H,
  BOARD_W,
  COLS,
  COMBO_MAX,
  COMBO_MS,
  COMBO_STEP,
  CROWN_SCORE,
  DEATH_PAUSE_MS,
  DEBUG_GAME,
  GOLDEN_MS,
  GOLDEN_TRIGGER_RATIO,
  HIT_RADIUS,
  LEVEL_COMPLETE_MS,
  MASTER_SCORE,
  POWER_MS,
  POWER_WARN_MS,
  PTS,
  ROWS,
  START_LIVES,
  TILE,
  TIME_WARNING_S,
} from './config';
import { Enemy } from './Enemy';
import { getLevelConfig, type LevelConfig } from './levels';
import { Player } from './Player';
import { ANIMS, CELDA_NOMINAL, type FrameId } from './sprites';
import {
  arrozTexture,
  cargarHoja,
  frame,
  liberarTexturas,
  PALETA,
  resplandorTexture,
} from './textures';
import { useSuguMakiStore } from '../store/useSuguMakiStore';
import { guardarResultado } from './scores';
import type { Dir, GameResult, ItemKind, Tile } from './types';

/**
 * Motor de Sugu Maki Maze.
 *
 * Es el dueño de la simulación: posiciones, tiempos, puntos y colisiones viven
 * aquí y se actualizan dentro del ticker de PixiJS. React no participa en el
 * bucle — solo recibe un resumen por `sync()` cuando algo cambia de verdad.
 *
 * Fases internas (`fase`) frente a los estados que ve React (`status`):
 * el motor necesita distinguir "muriendo" o "esperando la cuenta atrás", que
 * para el HUD son lo mismo que "jugando". Por eso hay dos escalas.
 */

type Fase = 'espera' | 'jugando' | 'muriendo' | 'nivel-completado' | 'fin';

/** Cuánto tarda cada enemigo en asomar por la puerta al empezar el nivel. */
const SALIDA_MS = [0, 2200, 4600, 7200];

const ESTILO_FLOTANTE = new TextStyle({
  fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  fontSize: 22,
  fontWeight: '900',
  fill: '#ffe9a8',
  stroke: { color: '#3a0b06', width: 5 },
});

export class GameEngine {
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private observador: ResizeObserver | null = null;

  /** Contenedor que se escala para encajar el tablero en el canvas. */
  private world = new Container();
  private capaTablero = new Container();
  private capaPuntos = new Container();
  private capaObjetos = new Container();
  private capaActores = new Container();
  private capaFx = new Container();
  private capaDebug = new Graphics();

  private tablero: Tablero | null = null;
  private maze!: Maze;
  private nivel!: LevelConfig;

  private player!: Player;
  private playerSprite!: Sprite;
  private corona: Sprite | null = null;
  private enemigos: Enemy[] = [];
  private enemigoSprites = new Map<Enemy, { cuerpo: Sprite; halo: Sprite }>();

  /** Arroz vivo, indexado por casilla. */
  private puntos = new Map<number, Sprite>();
  /** Objetos especiales vivos, indexados por casilla. */
  private objetos = new Map<number, { sprite: Sprite; kind: ItemKind }>();
  private totalRecogibles = 1;
  private recogidos = 0;

  private golden: Sprite | null = null;
  private goldenMs = 0;
  private goldenUsado = false;

  private fase: Fase = 'espera';
  private tiempoMs = 0;
  private tiempoTotalMs = 1;
  private powerMs = 0;
  private cadena = 0;
  private rachaMs = 0;
  private racha = 0;
  private faseMs = 0;
  private cicloIndice = 0;
  private cicloMs = 0;

  private vidas = START_LIVES;
  private puntuacion = 0;
  private nivelNumero = 1;
  private duracionAcumulada = 0;
  private recuento: Record<ItemKind, number> = {
    rice: 0,
    nigiri: 0,
    gari: 0,
    wasabi: 0,
    golden: 0,
  };
  private enemigosComidos = 0;
  private coronaMostrada = false;
  private maestroMostrado = false;

  private debug = DEBUG_GAME;
  /** Acumulado desde el último aviso al store, para no escribir cada frame. */
  private msDesdeSync = 0;

  // ---------------------------------------------------------------- ciclo

  async init(host: HTMLElement) {
    this.host = host;
    if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
      this.debug = true;
    }

    await cargarHoja();

    const app = new Application();
    await app.init({
      backgroundAlpha: 0,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      width: BOARD_W,
      height: BOARD_H,
      /*
       * Pixi para de dibujar solo cuando la pestaña se oculta. El reloj del
       * nivel también se para (`document.hidden` en el tick), así que nadie
       * pierde una partida por cambiar de pestaña.
       */
      powerPreference: 'high-performance',
    });

    this.app = app;
    host.appendChild(app.canvas);
    app.canvas.style.display = 'block';
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';

    this.world.addChild(
      this.capaTablero,
      this.capaPuntos,
      this.capaObjetos,
      this.capaActores,
      this.capaFx,
      this.capaDebug
    );
    app.stage.addChild(this.world);

    /*
     * Con `?debug` el motor queda accesible desde la consola. Sirve para
     * afinar el equilibrio sin recompilar (mirar velocidades, saltar de nivel)
     * y para las pruebas automáticas. Fuera de ese modo no se expone nada.
     */
    if (this.debug) {
      (window as unknown as { __suguMaze?: GameEngine }).__suguMaze = this;
    }

    this.observador = new ResizeObserver(() => this.ajustarEscala());
    this.observador.observe(host);
    this.ajustarEscala();

    app.ticker.add(this.tick);
  }

  destroy() {
    this.app?.ticker.remove(this.tick);
    this.observador?.disconnect();
    this.observador = null;
    gsap.killTweensOf(this.capaFx.children);
    this.tablero?.destroy();
    this.tablero = null;
    /*
     * `texture: false`: la hoja de sprites vive en la caché de Assets y la
     * comparten todas las partidas. Destruirla obligaría a volver a
     * descargarla al reiniciar.
     */
    this.app?.destroy({ removeView: true }, { children: true, texture: false });
    this.app = null;
    liberarTexturas();
    audio.stopMusic();
  }

  private ajustarEscala() {
    const app = this.app;
    const host = this.host;
    if (!app || !host) return;

    const w = host.clientWidth || BOARD_W;
    const h = host.clientHeight || BOARD_H;
    if (w < 2 || h < 2) return;

    app.renderer.resize(w, h);
    const k = Math.min(w / BOARD_W, h / BOARD_H);
    this.world.scale.set(k);
    this.world.position.set((w - BOARD_W * k) / 2, (h - BOARD_H * k) / 2);
  }

  // --------------------------------------------------------------- partida

  /** Empieza una partida nueva desde el nivel 1. */
  empezarPartida() {
    this.vidas = START_LIVES;
    this.puntuacion = 0;
    this.nivelNumero = 1;
    this.duracionAcumulada = 0;
    this.enemigosComidos = 0;
    this.coronaMostrada = false;
    this.maestroMostrado = false;
    this.recuento = { rice: 0, nigiri: 0, gari: 0, wasabi: 0, golden: 0 };

    const store = useSuguMakiStore.getState();
    store.setResult(null);
    store.sync({ score: 0, lives: this.vidas, level: 1, combo: 0, progress: 0, powerMs: 0 });

    this.cargarNivel(1);
    this.pedirCuentaAtras();
  }

  private pedirCuentaAtras() {
    this.fase = 'espera';
    useSuguMakiStore.getState().setStatus('countdown');
  }

  /** Lo llama el overlay cuando termina el 3-2-1-SUGU. */
  arrancar() {
    if (this.fase !== 'espera') return;
    this.fase = 'jugando';
    useSuguMakiStore.getState().setStatus('playing');
    audio.startMusic();
  }

  pausar() {
    if (this.fase !== 'jugando') return;
    useSuguMakiStore.getState().setStatus('paused');
    audio.pauseMusic();
  }

  reanudar() {
    if (useSuguMakiStore.getState().status !== 'paused') return;
    useSuguMakiStore.getState().setStatus('playing');
    audio.startMusic();
  }

  /** Dirección pedida por teclado, swipe o d-pad. */
  mover(dir: Dir) {
    if (this.fase !== 'jugando') return;
    if (useSuguMakiStore.getState().status !== 'playing') return;
    this.player?.pedir(dir);
  }

  // ----------------------------------------------------------------- nivel

  private cargarNivel(numero: number) {
    this.nivelNumero = numero;
    this.nivel = getLevelConfig(numero);
    this.maze = new Maze(this.nivel.map);

    this.limpiarNivel();

    // --- tablero
    this.tablero = dibujarTablero(this.maze);
    this.capaTablero.addChild(this.tablero.view);

    // --- arroz
    const texArroz = arrozTexture(this.app!.renderer);
    for (const t of this.maze.pellets) {
      const s = new Sprite(texArroz);
      s.anchor.set(0.5);
      s.width = s.height = TILE * 0.3;
      s.position.set(Maze.centerX(t.x), Maze.centerY(t.y));
      this.capaPuntos.addChild(s);
      this.puntos.set(this.indice(t), s);
    }

    // --- objetos especiales
    for (const it of this.maze.items) this.crearObjeto(it.tile, it.kind);

    this.totalRecogibles = this.puntos.size + this.objetos.size;
    this.recogidos = 0;

    // --- actores
    this.player = new Player(this.maze);
    this.player.baseSpeed = this.nivel.playerSpeed;
    /*
     * Quieto hasta la primera tecla, mirando a la izquierda. Arrancar ya en
     * marcha le regalaría al jugador un tramo de arroz que no ha jugado, y en
     * cuanto termina la cuenta atrás lo primero que ve es su maki moviéndose
     * solo.
     */
    this.player.colocar(this.maze.playerSpawn, 'none');
    this.player.facing = 'left';

    this.playerSprite = new Sprite(frame('player.happy.0'));
    this.playerSprite.anchor.set(0.5);
    this.playerSprite.scale.set((TILE * 1.45) / CELDA_NOMINAL);
    this.capaActores.addChild(this.playerSprite);

    this.enemigos = this.nivel.enemies.map((kind, i) => {
      const spawn = this.maze.enemySpawns[i] ?? this.maze.houseCenter;
      const e = new Enemy(this.maze, kind, spawn, SALIDA_MS[i] ?? 0);
      e.baseSpeed = this.nivel.enemySpeed;
      e.colocar(spawn, 'up');
      return e;
    });

    const texHalo = resplandorTexture(this.app!.renderer);
    for (const e of this.enemigos) {
      const halo = new Sprite(texHalo);
      halo.anchor.set(0.5);
      halo.width = halo.height = TILE * 2.1;
      halo.alpha = 0;
      halo.blendMode = 'add';
      this.capaActores.addChild(halo);

      const cuerpo = new Sprite(frame(ANIMS[e.kind][0]));
      cuerpo.anchor.set(0.5);
      cuerpo.scale.set((TILE * 1.4) / CELDA_NOMINAL);
      this.capaActores.addChild(cuerpo);

      this.enemigoSprites.set(e, { cuerpo, halo });
    }

    // --- relojes
    this.tiempoTotalMs = this.nivel.seconds * 1000;
    this.tiempoMs = this.tiempoTotalMs;
    this.powerMs = 0;
    this.cadena = 0;
    this.racha = 0;
    this.rachaMs = 0;
    this.cicloIndice = 0;
    this.cicloMs = this.nivel.modeCycle[0];
    this.goldenMs = 0;
    this.goldenUsado = false;
    this.faseMs = 0;

    useSuguMakiStore.getState().sync({
      level: numero,
      timeMs: this.tiempoMs,
      timeTotalMs: this.tiempoTotalMs,
      progress: 0,
      combo: 0,
      powerMs: 0,
      lives: this.vidas,
    });
  }

  private limpiarNivel() {
    this.tablero?.destroy();
    this.tablero = null;
    this.capaTablero.removeChildren();
    this.capaPuntos.removeChildren().forEach((c) => c.destroy());
    this.capaObjetos.removeChildren().forEach((c) => c.destroy());
    this.capaActores.removeChildren().forEach((c) => c.destroy());
    gsap.killTweensOf(this.capaFx.children);
    this.capaFx.removeChildren().forEach((c) => c.destroy());
    this.puntos.clear();
    this.objetos.clear();
    this.enemigoSprites.clear();
    this.enemigos = [];
    this.golden = null;
    this.corona = null;
  }

  private crearObjeto(tile: Tile, kind: ItemKind) {
    const id: FrameId =
      kind === 'nigiri'
        ? 'item.nigiri'
        : kind === 'gari'
          ? 'item.gari'
          : kind === 'wasabi'
            ? 'item.wasabi'
            : 'item.golden';

    const s = new Sprite(frame(id));
    s.anchor.set(0.5);
    const lado = kind === 'wasabi' ? TILE * 0.95 : TILE * 1.05;
    s.scale.set(lado / CELDA_NOMINAL);
    s.position.set(Maze.centerX(tile.x), Maze.centerY(tile.y));
    this.capaObjetos.addChild(s);
    this.objetos.set(this.indice(tile), { sprite: s, kind });

    // late suave: los objetos tienen que pedir que los cojan
    gsap.to(s.scale, {
      x: s.scale.x * 1.12,
      y: s.scale.y * 1.12,
      duration: 0.7,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  private indice(t: Tile): number {
    return t.y * COLS + t.x;
  }

  // ------------------------------------------------------------------ tick

  private tick = (ticker: Ticker) => {
    const app = this.app;
    if (!app) return;

    // deltaMS puede dispararse al volver de otra pestaña; se acota
    const ms = Math.min(ticker.deltaMS, 50);
    const dt = ms / 1000;

    const status = useSuguMakiStore.getState().status;
    const corriendo = status === 'playing';
    /*
     * El cartel de NIVEL COMPLETADO cambia el status a 'level-complete', así
     * que la cuenta atrás de esa pausa NO puede depender de 'playing': si no,
     * el juego se quedaría clavado en el cartel para siempre.
     */
    const avanzaFase = corriendo || status === 'level-complete';

    if (corriendo && this.fase === 'jugando') {
      this.actualizarJuego(dt, ms);
    } else if (avanzaFase && (this.fase === 'muriendo' || this.fase === 'nivel-completado')) {
      this.faseMs -= ms;
      if (this.faseMs <= 0) this.terminarPausaDeFase();
    }

    this.pintar(corriendo);
    if (this.debug) this.pintarDebug();

    this.msDesdeSync += ms;
    if (this.msDesdeSync >= 250) {
      this.msDesdeSync = 0;
      /*
       * En el menú no se vuelca nada: todavía no hay nivel cargado, así que
       * los relojes del motor valen cero y machacarían los valores de partida
       * del store — el HUD del menú acababa marcando 00:00, como si acabaras
       * de perder.
       */
      if (status !== 'menu') this.volcarEstado();
    }
  };

  private actualizarJuego(dt: number, ms: number) {
    // --- reloj del nivel
    const antes = this.tiempoMs;
    this.tiempoMs = Math.max(0, this.tiempoMs - ms);
    const segundos = Math.ceil(this.tiempoMs / 1000);
    if (segundos <= TIME_WARNING_S && Math.ceil(antes / 1000) > segundos) {
      // la música se acelera un poco por cada segundo del tramo final
      audio.setMusicRate(1 + (TIME_WARNING_S - segundos) * 0.012);
    }
    if (this.tiempoMs <= 0) {
      this.perderVida(true);
      return;
    }

    // --- combo
    if (this.racha > 0) {
      this.rachaMs -= ms;
      if (this.rachaMs <= 0) {
        this.racha = 0;
        this.rachaMs = 0;
      }
    }

    // --- SUGU POWER
    if (this.powerMs > 0) {
      this.powerMs = Math.max(0, this.powerMs - ms);
      if (this.powerMs === 0) {
        this.cadena = 0;
        for (const e of this.enemigos) if (e.asustado) e.setMode(this.modoDelCiclo());
      }
    } else {
      // el relevo scatter/chase solo corre cuando nadie está asustado
      this.cicloMs -= ms;
      if (this.cicloMs <= 0) {
        this.cicloIndice = Math.min(this.cicloIndice + 1, this.nivel.modeCycle.length - 1);
        this.cicloMs = this.nivel.modeCycle[this.cicloIndice];
        const modo = this.modoDelCiclo();
        for (const e of this.enemigos) if (!e.comido) e.setMode(modo);
      }
    }

    // --- maki dorado
    this.actualizarGolden(ms);

    // --- movimiento
    this.player.update(dt);
    const infoJugador = { tile: this.player.tile(), dir: this.player.facing };
    for (const e of this.enemigos) e.avanzar(dt, infoJugador);

    // --- recogidas y choques
    this.recoger();
    this.comprobarChoques();
  }

  private modoDelCiclo(): 'scatter' | 'chase' {
    return this.cicloIndice % 2 === 0 ? 'scatter' : 'chase';
  }

  private actualizarGolden(ms: number) {
    if (this.golden) {
      this.goldenMs -= ms;
      if (this.goldenMs <= 0) this.quitarGolden();
      return;
    }
    if (this.goldenUsado) return;

    const avance = this.recogidos / this.totalRecogibles;
    if (avance < 1 - GOLDEN_TRIGGER_RATIO) return;

    this.goldenUsado = true;
    this.goldenMs = GOLDEN_MS;

    const s = new Sprite(frame('item.golden'));
    s.anchor.set(0.5);
    s.scale.set((TILE * 1.3) / CELDA_NOMINAL);
    s.position.set(Maze.centerX(this.maze.bonusTile.x), Maze.centerY(this.maze.bonusTile.y));
    this.capaObjetos.addChild(s);
    this.golden = s;

    gsap.fromTo(s, { alpha: 0 }, { alpha: 1, duration: 0.3 });
    gsap.to(s, { angle: 8, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  private quitarGolden() {
    if (!this.golden) return;
    gsap.killTweensOf(this.golden);
    this.golden.destroy();
    this.golden = null;
    this.goldenMs = 0;
  }

  private recoger() {
    const t = this.player.tile();
    const i = this.indice(t);

    // arroz
    const punto = this.puntos.get(i);
    if (punto) {
      this.puntos.delete(i);
      punto.destroy();
      this.recogidos++;
      this.recuento.rice++;
      this.sumar(PTS.rice, null);
      audio.play('collect', this.recuento.rice);
    }

    // objeto especial
    const obj = this.objetos.get(i);
    if (obj) {
      this.objetos.delete(i);
      gsap.killTweensOf(obj.sprite.scale);
      obj.sprite.destroy();
      this.recogidos++;
      this.recogerObjeto(obj.kind, t);
    }

    // maki dorado
    if (this.golden) {
      const g = this.maze.bonusTile;
      if (t.x === g.x && t.y === g.y) {
        this.quitarGolden();
        this.recuento.golden++;
        this.player.celebrar(900);
        this.sumar(PTS.golden, t, '+1000');
        this.efecto('fx.sparkle', t, 1.9);
        audio.play('golden');
        useSuguMakiStore.getState().mostrarAviso('¡SUGU BONUS!', 'oro');
      }
    }

    if (this.puntos.size === 0 && this.fase === 'jugando') this.completarNivel();
  }

  private recogerObjeto(kind: ItemKind, t: Tile) {
    this.recuento[kind]++;
    this.player.celebrar();

    if (kind === 'nigiri') {
      this.sumar(PTS.nigiri, t, `+${PTS.nigiri}`);
      this.efecto('fx.sparkle', t, 1.2);
      audio.play('item');
      return;
    }

    if (kind === 'gari') {
      this.player.acelerar();
      this.sumar(PTS.gari, t, `+${PTS.gari}`);
      this.efecto('fx.dash', t, 1.3);
      audio.play('item');
      return;
    }

    // wasabi: SUGU POWER
    this.powerMs = POWER_MS;
    this.cadena = 0;
    for (const e of this.enemigos) if (!e.comido) e.setMode('frightened');
    this.efecto('fx.orb', t, 1.8);
    audio.play('power');
    useSuguMakiStore.getState().mostrarAviso('¡SUGU POWER!', 'verde');
  }

  /**
   * Suma puntos aplicando el combo y, si se le pasa una casilla, deja el número
   * flotando encima.
   */
  private sumar(base: number, t: Tile | null, texto?: string) {
    this.racha++;
    this.rachaMs = COMBO_MS;

    const combo = this.comboActual();
    const total = base * combo;
    this.puntuacion += total;

    if (t && texto) this.textoFlotante(texto, t);
    this.comprobarLogros();
  }

  /**
   * El combo sube de escalón cada `COMBO_STEP` recogidas seguidas, no en cada
   * arroz: si multiplicara desde el primer punto, un pasillo largo dispararía
   * el marcador y el combo dejaría de significar nada.
   */
  private comboActual(): number {
    return Math.min(COMBO_MAX, 1 + Math.floor(this.racha / COMBO_STEP));
  }

  private comprobarLogros() {
    const store = useSuguMakiStore.getState();
    if (!this.coronaMostrada && this.puntuacion >= CROWN_SCORE) {
      this.coronaMostrada = true;
      this.ponerCorona();
    }
    if (!this.maestroMostrado && this.puntuacion >= MASTER_SCORE) {
      this.maestroMostrado = true;
      store.mostrarAviso('MAESTRO MAKI', 'oro');
    }
  }

  /** Corona sobre el maki al pasar de 10.000 puntos. */
  private ponerCorona() {
    if (this.corona) return;
    const c = new Sprite(frame('ui.crown'));
    c.anchor.set(0.5, 1);
    c.scale.set((TILE * 0.9) / CELDA_NOMINAL);
    c.alpha = 0;
    this.capaActores.addChild(c);
    this.corona = c;

    gsap.to(c, { alpha: 1, duration: 0.35 });
    gsap.to(c, {
      alpha: 0,
      delay: 5,
      duration: 0.5,
      onComplete: () => {
        c.destroy();
        if (this.corona === c) this.corona = null;
      },
    });
  }

  private comprobarChoques() {
    if (this.player.muerto) return;

    for (const e of this.enemigos) {
      if (e.comido) continue;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy > HIT_RADIUS * HIT_RADIUS) continue;

      if (e.asustado) {
        this.comerEnemigo(e);
      } else {
        this.perderVida(false);
        return;
      }
    }
  }

  private comerEnemigo(e: Enemy) {
    const puntos = PTS.enemyChain[Math.min(this.cadena, PTS.enemyChain.length - 1)];
    this.cadena++;
    this.enemigosComidos++;
    this.puntuacion += puntos;
    e.serComido();

    const t = { x: Maze.tileX(e.x), y: Maze.tileY(e.y) };
    this.textoFlotante(`+${puntos}`, t);
    this.efecto('fx.explosion', t, 1.5);
    this.player.celebrar(600);
    audio.play('eatEnemy', this.cadena - 1);
    this.comprobarLogros();
  }

  private perderVida(porTiempo: boolean) {
    if (this.fase !== 'jugando') return;

    this.vidas = Math.max(0, this.vidas - 1);
    this.player.morir();
    this.powerMs = 0;
    this.racha = 0;
    audio.play('death');
    audio.setMusicRate(1);

    const t = this.player.tile();
    this.efecto('fx.smoke', t, 1.6);
    if (porTiempo) useSuguMakiStore.getState().mostrarAviso('¡TIEMPO AGOTADO!', 'rojo');

    this.fase = 'muriendo';
    this.faseMs = DEATH_PAUSE_MS;
    this.volcarEstado();
  }

  private completarNivel() {
    this.fase = 'nivel-completado';
    this.faseMs = LEVEL_COMPLETE_MS;

    const bonusTiempo = Math.floor(this.tiempoMs / 1000) * PTS.perSecondLeft;
    this.puntuacion += PTS.levelComplete + bonusTiempo;

    audio.play('levelComplete');
    audio.setMusicRate(1);
    useSuguMakiStore.getState().setStatus('level-complete');
    this.volcarEstado();
  }

  /** Cierra la pausa de "muriendo" o de "nivel completado". */
  private terminarPausaDeFase() {
    if (this.fase === 'muriendo') {
      if (this.vidas <= 0) {
        this.terminarPartida();
        return;
      }
      this.recolocar();
      this.fase = 'espera';
      useSuguMakiStore.getState().setStatus('countdown');
      return;
    }

    if (this.fase === 'nivel-completado') {
      this.duracionAcumulada += this.tiempoTotalMs - this.tiempoMs;
      this.cargarNivel(this.nivelNumero + 1);
      this.pedirCuentaAtras();
    }
  }

  /** Tras perder una vida: todos a su sitio, el arroz recogido se queda. */
  private recolocar() {
    this.player.revivir();
    this.player.colocar(this.maze.playerSpawn, 'none');
    this.player.facing = 'left';
    this.enemigos.forEach((e, i) => e.reiniciar(SALIDA_MS[i] ?? 0));
    this.cicloIndice = 0;
    this.cicloMs = this.nivel.modeCycle[0];
    this.powerMs = 0;
    this.cadena = 0;
    this.quitarGolden();
  }

  private terminarPartida() {
    this.fase = 'fin';
    audio.play('gameOver');
    audio.stopMusic();

    const duracion = this.duracionAcumulada + (this.tiempoTotalMs - this.tiempoMs);
    const resultado: GameResult = {
      score: this.puntuacion,
      level: this.nivelNumero,
      duration: duracion,
      collectedItems: { ...this.recuento },
      enemiesEaten: this.enemigosComidos,
    };

    const store = useSuguMakiStore.getState();
    store.guardarBest(this.puntuacion);
    store.setResult(resultado);
    store.setStatus('game-over');
    this.volcarEstado();

    void guardarResultado(resultado);
  }

  // ---------------------------------------------------------------- pintado

  private pintar(corriendo: boolean) {
    if (!this.player) return;

    // --- jugador
    const anim = ANIMS[this.player.anim];
    const idx = this.player.dir === 'none' ? Math.floor(performance.now() / 260) : this.player.frameIndex;
    this.playerSprite.texture = frame(anim[idx % anim.length]);
    this.playerSprite.position.set(this.player.x, this.player.y);

    if (this.player.muerto) {
      // se desinfla al morir
      const k = Math.max(0.35, this.faseMs / DEATH_PAUSE_MS);
      this.playerSprite.scale.set(((TILE * 1.45) / CELDA_NOMINAL) * k);
      this.playerSprite.angle = (1 - k) * 40;
    } else {
      this.playerSprite.scale.set((TILE * 1.45) / CELDA_NOMINAL);
      this.playerSprite.angle = 0;
    }

    if (this.corona) {
      this.corona.position.set(this.player.x, this.player.y - TILE * 0.72);
    }

    // --- enemigos
    const avisando = this.powerMs > 0 && this.powerMs < POWER_WARN_MS;
    const parpadeo = avisando && Math.floor(performance.now() / 160) % 2 === 0;

    for (const e of this.enemigos) {
      const par = this.enemigoSprites.get(e);
      if (!par) continue;
      const { cuerpo, halo } = par;

      const anims = ANIMS[e.kind];
      cuerpo.texture = frame(anims[e.frameIndex % anims.length]);
      cuerpo.position.set(e.x, e.y);
      halo.position.set(e.x, e.y);

      if (e.comido) {
        cuerpo.alpha = 0.32;
        cuerpo.tint = 0xbfe4ff;
        halo.alpha = 0.25;
        halo.tint = PALETA.asustado;
      } else if (e.asustado) {
        cuerpo.alpha = 1;
        cuerpo.tint = parpadeo ? PALETA.asustadoAviso : PALETA.asustado;
        halo.alpha = 0.55;
        halo.tint = parpadeo ? PALETA.asustadoAviso : PALETA.asustado;
      } else {
        cuerpo.alpha = 1;
        cuerpo.tint = 0xffffff;
        halo.alpha = 0;
      }

      // el enemigo se inclina hacia donde va; da sensación de carrera
      cuerpo.scale.x = Math.abs(cuerpo.scale.x) * (e.facing === 'left' ? -1 : 1);
    }

    // el arroz respira muy despacio: da vida al tablero sin distraer
    this.capaPuntos.alpha = corriendo ? 0.94 + Math.sin(performance.now() / 340) * 0.06 : 0.9;
  }

  private textoFlotante(texto: string, t: Tile) {
    const label = new Text({ text: texto, style: ESTILO_FLOTANTE });
    label.anchor.set(0.5);
    label.scale.set(0.5);
    label.position.set(Maze.centerX(t.x), Maze.centerY(t.y));
    this.capaFx.addChild(label);

    gsap.to(label, {
      y: label.y - TILE * 1.6,
      alpha: 0,
      duration: 0.9,
      ease: 'power1.out',
      onComplete: () => label.destroy(),
    });
  }

  private efecto(id: FrameId, t: Tile, escala = 1) {
    const s = new Sprite(frame(id));
    s.anchor.set(0.5);
    s.scale.set(((TILE * escala) / CELDA_NOMINAL) * 0.6);
    s.position.set(Maze.centerX(t.x), Maze.centerY(t.y));
    s.blendMode = 'add';
    this.capaFx.addChild(s);

    gsap.to(s.scale, {
      x: (TILE * escala) / CELDA_NOMINAL,
      y: (TILE * escala) / CELDA_NOMINAL,
      duration: 0.35,
      ease: 'back.out(2)',
    });
    gsap.to(s, {
      alpha: 0,
      duration: 0.45,
      delay: 0.12,
      onComplete: () => s.destroy(),
    });
  }

  private pintarDebug() {
    const g = this.capaDebug;
    g.clear();

    for (let x = 0; x <= COLS; x++) g.moveTo(x * TILE, 0).lineTo(x * TILE, BOARD_H);
    for (let y = 0; y <= ROWS; y++) g.moveTo(0, y * TILE).lineTo(BOARD_W, y * TILE);
    g.stroke({ width: 0.5, color: 0x24406a, alpha: 0.6 });

    if (this.player) {
      g.circle(this.player.x, this.player.y, HIT_RADIUS).stroke({ width: 1, color: 0x39ff88 });
      g.rect(
        Maze.centerX(this.maze.playerSpawn.x) - TILE / 2,
        Maze.centerY(this.maze.playerSpawn.y) - TILE / 2,
        TILE,
        TILE
      ).stroke({ width: 1, color: 0x39ff88, alpha: 0.7 });
    }

    for (const e of this.enemigos) {
      g.circle(e.x, e.y, HIT_RADIUS).stroke({ width: 1, color: 0xff5566 });
      g.moveTo(e.x, e.y)
        .lineTo(Maze.centerX(e.objetivo.x), Maze.centerY(e.objetivo.y))
        .stroke({ width: 1, color: 0xffcc44, alpha: 0.55 });
      g.rect(
        Maze.centerX(e.objetivo.x) - 3,
        Maze.centerY(e.objetivo.y) - 3,
        6,
        6
      ).fill({ color: 0xffcc44, alpha: 0.8 });
    }
  }

  // ------------------------------------------------------------- store sync

  private volcarEstado() {
    useSuguMakiStore.getState().sync({
      score: this.puntuacion,
      lives: this.vidas,
      level: this.nivelNumero,
      timeMs: Math.round(this.tiempoMs / 250) * 250,
      timeTotalMs: this.tiempoTotalMs,
      combo: this.racha > 0 ? this.comboActual() : 0,
      progress: this.totalRecogibles ? this.recogidos / this.totalRecogibles : 0,
      powerMs: Math.round(this.powerMs / 250) * 250,
    });
  }
}
