'use client';

import { useEffect, useRef, useState } from 'react';
import { TIERS } from '@/game/config/tiers';
import { assetUrl } from '@/game/assets/manifest';
import {
  CODE_LENGTH,
  esModoPruebas,
  getRanking,
  normalizeAccessCode,
  redeemAccessCode,
  submitScore,
  type DatosJugador,
  type RankEntry,
} from '@/lib/scores';
import { useGameStore } from '@/store/useGameStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { TierImage } from './TierImage';

export type PanelId = 'howto' | 'settings' | 'book' | 'ranking' | 'code' | null;

/** Salida del juego hacia la web. Es un <a> real: recarga y libera Pixi. */
export function VolverAlSitio() {
  return (
    <a href="/" className="volver-sitio" aria-label="Volver a la web de Sugu Rolls">
      <span aria-hidden>‹</span>
      <span>Volver a la web</span>
    </a>
  );
}

/**
 * Vista principal: la ilustración VistaPrincipal trae los botones pintados
 * (INICIAR JUEGO / CÓMO JUGAR / RANKING); encima van zonas clicables
 * invisibles posicionadas en % de la imagen.
 *
 * El juego vive dentro de la web (/juego), así que arriba a la izquierda va
 * la salida de vuelta al sitio.
 */
export function StartOverlay({
  onPlay,
  onHowto,
  onRanking,
}: {
  onPlay: () => void;
  onHowto: () => void;
  onRanking: () => void;
}) {
  return (
    <div className="start-view">
      <img
        className="start-view-bg"
        src={assetUrl('ui', 'vista-principal')}
        alt="Sugu Rolls"
        draggable={false}
      />
      <VolverAlSitio />
      <button
        className="start-hotspot"
        style={{ top: '45%', height: '9%' }}
        onClick={onPlay}
        aria-label="Iniciar juego"
      />
      <button
        className="start-hotspot"
        style={{ top: '55%', height: '7.6%' }}
        onClick={onHowto}
        aria-label="Cómo jugar"
      />
      <button
        className="start-hotspot"
        style={{ top: '63.8%', height: '7.6%' }}
        onClick={onRanking}
        aria-label="Ranking"
      />
    </div>
  );
}

/** Alturas de las 10 filas pintadas en el arte del ranking, en % de la imagen. */
const RANK_ROWS = [
  { top: '23.6%', height: '7.7%', left: '31.3%', width: '55.7%' },
  { top: '34.2%', height: '6.7%', left: '31.3%', width: '55.7%' },
  { top: '44.1%', height: '6.6%', left: '31.3%', width: '55.7%' },
  { top: '53.5%', height: '4.3%', left: '22.0%', width: '65.0%' },
  { top: '58.8%', height: '3.9%', left: '22.0%', width: '65.0%' },
  { top: '63.6%', height: '4.0%', left: '22.0%', width: '65.0%' },
  { top: '68.5%', height: '4.2%', left: '22.0%', width: '65.0%' },
  { top: '73.4%', height: '4.2%', left: '22.0%', width: '65.0%' },
  { top: '78.4%', height: '4.0%', left: '22.0%', width: '65.0%' },
  { top: '83.3%', height: '3.9%', left: '22.0%', width: '65.0%' },
];

