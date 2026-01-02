"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Slide = {
  title: string;
  body: string;
  Icon: (props: { className?: string }) => React.ReactNode;
};

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm0 4.7a1.15 1.15 0 1 1 0 2.3a1.15 1.15 0 0 1 0-2.3Zm1.4 12.1H10.8c-.55 0-1-.45-1-1s.45-1 1-1h.6v-3.7h-.6c-.55 0-1-.45-1-1s.45-1 1-1H12.4c.55 0 1 .45 1 1v4.7h0c.55 0 1 .45 1 1s-.45 1-1 1Z"
      />
    </svg>
  );
}

function IconRoom({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3.2a2.8 2.8 0 0 1 2.8 2.8v1.3h1.6A3.6 3.6 0 0 1 20 10.9V17a3.8 3.8 0 0 1-3.8 3.8H7.8A3.8 3.8 0 0 1 4 17v-6.1a3.6 3.6 0 0 1 3.6-3.6h1.6V6A2.8 2.8 0 0 1 12 3.2Zm-1.2 4.1h2.4V6a1.2 1.2 0 0 0-2.4 0v1.3Z"
      />
      <path fill="currentColor" d="M8.6 12.1a1 1 0 0 1 1.4 0l1 1l3-3a1 1 0 1 1 1.4 1.4l-3.7 3.7a1 1 0 0 1-1.4 0l-1.7-1.7a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

function IconInvite({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11 7.2a3.2 3.2 0 1 1 0 6.4a3.2 3.2 0 0 1 0-6.4Zm7-2.1a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 0 1 0-4.4ZM4.5 9.4a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 0 1 0-4.4Zm6.5 5.9c3.2 0 5.8 1.9 5.8 4.2c0 .7-.6 1.3-1.3 1.3H6.5c-.7 0-1.3-.6-1.3-1.3c0-2.3 2.6-4.2 5.8-4.2Zm7 .2c1.9 0 3.5 1 3.5 2.4c0 .5-.4.9-.9.9h-2.6c.1-.3.1-.6.1-1c0-.8-.3-1.6-.8-2.3c.2 0 .5 0 .7 0ZM4.5 15.6c.2 0 .4 0 .7 0c-.5.7-.8 1.5-.8 2.3c0 .3 0 .7.1 1H1.9c-.5 0-.9-.4-.9-.9c0-1.4 1.6-2.4 3.5-2.4Z"
      />
    </svg>
  );
}

function IconCamera({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.2 4.5c.3-.6.9-1 1.6-1h2.4c.7 0 1.3.4 1.6 1l.5 1H18a3.5 3.5 0 0 1 3.5 3.5v7.5A3.5 3.5 0 0 1 18 20H6A3.5 3.5 0 0 1 2.5 16.5V9A3.5 3.5 0 0 1 6 5.5h2.7l.5-1ZM12 9a4 4 0 1 0 0 8a4 4 0 0 0 0-8Z"
      />
    </svg>
  );
}

function IconTrophy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3.5h10c.6 0 1 .4 1 1v1h2.1c.5 0 .9.4.9.9v1.7c0 2.4-1.6 4.4-3.8 4.9A6 6 0 0 1 13 16.4V19h3c.6 0 1 .4 1 1s-.4 1-1 1H8c-.6 0-1-.4-1-1s.4-1 1-1h3v-2.6a6 6 0 0 1-4.2-3.4C4.6 12.5 3 10.5 3 8.1V6.4c0-.5.4-.9.9-.9H6V4.5c0-.6.4-1 1-1Zm11 4v1.1c0 1.1.8 2 1.8 2.2c.7-.7 1.2-1.7 1.2-2.7V7.5H18ZM6 7.5H5v.6c0 1 .4 2 1.2 2.7c1-.2 1.8-1.1 1.8-2.2V7.5Z"
      />
    </svg>
  );
}

export function InfoHelp() {
  const slides: Slide[] = useMemo(
    () => [
      {
        title: "Crea una sala",
        body: "Pon tu nickname y el nombre. Se genera un código para tu partida.",
        Icon: IconRoom
      },
      {
        title: "Invita a tus amigos",
        body: "Comparte el enlace/código para que entren en la misma sala.",
        Icon: IconInvite
      },
      {
        title: "Haz foto o vídeo",
        body: "Cada reto se completa subiendo una foto o un vídeo desde el móvil.",
        Icon: IconCamera
      },
      {
        title: "Suma puntos",
        body: "Completa retos para subir en el ranking. El host controla el inicio.",
        Icon: IconTrophy
      }
    ],
    []
  );

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const close = useCallback(() => setOpen(false), []);
  const next = useCallback(() => setIndex((i) => Math.min(slides.length - 1, i + 1)), [slides.length]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, next, prev]);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const slide = slides[index];

  return (
    <>
      <button className="infoFab" type="button" onClick={() => setOpen(true)} aria-label="Información del juego">
        <IconInfo className="infoFabIcon" />
      </button>

      {open ? (
        <div className="infoModal" role="dialog" aria-modal="true" aria-label="Cómo funciona">
          <button className="infoBackdrop" type="button" onClick={close} aria-label="Cerrar" />
          <div className="infoPanel">
            <div className="infoTop">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="infoBadge">Ayuda</span>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  {index + 1}/{slides.length}
                </span>
              </div>
              <button className="infoClose" type="button" onClick={close}>
                Cerrar
              </button>
            </div>

            <div className="infoSlide">
              <div className="infoIconWrap">{slide.Icon({ className: "infoIcon" })}</div>
              <div>
                <div className="infoTitle">{slide.title}</div>
                <div className="infoBody">{slide.body}</div>
              </div>
            </div>

            <div className="infoDots" aria-hidden="true">
              {slides.map((_, i) => (
                <span key={i} className={i === index ? "infoDot infoDotActive" : "infoDot"} />
              ))}
            </div>

            <div className="infoNav">
              <button type="button" onClick={prev} disabled={index === 0}>
                Atrás
              </button>
              <button type="button" onClick={next} disabled={index === slides.length - 1}>
                {index === slides.length - 1 ? "Listo" : "Siguiente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

