# Sugu Match — esto falta

Documento de traspaso. Sirve para retomar el juego en otra sesión sin volver a
explicar nada. **Es temporal: bórralo cuando el juego esté terminado.**

Ruta del juego: `src/app/juegos/sugu-match/` → se ve en `/juegos/sugu-match`.

---

## 1. Qué hay hecho

Las fases 1 a 15 del plan original. El Match-3 es jugable de principio a fin:

- Tablero configurable (8x8, 9x9, con huecos), generado sin combinaciones
  servidas y garantizando que siempre haya jugada.
- Entrada con ratón, toque y swipe. Solo en cruz, nunca en diagonal.
- Match de 3, de 4, de 5, formas en L y en T.
- Especiales: **maki rayado** (H y V), **Bomb Maki** (3x3) y **Rainbow Maki**.
- Las seis combinaciones especial + especial (arcoíris x2, arcoíris + normal,
  arcoíris + especial, rayado + rayado, bomba + bomba, bomba + rayado).
- Cascadas con multiplicador de combo; las cascadas no gastan movimientos.
- Gravedad y relleno animados con GSAP, incluida la caída en diagonal cuando
  una piedra sella una columna.
- Puntuación, movimientos, objetivos, estrellas.
- 5 niveles definidos como datos en `game/config/levels.ts`.
- 7 boosters: shoyu, ohashi, gari, wasabi, ají, shuffle y reloj.
- Obstáculos: hielo, cuerda, piedra y huecos del tablero.
- Partículas con pool fijo, sonido con sintetizador de repuesto, mezcla
  automática al quedarse sin jugadas, pista a los 8 s, pausa, game over y
  nivel completado.

Verificado con `npm run build`, `npm run typecheck` y una partida completa en
navegador (Playwright) hasta el game over, sin errores de página.

---

## 2. Mapa de la carpeta

La regla que sostiene todo: **`game/core/` no importa PixiJS**. El motor
resuelve la jugada entera y devuelve una lista de `TurnStep`; la vista solo la
reproduce. Por eso se puede cambiar la animación sin tocar las reglas — y por
eso el mismo motor podrá correr en el servidor para validar puntuaciones
(ver fase 18).

```
game/config/     tiles · levels · scoring · boosters · medidas   ← datos, cero lógica
game/core/       Board · matching · specials · turn · objectives · boosters
game/render/     sprites · interfaz · textures · procedural · TileSprite · BoardView · Particles
game/            Game.ts (director) · SoundManager · scores · types
components/      SuguMatch · GameHUD · BoosterBar · Overlays · SpriteImg · GameLoader
store/           useSuguMatchStore
```

| Archivo | Responsabilidad |
|---|---|
| `core/Board.ts` | La matriz. Qué se mueve, cómo cae, cómo se rellena, cómo se mezcla |
| `core/matching.ts` | Detección de rachas y fusión en grupos (lo que convierte una L en un solo grupo) |
| `core/specials.ts` | Qué especial nace, qué barre cada uno, qué pasa al juntar dos |
| `core/turn.ts` | La jugada completa: destruir → crear → caer → rellenar → cascada |
| `render/sprites.ts` | Atlas del sheet: la caja real de cada dibujo |
| `render/interfaz.ts` | Atlas de las láminas del HUD: dónde cae cada slot y cada número |
| `render/BoardView.ts` | Reproduce un `TurnStep` con GSAP |
| `Game.ts` | Une motor, vista, store y sonido. Único sitio con el cerrojo de entrada |

---

## 3. Lo que falta

### A. Assets

1. **Sprite sheet: ya está** en `public/games/sugu-match/spritesheet.png`
   (1254x1254, 36 dibujos con alfa) y el juego lo usa.

   La hoja actual SÍ tiene una rejilla regular de 6x6 con bandas de alfa
   vacías entre dibujos, así que se puede recortar sola. Aun así, los
   rectángulos de `game/render/sprites.ts` no son la rejilla: son la caja real
   de cada dibujo, medida sobre el canal alfa con 2 px de aire. Se hace así
   porque los dibujos no están centrados en su celda ni ocupan lo mismo, y sin
   la caja real no se pueden escalar todos al mismo peso en pantalla.

   ⚠️ **Si vuelves a generar la hoja, hay que volver a medirla.** El
   procedimiento: recorre el alfa, busca las bandas vacías entre dibujos y saca
   el bounding box de cada celda. No hay ninguna constante ajustable a ojo.

   Como los recortes no son cuadrados, todo lo que los pinta los ENCAJA
   conservando la proporción (`TileSprite.encajar` en Pixi, `frameToCss` en el
   DOM). No los estires.

   `game/render/procedural.ts` sigue ahí como repuesto: si el PNG falta o falla
   la carga, el juego dibuja las piezas con Graphics y se puede jugar igual.

