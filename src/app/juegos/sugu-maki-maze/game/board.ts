import { Container, Graphics } from 'pixi.js';
import type { Maze } from './collision';
import { BOARD_H, BOARD_W, COLS, ROWS, TILE } from './config';
import { PALETA } from './textures';

/**
 * Dibujo del laberinto.
 *
 * Cada casilla de pared se dibuja como un rectángulo redondeado que se ESTIRA
 * hasta el borde por los lados donde tiene otra pared pegada, y se queda a
 * `MARGEN` por los lados abiertos. Así dos paredes contiguas se funden en un
 * solo bloque sin costura y las esquinas expuestas salen redondeadas, que es lo
 * que hace que un tablero de comecocos parezca moldeado y no una cuadrícula.
 *
 * El contorno encendido NO se hace con `stroke`: se pintan tres capas del
 * mismo bloque, cada una un poco más grande que la siguiente (halo, borde,
 * relleno). Con `stroke` habría que confiar en la alineación de la línea, que
 * en las esquinas redondeadas deja huecos; apilando rellenos el borde tiene
 * siempre el mismo grosor y las esquinas cierran perfectas.
 */

/** Separación de la pared respecto del borde de su casilla, por los lados abiertos. */
const MARGEN = 2.2;
/** Grosor del filo encendido. */
const BORDE = 1.8;
/** Cuánto se derrama el halo más allá del filo. */
const HALO = 2.6;
const RADIO = 6;

export interface Tablero {
  view: Container;
  destroy(): void;
}

/**
 * Patrón seigaiha (las olas japonesas), dibujado directamente sobre el área
 * pedida.
 *
 * Se descartó el `TilingSprite`: la textura generada al vuelo es un recorte de
 * un lienzo mayor, y una textura recortada no se puede repetir — el resultado
 * era la primera ola estirada por todo el tablero en vez del patrón. Dibujar
 * los arcos una vez al cargar el nivel sale más barato que pelearse con eso.
 */
function patronSeigaiha(ancho: number, alto: number, color: number, grosor: number): Graphics {
  const g = new Graphics();
  const paso = TILE;
  const alturaFila = paso * 0.5;

  for (let fila = 0; fila * alturaFila < alto + paso; fila++) {
    const cy = fila * alturaFila;
    const desplazado = fila % 2 === 1 ? paso / 2 : 0;
    for (let col = -1; col * paso + desplazado < ancho + paso; col++) {
      const cx = col * paso + desplazado;
      g.circle(cx, cy, paso * 0.5);
      g.circle(cx, cy, paso * 0.28);
    }
  }

  g.stroke({ width: grosor, color });
  return g;
}

export function dibujarTablero(maze: Maze): Tablero {
  const view = new Container();

  // --- fondo: negro con un seigaiha muy tenue --------------------------
  const fondo = new Graphics().rect(0, 0, BOARD_W, BOARD_H).fill(PALETA.fondo);
  view.addChild(fondo);

  const olasFondo = patronSeigaiha(BOARD_W, BOARD_H, PALETA.seigaiha, 1);
  // muy por debajo del arroz: es textura de fondo, no debe competir con nada
  olasFondo.alpha = 0.3;
  view.addChild(olasFondo);

  // --- paredes: halo, filo y relleno, cada uno más pequeño que el anterior
  const halo = new Graphics();
  const borde = new Graphics();
  const relleno = new Graphics();
  const mascara = new Graphics();

  /** Añade el bloque de una casilla a una capa, con el margen que le toque. */
  const bloque = (g: Graphics, x: number, y: number, margen: number) => {
    const izq = maze.isWall(x - 1, y) ? 0 : margen;
    const der = maze.isWall(x + 1, y) ? 0 : margen;
    const arr = maze.isWall(x, y - 1) ? 0 : margen;
    const aba = maze.isWall(x, y + 1) ? 0 : margen;
    const abierto = izq || der || arr || aba;
    g.roundRect(
      x * TILE + izq,
      y * TILE + arr,
      TILE - izq - der,
      TILE - arr - aba,
      abierto ? Math.max(0, RADIO - margen) : 0
    );
  };

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!maze.isWall(x, y)) continue;
      bloque(halo, x, y, MARGEN - BORDE - HALO);
      bloque(borde, x, y, MARGEN - BORDE);
      bloque(relleno, x, y, MARGEN);
      bloque(mascara, x, y, MARGEN);
    }
  }

  halo.fill({ color: PALETA.paredBrillo, alpha: 0.22 });
  borde.fill(PALETA.paredBorde);
  relleno.fill(PALETA.paredRelleno);
  mascara.fill(0xffffff);

  view.addChild(halo, borde, relleno);

  // olas dentro de la pared: el detalle japonés discreto de la referencia
  const olasPared = patronSeigaiha(BOARD_W, BOARD_H, PALETA.paredRellenoAlto, 1.3);
  /*
   * Flojito: el patrón se acumula y aclara las paredes gruesas (el marco
   * exterior) mucho más que las barras finas del interior. Por encima de 0.4
   * el borde del tablero se ve de otro verde que el resto.
   */
  olasPared.alpha = 0.38;
  view.addChild(mascara, olasPared);
  olasPared.mask = mascara;

  // --- puerta de la cocina --------------------------------------------
  const puerta = new Graphics();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!maze.isDoor(x, y)) continue;
      puerta
        .roundRect(x * TILE + 2, y * TILE + TILE / 2 - 2.5, TILE - 4, 5, 2.5)
        .fill({ color: PALETA.puerta, alpha: 0.9 });
    }
  }
  view.addChild(puerta);

  return {
    view,
    destroy() {
      olasPared.mask = null;
      view.destroy({ children: true });
    },
  };
}
