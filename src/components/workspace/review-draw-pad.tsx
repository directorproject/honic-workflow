"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { BTN, BTN_GHOST } from "@/components/workspace/ws-ui";
import type { ReviewStroke } from "@/lib/workspace/types";

const COLORS = ["#dc2626", "#2563eb", "#059669", "#ca8a04", "#111827"];

export function ReviewDrawPad({
  disabled,
  onSave,
}: {
  disabled?: boolean;
  onSave: (strokes: ReviewStroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [strokes, setStrokes] = useState<ReviewStroke[]>([]);
  const drawing = useRef<ReviewStroke | null>(null);

  const redraw = useCallback((list: ReviewStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);
    for (const s of list) {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x * w, s.points[i].y * h);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      const width = Math.min(640, parent?.clientWidth ?? 480);
      canvas.width = width;
      canvas.height = Math.round(width * 0.65);
      redraw(strokes);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [redraw, strokes]);

  function pos(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  return (
    <div className="space-y-2">
      <p className="text-dash-muted-foreground text-xs">
        Draw over the page area (sketch marks). Pick the page number above, then save.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            onClick={() => setColor(c)}
            className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-dash-foreground" : "border-transparent"}`}
            style={{ background: c }}
          />
        ))}
        <button
          type="button"
          className={BTN_GHOST}
          onClick={() => {
            setStrokes([]);
            redraw([]);
          }}
        >
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="border-dash-border touch-none max-w-full cursor-crosshair rounded-xl border"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = { color, width: 2.5, points: [pos(e)] };
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          drawing.current.points.push(pos(e));
          redraw([...strokes, drawing.current]);
        }}
        onPointerUp={() => {
          if (!drawing.current || drawing.current.points.length < 2) {
            drawing.current = null;
            return;
          }
          const next = [...strokes, drawing.current];
          drawing.current = null;
          setStrokes(next);
          redraw(next);
        }}
      />
      <button
        type="button"
        disabled={disabled || !strokes.length}
        className={BTN}
        onClick={() => {
          onSave(strokes);
          setStrokes([]);
          redraw([]);
        }}
      >
        Save drawing
      </button>
    </div>
  );
}