2. **Láminas de interfaz: ya están** y el juego las usa. Son dibujos sueltos en
   `public/games/sugu-match/`:

   | Archivo | Para qué |
   |---|---|
   | `background.png` | fondo de la pantalla (la terraza) |
   | `tablero.png` | la bandeja de 8x8 sobre la que caen las piezas |
   | `objetivos.png` | marco verde con tres slots y tres pastillas |
   | `movimientos.png` | marco rosa con la cifra y la barra de estrellas |
   | `puntuacion.png` | marco azul de la puntuación |
   | `estrellas.png` | las dos estrellas (oro y apagada) en una sola imagen |
   | `interface.png` | la barra inferior con siete huecos de habilidad |
   | `pausa.png` | el botón de pausa |
   | `sugu_match.png` | el logo |

   **Todas las medidas de estas láminas están en `game/render/interfaz.ts` y
   solo ahí.** Dónde cae cada slot, dónde va cada número y dónde empieza la
   rejilla del tablero son píxeles medidos sobre el PNG (canal alfa y color),
   no proporciones redondas. El CSS no repite ni una: pide los huecos a
   `dentro()` y recibe porcentajes.

   Consecuencia: **si un número sale descuadrado dentro de su marco, el arreglo
   NO está en `match.css`.** Está en la medida del atlas. Y si se regenera
   cualquiera de estas imágenes, hay que volver a medirla igual que la hoja.

   Dos detalles que ya costaron una vez:

   - `tablero.png` es de 8x8 y **solo** de 8x8. Los niveles 4 y 5 son de 9x9,
     así que `BoardView.usaLamina` los manda al dibujo de repuesto con
     Graphics. Lo mismo pasa con cualquier nivel que tenga huecos (`#`): la
     bandeja enseñaría casillas pintadas donde no se puede jugar.
   - Un `padding` en porcentaje sobre un elemento posicionado en absoluto se
     mide contra su BLOQUE CONTENEDOR, no contra sí mismo. Como los slots van
     en absoluto, `padding: 8%` se calculaba sobre el panel entero y dejaba los
     iconos en 0 px. El aire se da con el tamaño del hijo, nunca con padding.

3. **Sonidos**: faltan. mp3 en `public/sonidos/sugu-match/` con los nombres de
   `SOUND_FILES` en `game/SoundManager.ts`. Sin ellos suena el sintetizador de
   WebAudio, así que no es urgente.

### B. Fase 16 — Supabase

**Importante: esto no hay que diseñarlo desde cero.** El juego `/juego` ya
tiene resuelto exactamente el mismo problema, y bien. Hay que calcar ese
patrón, no inventar otro:

- `supabase/schema.sql` → tabla `game_sessions`, funciones `redeem_code`,
  `finish_session`, `get_ranking`, `admin_reset_ranking`.
- `supabase/migraciones/002-antitrampas-puntaje.sql` → el techo de puntaje
  según el tiempo jugado y el registro de intentos rechazados.
- `src/lib/scores.ts` → cómo lo llama el cliente.

Trabajo concreto:

1. Migración nueva en `supabase/migraciones/`. **La siguiente es la `029`**
   (la última existente es `028-temporizador-del-juego.sql`). Idempotente,
   como todas. Y márcala en la tabla de `supabase/migraciones/LEEME.md`.

2. Dos tablas:

   ```
   match_sessions   id, user_id, level, seed, started_at, finished_at,
                    score, stars, moves_used, status
   match_scores     session_id, user_id, level, score, stars, created_at
   ```

   `seed` es la clave del asunto: `new Board(level, seed)` ya es
   reproducible (`mulberry32` en `core/Board.ts`), así que si la semilla la
   pone el servidor, el servidor puede rehacer la misma partida.

3. Dos funciones `SECURITY DEFINER`:

   - `start_match_session(p_level)` → crea la fila y devuelve `session_id` y
     `seed`. El cliente arranca el tablero con esa semilla.
   - `finish_match_session(p_session_id, p_score, p_moves_used, ...)` →
     valida y cierra.

4. RLS: nadie escribe en `match_scores` directamente. Solo esas funciones.

5. En `game/scores.ts` está escrito este mismo plan con más detalle y el flag
   `GUARDAR_EN_SUPABASE = false`. Encenderlo es el último paso, no el primero.

6. En el cliente: pedir la sesión al entrar al nivel (`Game.cargarNivel`) y
   pasar la semilla a `new Board(level, seed)`, que ya acepta ese segundo
   parámetro.

### C. Fase 17 — Ranking

Función `get_match_ranking(p_limit)` al estilo de `get_ranking`, y una
pantalla de posiciones. Ojo con lo que ya resolvió el otro juego: el ranking
se expone por función y no por tabla, precisamente porque las filas llevan
datos personales.

