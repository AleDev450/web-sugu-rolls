# Sugu Rolls

Juego de fusión de sushi (estilo *merge/drop*). Migración del prototipo
`sugu-rolls.html` al stack objetivo.

| Capa | Tecnología | Estado |
|---|---|---|
| Framework | Next.js 15 (App Router) | ✅ |
| Lenguaje | TypeScript (strict) | ✅ |
| Render | PixiJS 8 | ✅ |
| Física | Matter.js | ✅ |
| Animaciones | GSAP | ✅ |
| Audio | Howler.js (+ fallback WebAudio) | ✅ |
| Estado | Zustand | ✅ |
| Backend | Supabase | 🟡 cliente listo, tablas pendientes |
| Multiplayer | Colyseus | ⬜ futuro |
| Assets | spritesheets | 🟡 pendiente del boceto |
| Deploy | Vercel | ⬜ |

## Arrancar

```bash
npm install
npm run dev      # http://localhost:3000
```

El juego **corre sin ninguna imagen**: cada sprite que falte se dibuja con un
placeholder procedural (portado del Canvas2D del prototipo). Según van
apareciendo los PNG reales, van reemplazando a los placeholders solos.

## Assets

`imagenes/` en la raíz es la **fuente de verdad**. `public/imagenes/` es una
copia generada (ignorada por git) que Next sirve; se regenera en `predev` y
`prebuild`, o a mano con `npm run assets:sync`.

Para cambiar un sprite: reemplaza el PNG en `imagenes/` con el mismo nombre.
No hay que tocar código.

### Recortar el boceto

```bash
# 1. guarda el boceto como imagenes/boceto.png
npm run assets:slice -- --preview   # dibuja los recuadros sobre el boceto
                                    # -> imagenes/_preview-grid.png (revisar)
npm run assets:slice                # escribe los recortes
npm run assets:sync
```

Las coordenadas viven en `scripts/slice-boceto.mjs` (normalizadas 0..1). Si un
recorte sale corrido, se ajusta ahí y se vuelve a correr.

### Nombres esperados

Definidos en `src/game/assets/manifest.ts`:

```
imagenes/sushi/01-onigiri.png … 10-sugu-supreme.png
imagenes/bt21/{koya,rj,shooky,mang,chimmy,tata,cooky}.webp
imagenes/comida/{onigiri,bubble-tea,dragon-roll,california-roll,
                 temaki,ramen,mochi,bento}.png
imagenes/ui/{logo,panel-madera,panel-oscuro,banner-sugu,btn-*}.png
imagenes/fondos/{fachada,interior,puente}.png   ← el juego usa la primera que exista
sonidos → public/sonidos/*.mp3
```

**Fondos:** el juego muestra `fondos/interior.png` (o `fachada`/`puente` si no
existe) detrás de la caja, con un velo oscuro para legibilidad. Basta con
copiar el PNG a `imagenes/fondos/` y correr `npm run assets:sync`.

**Personajes BT21:** los PNG de trabajo van en `imagenes/_fuentes/bt21/`;
`node scripts/prepare-bt21.mjs` los recorta (quita fondos horneados, trim,
cuadra y reduce a ≤256px) y deja los `.webp` en `imagenes/bt21/`.

## Mapa del código

```
src/
├── app/                    páginas y estilos
├── components/             HUD, dock, overlays (React)
├── game/
│   ├── config/             ⭐ TODO el balance vive aquí
│   │   ├── tiers.ts        cadena de evolución (10 niveles) + tamaños
│   │   ├── layout.ts       medidas, reglas, constantes de física
│   │   ├── bt21.ts         los 7 clientes VIP y su poder único
│   │   └── vip.ts          tuning de visitas, pedidos y BTS Festival
│   ├── core/
│   │   ├── SuguGame.ts     orquestador (física + render + store + input)
│   │   ├── VipDirector.ts  clientes VIP: visitas, poderes, festival
│   │   ├── Physics.ts      Matter.js
│   │   └── Renderer.ts     PixiJS
│   ├── art/                placeholders procedurales + resolución de texturas
│   ├── assets/             manifest y carga tolerante a fallos
│   └── audio/              Howler + sintetizador de respaldo
├── store/                  Zustand
└── lib/supabase/           cliente + leaderboard
```

Para tunear el juego casi siempre basta con tocar `src/game/config/`.

## Reglas implementadas

- **Una sola vida.** Sin revivir ni continuar.
- **Derrota** (2 formas):
  - una pieza **se sale** del rectángulo de la caja → fin inmediato;
  - una pieza asentada **ya no puede entrar** (queda sobresaliendo por la
    línea superior) durante `RULES.dangerGraceMs` (1.5 s) → fin.
- **Sin power-ups.** Se quitaron los 8 del boceto (2026-07-31). El script de
  recorte aún puede extraer sus iconos por si se retoman.
- Fusión: dos piezas del mismo tier → la siguiente de la cadena.
- Combo: fusiones encadenadas dentro de `RULES.comboWindowMs` (1.5 s)
  multiplican los puntos (+50% por eslabón).
- Victoria al crear el **Sugu Supreme**; se puede seguir jugando después.
- Tamaño de piezas: radios en `src/game/config/tiers.ts` (subidos ~22% el
  2026-07-31 porque se veían pequeños).

## Clientes VIP BT21

Mecánica secundaria (no rompe el Suika base; fallar nunca penaliza):

- Cada cierto tiempo un BT21 entra caminando por la franja inferior y pide un
  plato (globo + barra de tiempo). Crear ese plato (por fusión, o soltándolo si
  es de los que caen) hace que **se lo lleve**: puntos de bonus + su poder.
- Poderes: KOYA gravedad lenta · RJ ×2 puntos · SHOOKY se come la pieza más
  pequeña · MANG empuja al centro · CHIMMY evoluciona una pieza · TATA Modo
  Fever · COOKY regala una pieza evolucionada.
- Los pedidos escalan con la puntuación (de gyoza hasta poke bowl) y la espera
  crece con el tier pedido.
- **BTS Festival**: atender a los 7 en la misma partida activa 20 s de ×2
  puntos, confeti, neón morado, música acelerada y cola cargada a tiers altos.
  Al terminar, la colección se reinicia y se puede volver a desbloquear.
- Todo el balance vive en `src/game/config/vip.ts`.
