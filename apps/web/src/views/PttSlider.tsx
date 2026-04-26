import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n";

interface Props {
  talking: boolean;
  onTalkStart: () => void;
  onTalkEnd: () => void;
}

const LATCH_THRESHOLD = 0.88;
const LOCK_HINT_THRESHOLD = 0.01; // show "→ Slide to lock" from the very first movement

export function PttSlider({ talking, onTalkStart, onTalkEnd }: Props) {
  const { t } = useLang();
  const trackRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0); // 0–1
  const [dragging, setDragging] = useState(false);
  const [latched, setLatched] = useState(false);
  const startXRef = useRef(0);
  const pointerId = useRef<number | null>(null);

  useEffect(() => {
    if (!talking && latched) {
      setLatched(false);
      setPos(0);
    }
  }, [talking, latched]);

  function onPointerDown(e: React.PointerEvent) {
    if (latched) {
      onTalkEnd();
      setLatched(false);
      setPos(0);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerId.current = e.pointerId;
    startXRef.current = e.clientX;
    setDragging(true);
    onTalkStart();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || pointerId.current !== e.pointerId) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const maxTravel = rect.width - 56 - 8;
    const dx = e.clientX - startXRef.current;
    setPos(Math.max(0, Math.min(1, dx / maxTravel)));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging || pointerId.current !== e.pointerId) return;
    setDragging(false);
    pointerId.current = null;
    if (pos >= LATCH_THRESHOLD) {
      setLatched(true);
      setPos(1);
    } else {
      setPos(0);
      onTalkEnd();
    }
  }

  const thumbPct = latched ? 100 : pos * 100;
  const nearLock = dragging && pos >= LOCK_HINT_THRESHOLD;

  function getLabel() {
    if (latched) return t.pttTapToStop;
    if (nearLock) return t.pttSlideLock; // shown from first movement
    return t.pttPushToTalk;
  }

  return (
    <div
      ref={trackRef}
      className={`pttSliderTrack ${dragging || latched ? "active" : ""} ${latched ? "latched" : ""} ${nearLock ? "nearLock" : ""}`}
      style={{ "--ptt-pos": thumbPct / 100, "--ptt-fill": `calc(${thumbPct}% + 28px)` } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="pttSliderFill" />
      <div className={`pttSliderThumb ${dragging ? "" : "pttSliderThumbAnimate"}`}>
        {latched ? "■" : "▶"}
      </div>
      <span className="pttSliderLabel">{getLabel()}</span>
    </div>
  );
}
