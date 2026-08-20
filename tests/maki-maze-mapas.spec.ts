import { test, expect } from '@playwright/test';
import { MAPS } from '../src/app/juegos/sugu-maki-maze/game/levels';
import { COLS, ROWS } from '../src/app/juegos/sugu-maki-maze/game/config';

/**
 * Reglas de los laberintos de Sugu Maki Maze.
 *
 * Este archivo existe porque un mapa roto no se ve al mirarlo. En el mapa 3 la
 * casilla de encima de la puerta de la cocina era pared: los enemigos comidos
 * no tenían por dónde volver a casa y se quedaban dando vueltas para siempre.
 * El juego arrancaba, no petaba nada, y solo se notaba jugando el nivel 3 y
 * fijándose mucho.
 *
 * No es un test de navegador: los mapas son texto y se comprueban leyéndolos.
 */

const PARED = '#';
const PUERTA = '-';
/** Todo lo que no es pared: por aquí anda alguien. */
const abierto = (ch: string) => ch !== PARED;
/** Casillas de dentro de la cocina. */
const esCocina = (ch: string) => ' 1234'.includes(ch);

type Celda = { x: number; y: number };

function leer(mapa: readonly string[]) {
  const en = (x: number, y: number) => mapa[y]?.[x] ?? PARED;
  const buscar = (prueba: (ch: string) => boolean): Celda[] => {
    const out: Celda[] = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) if (prueba(en(x, y))) out.push({ x, y });
    return out;
  };
  return { en, buscar, texto: mapa.join('') };
}

const VECINOS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

MAPS.forEach((mapa, i) => {
  const nivel = `mapa ${i + 1}`;

  test(`${nivel}: mide 21x25`, () => {
    expect(mapa).toHaveLength(ROWS);
    for (const [y, fila] of mapa.entries()) expect(fila, `fila ${y}`).toHaveLength(COLS);
  });

  test(`${nivel}: es simétrico`, () => {
    const { en } = leer(mapa);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS / 2; x++)
        expect(
          en(x, y) === PARED,
          `(${x},${y}) y su espejo (${COLS - 1 - x},${y}) no coinciden`
        ).toBe(en(COLS - 1 - x, y) === PARED);
  });

  test(`${nivel}: los enemigos pueden salir de la cocina y volver`, () => {
    const { en, buscar } = leer(mapa);

    const puertas = buscar((ch) => ch === PUERTA);
    expect(puertas, 'tiene que haber exactamente una puerta').toHaveLength(1);
    const p = puertas[0];

    // el motor manda a los comidos a la casilla de ENCIMA de la puerta
    expect(
      abierto(en(p.x, p.y - 1)),
      `la salida de la cocina (${p.x},${p.y - 1}) es '${en(p.x, p.y - 1)}': los comidos no pueden volver`
    ).toBe(true);
    expect(esCocina(en(p.x, p.y + 1)), 'debajo de la puerta tiene que haber cocina').toBe(true);
  });

  test(`${nivel}: todo el laberinto es una sola pieza`, () => {
    const { en, buscar } = leer(mapa);
    const inicio = buscar(esCocina)[0];
    expect(inicio, 'no hay cocina').toBeDefined();

    const vistos = new Set([`${inicio.x},${inicio.y}`]);
    const cola: Celda[] = [inicio];
    while (cola.length) {
      const a = cola.pop()!;
      for (const [dx, dy] of VECINOS) {
        const n = { x: a.x + dx, y: a.y + dy };
        if (n.y < 0 || n.y >= ROWS) continue;
        if (!abierto(en(n.x, n.y))) continue;
        const k = `${n.x},${n.y}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        cola.push(n);
      }
    }

    const sueltas = buscar(abierto).filter((c) => !vistos.has(`${c.x},${c.y}`));
    expect(
      sueltas.map((c) => `(${c.x},${c.y})`),
      'hay casillas a las que no se llega desde la cocina'
    ).toEqual([]);
  });

  test(`${nivel}: no hay callejones sin salida`, () => {
    const { en, buscar } = leer(mapa);
    const callejones = buscar(abierto)
      // el túnel sale por el otro lado del tablero, no es un callejón
      .filter((c) => en(c.x, c.y) !== 'T' && !esCocina(en(c.x, c.y)) && en(c.x, c.y) !== PUERTA)
      .filter((c) => VECINOS.filter(([dx, dy]) => abierto(en(c.x + dx, c.y + dy))).length <= 1);

    expect(
      callejones.map((c) => `(${c.x},${c.y})`),
      'un comecocos no tiene callejones: son los que dejan un arroz suelto al fondo'
    ).toEqual([]);
  });

  test(`${nivel}: no hay salas de 2x2`, () => {
    const { en } = leer(mapa);
    const salas: string[] = [];
    for (let y = 0; y < ROWS - 1; y++)
      for (let x = 0; x < COLS - 1; x++) {
        const esquinas = [
          en(x, y),
          en(x + 1, y),
          en(x, y + 1),
          en(x + 1, y + 1),
        ];
        if (esquinas.some(esCocina)) continue;
        if (esquinas.every(abierto)) salas.push(`(${x},${y})`);
      }
    expect(salas, 'los pasillos son de una casilla de ancho').toEqual([]);
  });

  test(`${nivel}: los túneles van en pareja`, () => {
    const { en } = leer(mapa);
    for (let y = 0; y < ROWS; y++)
      expect(en(0, y) === 'T', `túnel a medias en la fila ${y}`).toBe(en(COLS - 1, y) === 'T');
  });

  test(`${nivel}: tiene las piezas que espera el motor`, () => {
    const { texto } = leer(mapa);
    const cuantos = (ch: string) => texto.split('').filter((c) => c === ch).length;

    expect(cuantos('P'), 'una salida del jugador').toBe(1);
    expect(cuantos('B'), 'una casilla donde asoma el maki dorado').toBe(1);
    expect(cuantos('W'), 'cuatro wasabis, uno por esquina').toBe(4);
    for (const n of ['1', '2', '3', '4']) expect(cuantos(n), `el enemigo ${n}`).toBe(1);

    // de estos hay uno solo: si el generador los espeja salen duplicados
    for (const ch of ['S', 'O']) expect(cuantos(ch), `un solo '${ch}'`).toBe(1);
    expect(cuantos('H'), 'el corazón es raro: cero o uno').toBeLessThanOrEqual(1);

    // pares simétricos
    for (const ch of ['N', 'R']) expect(cuantos(ch), `'${ch}' va en pareja`).toBe(2);
  });

  test(`${nivel}: ningún grano de arroz queda aislado`, () => {
    const { en, buscar } = leer(mapa);
    const recogible = (ch: string) => '.WNRSOHB'.includes(ch);
    const sueltos = buscar((ch) => ch === '.').filter(
      (c) => !VECINOS.some(([dx, dy]) => recogible(en(c.x + dx, c.y + dy)))
    );
    expect(sueltos.map((c) => `(${c.x},${c.y})`), 'un arroz solo en un rincón no aporta nada').toEqual([]);
  });
});