Como habrá premios para los primeros puestos, hace falta decidir antes qué se
rankea: ¿la mejor puntuación de un nivel concreto? ¿la suma de todos los
niveles? ¿las estrellas totales? No es una decisión técnica, y cambia el
diseño de la consulta.

### D. Fase 18 — Anti-cheat

Mínimo, copiando `002-antitrampas-puntaje.sql`:

- Techo de puntaje razonable según el tiempo que la partida lleva abierta.
- Duración mínima: una partida de 25 movimientos no se resuelve en 4 segundos.
- `moves_used` nunca puede pasar de los movimientos del nivel (más lo que
  regale el reloj).
- Sesión inexistente, ya cerrada, o de otro usuario → rechazo.
- Un solo envío por sesión.
- Los rechazos, a `code_attempts` con su motivo, como ya se hace hoy.

El nivel siguiente, cuando compense: guardar la lista de movimientos y
**re-simular la partida en el servidor** con el mismo motor. Es la única
validación que no se puede falsificar. Para eso `core/` no depende de PixiJS.

### E. Extras, cuando toque

- Más niveles (solo son objetos en `config/levels.ts`, no tocan el motor).
- Obstáculo de **salsa** que se expande si no lo eliminas: la arquitectura de
  capas ya lo soporta, hay que añadir el tipo y su regla de propagación.
- Elementos del sheet aún sin uso: corazón (vidas), corona (campeón), caja
  (recompensa), candado, burbuja.
- Mapa de niveles con las estrellas conseguidas. Ya se guardan en
  `localStorage` (`leerProgreso()` en `game/scores.ts`).
- Inventario de boosters por usuario. La interfaz ya lee las cantidades del
  store; solo hay que rellenarlas desde Supabase al entrar.

---

## 4. Cosas que conviene saber antes de tocar el motor

Son decisiones tomadas a conciencia. Cambiarlas sin querer rompe cosas
sutiles:

- **Movible ≠ emparejable.** Una pieza con hielo NO se mueve ni se
  intercambia, pero SÍ cuenta para un match: así es como el jugador la libera.
  Una piedra no es ninguna de las dos cosas.
- **El arcoíris no hace match por color.** Está excluido de las rachas a
  propósito: es un comodín que se dispara al intercambiarlo.
- **`Board.rellenar()` garantiza que ninguna casilla jugable queda vacía.** Si
  un hueco está sellado (bajo una piedra o una pared de hielo) y no llega ni
  la caída vertical ni la diagonal, nace una pieza en el sitio con un pop.
  Sin esa red, los niveles con obstáculos dejaban agujeros permanentes.
- **Los objetivos de tipo `break` no pueden pedir más hielo o cuerdas de los
  que hay en el `layout`**, porque no reaparecen. Ya pasó una vez: el nivel 4
  pedía 8 cuerdas y solo había 6.
- **`Game.ejecutarJugada` apunta los ids de las dos piezas ANTES de resolver.**
  Cuando la animación arranca, el motor ya destruyó y colapsó el tablero, así
  que preguntarle quién hay en esas casillas devuelve piezas distintas.
- **No llames a un archivo `layout.ts` dentro de `src/app/`.** Next lo trata
  como fichero de ruta y rompe el build. Por eso `config/medidas.ts` se llama
  así.
- **Los recortes del sheet no son cuadrados.** Cualquier sitio nuevo que pinte
  un sprite tiene que encajarlo por el lado mayor, no estirarlo a un cuadrado.
- El cerrojo `bloqueado` de `Game.ts` es lo único que impide que un segundo
  swap a mitad de cascada descuadre tablero y pantalla.

---

## 5. Cómo comprobar que no rompiste nada

```bash
npm run typecheck     # tipos
npm run build         # compila y valida las rutas
npm run dev           # y entra a /juegos/sugu-match
```

El proyecto no tiene runner de tests unitarios y no se añadió uno para no
tocar el stack. Si quieres probar el motor sin navegador, compílalo suelto —
`core/` no depende de PixiJS, que es justamente para lo que se separó:

```bash
npx tsc src/app/juegos/sugu-match/game/core/turn.ts \
  --outDir /tmp/motor --module es2022 --target es2022 \
  --moduleResolution bundler --strict
```

Y contra eso, un script de Node que monte tableros a mano y compruebe
generación, especiales, gravedad con obstáculos, combos y mezcla.

---

## 6. Prompt para una sesión nueva

Abre Claude Code **dentro de `D:\Proyectos\web_sugurolls`** (no en otro
proyecto) y pega esto:

> Lee `esto_falta.md` de la raíz. Continúa el juego Sugu Match que está en
> `src/app/juegos/sugu-match`. Quiero la fase 16 y la 17: Supabase y ranking,
> siguiendo el patrón que ya usa `/juego` en `supabase/schema.sql` y en
> `supabase/migraciones/002-antitrampas-puntaje.sql`.
