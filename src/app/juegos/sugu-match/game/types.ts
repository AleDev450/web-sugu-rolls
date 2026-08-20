/**
 * Tipos compartidos por el motor, la vista, el store y la interfaz de
 * Sugu Match.
 *
 * Regla del módulo: aquí no hay lógica ni constantes de equilibrio, solo la
 * forma de los datos. Los números viven en `game/config/`.
 */

// --- piezas ---------------------------------------------------------------

/** Piezas que puntúan y se emparejan. Son las que salen del generador. */
export type MatchType = 'poke' | 'ikura' | 'onigiri' | 'temaki' | 'gyoza' | 'maki';

/**
 * Piezas que ocupan casilla pero nunca se emparejan ni se mueven. Se listan
 * aparte para que el compilador avise si alguna función las trata como
 * emparejables.
 */
export type SolidType = 'stone';

export type TileType = MatchType | SolidType;

export const MATCH_TYPES: readonly MatchType[] = [
  'poke',
  'ikura',
  'onigiri',
  'temaki',
  'gyoza',
  'maki',
];

export function esEmparejable(t: TileType): t is MatchType {
  return t !== 'stone';
}

/** Pieza especial que lleva una pieza normal encima. */
export type SpecialKind = 'none' | 'stripedH' | 'stripedV' | 'bomb' | 'rainbow';

/**
 * Cubierta que hay que romper antes de poder usar la pieza. La pieza sigue
 * ahí debajo: el hielo y la cuerda gastan Matches, no destruyen.
 */
export type LayerKind = 'none' | 'ice' | 'rope';

export interface Tile {
  /** Identidad estable: la vista sigue al sprite por este número. */
  readonly id: number;
  type: TileType;
  special: SpecialKind;
  layer: LayerKind;
  /** Golpes que le quedan a la cubierta. 0 cuando `layer` es 'none'. */
  layerHp: number;
}

export interface Pos {
  row: number;
  col: number;
}

export function mismaPos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}

export function sonVecinas(a: Pos, b: Pos): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export type Eje = 'h' | 'v';

// --- niveles --------------------------------------------------------------

export type ObjectiveType = 'collect' | 'break' | 'score';

export interface ObjectiveConfig {
  type: ObjectiveType;
  /** Para 'collect': qué pieza hay que reunir. */
  tile?: MatchType;
  /** Para 'break': qué cubierta hay que romper. */
  layer?: LayerKind;
  amount: number;
}

export interface ObjectiveState extends ObjectiveConfig {
  remaining: number;
}

export interface StarThresholds {
  one: number;
  two: number;
  three: number;
}

export interface LevelConfig {
  id: number;
  nombre: string;
  rows: number;
  cols: number;
  moves: number;
  /** Piezas que salen en este nivel. Menos tipos = nivel más fácil. */
  tiles: readonly MatchType[];
  objectives: readonly ObjectiveConfig[];
  stars: StarThresholds;
  /**
   * Mapa opcional, una cadena por fila. Ver `config/levels.ts` para la
   * leyenda. Si falta, el tablero es rectangular y limpio.
   */
  layout?: readonly string[];
  /** Boosters con los que arranca el nivel. */
  boosters?: Partial<Record<BoosterId, number>>;
}

// --- boosters -------------------------------------------------------------

export type BoosterId = 'shoyu' | 'ohashi' | 'gari' | 'wasabi' | 'spicy' | 'shuffle' | 'clock';

/** Qué espera el booster después de pulsarlo. */
export type BoosterTarget = 'none' | 'tile' | 'swap';

// --- estado ---------------------------------------------------------------

export type GameStatus =
  | 'idle'
  | 'playing'
  | 'animating'
  | 'paused'
  | 'won'
  | 'lost';

/** Por qué se ha quitado una pieza. Decide sonido, partículas y puntos. */
export type ClearCause =
  | 'match'
  | 'stripedH'
  | 'stripedV'
  | 'bomb'
  | 'rainbow'
  | 'booster';

// --- pasos de una jugada --------------------------------------------------

export interface ClearedTile {
  id: number;
  row: number;
  col: number;
  type: TileType;
  special: SpecialKind;
  cause: ClearCause;
}

export interface CreatedTile {
  id: number;
  row: number;
  col: number;
  type: TileType;
  special: SpecialKind;
}

/** Cubierta que ha recibido un golpe (y puede haberse roto del todo). */
export interface LayerHit {
  id: number;
  row: number;
  col: number;
  layer: LayerKind;
  /** Golpes restantes tras este impacto. 0 = rota. */
  hp: number;
}

/** Efecto visual de una pieza especial al dispararse. */
export interface ActivationFx {
  kind: 'stripedH' | 'stripedV' | 'bomb' | 'rainbow';
  row: number;
  col: number;
  /** Solo para 'rainbow': el tipo al que apuntó. */
  target?: TileType;
}

/**
 * Una pieza que se desplaza al colapsar el tablero.
 *
 * Lleva columna de origen y de destino porque la caída no siempre es
 * vertical: cuando una piedra sella una columna, el hueco de debajo se
 * alimenta en diagonal desde las columnas vecinas. Sin eso quedarían agujeros
 * permanentes en los niveles con obstáculos.
 */
export interface FallMove {
  id: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface SpawnedTile {
  id: number;
  row: number;
  col: number;
  type: TileType;
  special: SpecialKind;
  layer: LayerKind;
  /** Fila virtual por encima del tablero desde la que entra cayendo. */
  fromRow: number;
}

/**
 * Una vuelta del bucle destruir → caer → rellenar.
 *
 * El motor devuelve la lista completa de pasos de la jugada y la vista los
 * reproduce en orden. Así la lógica no sabe nada de PixiJS ni de GSAP, y se
 * puede probar con un tablero de mentira.
 */
export interface TurnStep {
  /** 1 en la jugada del jugador, 2+ en cada cascada encadenada. */
  combo: number;
  cleared: ClearedTile[];
  created: CreatedTile[];
  layerHits: LayerHit[];
  fx: ActivationFx[];
  falls: FallMove[];
  spawns: SpawnedTile[];
  /** Puntos de este paso, con el multiplicador de cascada ya aplicado. */
  score: number;
  /** Piezas contadas para los objetivos, por tipo. */
  collected: Partial<Record<TileType, number>>;
  /** Cubiertas rotas del todo, por tipo. */
  broken: Partial<Record<LayerKind, number>>;
}

/** Resultado completo de una jugada. */
export interface TurnResult {
  steps: TurnStep[];
  /** Movimientos consumidos: 1 en una jugada normal, 0 en cascada o booster. */
  movesUsed: number;
  totalScore: number;
  /** Cascadas encadenadas más allá de la jugada inicial. */
  maxCombo: number;
}

/** Resumen que se guarda al terminar la partida. */
export interface GameResult {
  level: number;
  score: number;
  stars: number;
  movesUsed: number;
  movesLeft: number;
  /** Duración en milisegundos. */
  duration: number;
  won: boolean;
}