export function RankingOverlay({ onClose }: { onClose: () => void }) {
  // se consulta una vez al abrir la ventana
  const [top, setTop] = useState<RankEntry[] | null>(null);

  useEffect(() => {
    let vivo = true;
    void getRanking(RANK_ROWS.length).then((filas) => {
      if (vivo) setTop(filas);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="img-modal">
      <div className="img-modal-frame">
        <img
          className="img-modal-bg"
          src={assetUrl('ui', 'ranking')}
          alt="Ranking"
          draggable={false}
        />
        {RANK_ROWS.map((box, i) => {
          const entry = top?.[i];
          if (!entry) return null;
          return (
            <div key={i} className={`rank-row${i < 3 ? ' podium' : ''}`} style={box}>
              <span className="rank-name">{entry.nickname}</span>
              <span className="rank-score">{entry.score.toLocaleString('es')}</span>
            </div>
          );
        })}
        {top === null && <span className="rank-empty">Cargando ranking…</span>}
        {top?.length === 0 && (
          <span className="rank-empty">Aún no hay partidas registradas</span>
        )}
        <button
          className="img-hotspot"
          style={{ left: '85.4%', width: '8.8%', top: '10.9%', height: '5.9%' }}
          onClick={onClose}
          aria-label="Cerrar"
        />
      </div>
    </div>
  );
}

export function PauseOverlay({
  onResume,
  onSettings,
  onQuit,
}: {
  onResume: () => void;
  onSettings: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="img-modal">
      <div className="img-modal-frame">
        <img
          className="img-modal-bg"
          src={assetUrl('ui', 'ventana-pausa')}
          alt="En pausa"
          draggable={false}
        />
        <button
          className="img-hotspot"
          style={{ left: '16.4%', width: '67.6%', top: '39.4%', height: '6.8%' }}
          onClick={onResume}
          aria-label="Continuar"
        />
        <button
          className="img-hotspot"
          style={{ left: '16.4%', width: '67.6%', top: '49.2%', height: '6.8%' }}
          onClick={onSettings}
          aria-label="Ajustes"
        />
        <button
          className="img-hotspot"
          style={{ left: '16.4%', width: '67.6%', top: '58.6%', height: '6.2%' }}
          onClick={onQuit}
          aria-label="Salir al menú"
        />
      </div>
    </div>
  );
}

/**
 * Ventana de código de acceso (imagen ventana_emergente con casillas y
 * botones pintados). El código se teclea en un input invisible sobre las
 * casillas y los caracteres se dibujan encima de cada una.
 *
 * Los códigos del panel son ALFANUMÉRICOS en mayúsculas (ver `random_code`),
 * así que el campo acepta letras y números y el canje va contra la base.
 */
export function CodeGateOverlay({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  /** Recibe los datos que la base ya conocía del jugador, si estaba logueado. */
  onSuccess: (jugador?: DatosJugador) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // centros medidos de las 6 casillas pintadas, en % del ancho de la imagen
  // (el espaciado no es uniforme: el arte tiene un pelín de perspectiva)
  const cells = [22.0, 32.6, 43.6, 54.6, 65.9, 77.2];

  const tryContinue = async () => {
    if (checking) return;
    setChecking(true);
    const res = await redeemAccessCode(code);
    setChecking(false);

    if (res.ok) {
      onSuccess(res.jugador);
      return;
    }
    setError(res.mensaje ?? 'Código incorrecto, inténtalo de nuevo');
    setCode('');
    inputRef.current?.focus();
  };

  return (
    <div className="img-modal">
      <div className="img-modal-frame">
        <img
          className="img-modal-bg"
          src={assetUrl('ui', 'ventana-emergente')}
          alt="Ingresa tu código"
          draggable={false}
        />
        {cells.map((x, i) => (
          <span key={i} className="code-digit" style={{ left: `${x}%` }}>
            {code[i] ?? ''}
          </span>
        ))}
        <input
          ref={inputRef}
          className="code-input"
          type="text"
          inputMode="text"
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={CODE_LENGTH}
          value={code}
          onChange={(e) => {
            setError(null);
            setCode(normalizeAccessCode(e.target.value));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void tryContinue();
          }}
          aria-label="Código de acceso"
        />
        {error && <span className="code-error">{error}</span>}
        <button
          className="img-hotspot"
          style={{ left: '15.9%', width: '31.9%', top: '57.3%', height: '6.2%' }}
          onClick={onCancel}
          aria-label="Cancelar"
        />
        <button
          className="img-hotspot"
          style={{ left: '50.8%', width: '31.7%', top: '57.3%', height: '6.2%' }}
          onClick={() => void tryContinue()}
          aria-label="Continuar"
          disabled={checking}
        />
      </div>
    </div>
  );
}

/**
 * Game over con registro de la partida (imagen game_over con campos y
 * botones pintados): nickname, nombre y teléfono + puntaje logrado.
 *
 * "ENVIAR DATOS" cierra la sesión abierta por el código con `finish_session`,
 * que es lo que hace entrar la partida al ranking.
 */
export function GameOverFormOverlay({
  onMenu,
  datos,
}: {
  onMenu: () => void;
  datos?: DatosJugador;
}) {
  const score = useGameStore((s) => s.score);
  const [nickname, setNickname] = useState(datos?.nickname ?? '');
  const [name, setName] = useState(datos?.name ?? '');
  const [phone, setPhone] = useState(datos?.phone ?? '');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const prueba = esModoPruebas();

  const send = async () => {
    if (sent || sending) return;
    // en pruebas no se pide nada: la partida no se guarda en ningún sitio
    if (!prueba && (!nickname.trim() || !name.trim() || phone.replace(/\D/g, '').length < 6)) {
      setFeedback({ ok: false, text: 'Completa nickname, nombre y un teléfono válido' });
      return;
    }

    setSending(true);
    setFeedback({ ok: true, text: 'Registrando…' });
    const res = await submitScore({
      nickname: nickname.trim(),
      name: name.trim(),
      phone: phone.trim(),
      score,
      at: new Date().toISOString(),
    });
    setSending(false);

    if (!res.ok) {
      setFeedback({ ok: false, text: res.mensaje ?? 'No se pudo registrar tu partida' });
      return;
    }
    setSent(true);
    setFeedback({
      ok: true,
      text: res.prueba ? res.mensaje ?? 'Modo de pruebas' : '¡Partida registrada!',
    });
    setTimeout(onMenu, 1200);
  };

  return (
    <div className="img-modal">
      <div className="img-modal-frame">
        <img
          className="img-modal-bg"
          src={assetUrl('ui', 'game-over')}
          alt="Game over"
          draggable={false}
        />
        <div className="go-score">{score.toLocaleString('es')}</div>
        {prueba && <span className="go-prueba">MODO DE PRUEBAS · NO SE REGISTRA</span>}
        <input
          className="go-input"
          style={{ top: '51.7%' }}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          aria-label="Nickname"
        />
        <input
          className="go-input"
          style={{ top: '56.5%' }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          aria-label="Nombre"
        />
        <input
          className="go-input"
          style={{ top: '61.3%' }}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, ''))}
          type="tel"
          inputMode="tel"
          maxLength={15}
          aria-label="Teléfono"
        />
        {feedback && (
          <span
            className="go-feedback"
            style={{ color: feedback.ok ? 'var(--matcha, #7fae4f)' : '#e05a4c' }}
          >
            {feedback.text}
          </span>
        )}
        <button
          className="img-hotspot"
          style={{ left: '20.5%', width: '28.7%', top: '66.3%', height: '4.6%' }}
          onClick={onMenu}
          aria-label="Regresar al menú"
        />
        <button
          className="img-hotspot"
          style={{ left: '50.5%', width: '28.7%', top: '66.3%', height: '4.6%' }}
          onClick={() => void send()}
          aria-label="Enviar datos"
          disabled={sending || sent}
        />
      </div>
    </div>
  );
}

/**
 * Cómo jugar: dos láminas en secuencia (reglas -> BT21 y poderes), cada una
 * con su X de cerrar y su botón de avance pintados en el arte.
 */
export function HowToOverlay({ onClose, onPlay }: { onClose: () => void; onPlay: () => void }) {
  const [page, setPage] = useState(0);
  const isFirst = page === 0;

  return (
    <div className="img-modal">
      <div className="img-modal-frame">
        <img
          className="img-modal-bg"
          src={assetUrl('ui', isFirst ? 'how-to-play-1' : 'how-to-play-2')}
          alt={isFirst ? 'Cómo jugar' : 'BT21 y poderes'}
          draggable={false}
        />
        {isFirst ? (
          <>
            <button
              className="img-hotspot"
              style={{ left: '84.8%', width: '11.7%', top: '7.8%', height: '6.8%' }}
              onClick={onClose}
              aria-label="Cerrar"
            />
            <button
              className="img-hotspot"
              style={{ left: '18.6%', width: '63.5%', top: '85.3%', height: '8.5%' }}
              onClick={() => setPage(1)}
              aria-label="Siguiente"
            />
          </>
        ) : (
          <>
            <button
              className="img-hotspot"
              style={{ left: '82.6%', width: '9.2%', top: '5.1%', height: '5.7%' }}
              onClick={onClose}
              aria-label="Cerrar"
            />
            <button
              className="img-hotspot"
              style={{ left: '25.9%', width: '49.3%', top: '88.9%', height: '5.9%' }}
              onClick={onPlay}
              aria-label="A jugar"
            />
          </>
        )}
      </div>
    </div>
  );
}

export function CollectionOverlay({ onClose }: { onClose: () => void }) {
  const unlocked = useGameStore((s) => s.unlocked);
  return (
    <div className="overlay">
      <div className="panel" style={{ maxWidth: 360 }}>
        <button className="close-x" onClick={onClose}>
          ✕
        </button>
        <div className="sub">CADENA DE EVOLUCIÓN</div>
        <h2 style={{ fontSize: 22 }}>La Carta</h2>
        <div className="collect-grid">
          {TIERS.map((t, i) => (
            <div
              key={t.id}
              className={`collect-cell${unlocked.includes(i) ? '' : ' locked'}`}
              title={unlocked.includes(i) ? t.name : '???'}
            >
              <TierImage tier={i} size={56} />
            </div>
          ))}
        </div>
        <div className="hint">Desbloquea cada pieza fusionándola al menos una vez.</div>
      </div>
    </div>
  );
}

/**
 * Ajustes sobre el arte `ajustes_opciones`. Los interruptores pintados están
 * siempre apagados, así que encima de cada uno va un toggle real que refleja
 * el estado del store.
 */
export function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const s = useSettingsStore();
  const rows: { key: 'sound' | 'music' | 'haptic'; label: string; top: string }[] = [
    { key: 'sound', label: 'Sonido', top: '39.7%' },
    { key: 'music', label: 'Música', top: '46.7%' },
    { key: 'haptic', label: 'Vibración', top: '53.5%' },
  ];

  return (
    <div className="img-modal">
      <div className="img-modal-frame">
        <img
          className="img-modal-bg"
          src={assetUrl('ui', 'ajustes')}
          alt="Ajustes"
          draggable={false}
        />
        {rows.map(({ key, label, top }) => (
          <button
            key={key}
            className={`art-toggle${s[key] ? ' on' : ''}`}
            style={{ top }}
            onClick={() => s.toggle(key)}
            aria-label={label}
            aria-pressed={s[key]}
          >
            <span className="art-toggle-knob" />
          </button>
        ))}
        <button
          className="img-hotspot"
          style={{ left: '73.0%', width: '10.9%', top: '24.9%', height: '7.2%' }}
          onClick={onClose}
          aria-label="Cerrar"
        />
        <button
          className="img-hotspot"
          style={{ left: '21.0%', width: '58.6%', top: '60.7%', height: '5.6%' }}
          onClick={onClose}
          aria-label="Listo"
        />
      </div>
    </div>
  );
}
