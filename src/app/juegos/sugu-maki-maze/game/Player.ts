import { Actor } from './Actor';
import { GARI_MS, GARI_SPEED_MULT } from './config';
import type { AnimId } from './sprites';
import { opuesta, type Dir } from './types';

/** Animaciones que puede pedir el maki. */
type AnimJugador = Extract<
  AnimId,
  'walkRight' | 'walkLeft' | 'walkUp' | 'walkDown' | 'idle' | 'happy' | 'dead'
>;

/**
 * El maki. Solo sabe moverse y en qué estado de ánimo está: quién le quita una
 * vida o cuántos puntos vale lo que se come es cosa del motor.
 */
export class Player extends Actor {
  /** Velocidad base del nivel, antes del gari. */
  baseSpeed = 125;

  /** Milisegundos que queda de subidón de gari. */
  private gariMs = 0;
  /** Milisegundos que queda de cara de felicidad tras pillar algo bueno. */
  private felizMs = 0;

  muerto = false;

  /**
   * Pide una dirección. Darse la vuelta es inmediato —el jugador espera que
   * responda al momento—; girar en perpendicular espera al centro de la
   * casilla, que es donde el laberinto lo permite.
   */
  pedir(dir: Dir) {
    if (dir === 'none' || this.muerto) return;
    this.want = dir;
    if (this.dir !== 'none' && dir === opuesta(this.dir)) {
      this.dir = dir;
      this.facing = dir;
    }
  }

  protected decidir() {
    if (this.muerto) {
      this.dir = 'none';
      return;
    }
    if (this.want !== 'none' && this.puedeIr(this.want)) {
      this.dir = this.want;
      return;
    }
    if (this.dir === 'none' || !this.puedeIr(this.dir)) this.dir = 'none';
  }

  /** Gari: unos segundos de velocidad extra. */
  acelerar() {
    this.gariMs = GARI_MS;
  }

  celebrar(ms = 700) {
    this.felizMs = ms;
  }

  get acelerado(): boolean {
    return this.gariMs > 0;
  }

  morir() {
    this.muerto = true;
    this.dir = 'none';
    this.want = 'none';
  }

  revivir() {
    this.muerto = false;
    this.gariMs = 0;
    this.felizMs = 0;
  }

  update(dt: number) {
    const ms = dt * 1000;
    if (this.gariMs > 0) this.gariMs = Math.max(0, this.gariMs - ms);
    if (this.felizMs > 0) this.felizMs = Math.max(0, this.felizMs - ms);

    this.speed = this.baseSpeed * (this.gariMs > 0 ? GARI_SPEED_MULT : 1);
    if (this.muerto) return;
    super.update(dt);
  }

  /** Qué animación toca pintar. La resuelve el renderer. */
  get anim(): AnimJugador {
    if (this.muerto) return 'dead';
    if (this.felizMs > 0) return 'happy';
    if (this.dir === 'none') return 'idle';
    if (this.facing === 'up') return 'walkUp';
    if (this.facing === 'down') return 'walkDown';
    return this.facing === 'left' ? 'walkLeft' : 'walkRight';
  }
}
