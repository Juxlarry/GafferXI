import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type { DrawingShape, DrawingTool, ArrowShape, LineShape } from '../../tacticalTypes';
import { useTacticalBoard } from './TacticalBoardContext';

// ─── Math helpers ──────────────────────────────────────────────────────────────

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(px, py, ax, ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return dist(px, py, ax + t * dx, ay + t * dy);
}

// ─── Bounding box ──────────────────────────────────────────────────────────────

interface BBox { cx: number; cy: number; hw: number; hh: number; }

function getBBox(s: DrawingShape): BBox {
  switch (s.type) {
    case 'arrow':
    case 'line':     return { cx: (s.x1+s.x2)/2, cy: (s.y1+s.y2)/2, hw: Math.abs(s.x2-s.x1)/2+16, hh: Math.abs(s.y2-s.y1)/2+16 };
    case 'circle':   return { cx: s.cx, cy: s.cy, hw: s.r, hh: s.r };
    case 'square':   return { cx: s.x+s.side/2, cy: s.y+s.side/2, hw: Math.abs(s.side)/2, hh: Math.abs(s.side)/2 };
    case 'rectangle':return { cx: s.x+s.w/2, cy: s.y+s.h/2, hw: Math.abs(s.w)/2, hh: Math.abs(s.h)/2 };
    case 'triangle':
    case 'star':
    case 'diamond':
    case 'cross':    return { cx: s.cx, cy: s.cy, hw: s.r, hh: s.r };
  }
}

// ─── Hit testing ──────────────────────────────────────────────────────────────

const HANDLE_HIT = 12;

function hitTestShape(s: DrawingShape, px: number, py: number): boolean {
  switch (s.type) {
    case 'arrow':
    case 'line':      return distToSegment(px, py, s.x1, s.y1, s.x2, s.y2) < 10;
    case 'circle': {
      const d = dist(px, py, s.cx, s.cy);
      return Math.abs(d - s.r) < 10 || d < Math.min(10, s.r);
    }
    case 'square': {
      const { cx, cy, hw } = getBBox(s);
      return Math.abs(px - cx) <= hw + 8 && Math.abs(py - cy) <= hw + 8;
    }
    case 'rectangle': {
      const { cx, cy, hw, hh } = getBBox(s);
      return Math.abs(px - cx) <= hw + 8 && Math.abs(py - cy) <= hh + 8;
    }
    case 'triangle':
    case 'star':
    case 'diamond':
    case 'cross':     return dist(px, py, s.cx, s.cy) <= s.r + 8;
  }
}

function hitTestHandles(s: DrawingShape, px: number, py: number): 'rotate' | 'scale' | 'arrow-start' | 'arrow-end' | null {
  if (s.type === 'arrow' || s.type === 'line') {
    if (dist(px, py, s.x1, s.y1) <= HANDLE_HIT) return 'arrow-start';
    if (dist(px, py, s.x2, s.y2) <= HANDLE_HIT) return 'arrow-end';
    return null;
  }
  const { cx, cy, hw, hh } = getBBox(s);
  const pad = 8;
  const ry = cy - hh - pad - 28;
  if (dist(px, py, cx, ry) <= HANDLE_HIT) return 'rotate';
  const sx = cx + hw + pad, sy = cy + hh + pad;
  if (Math.abs(px - sx) <= HANDLE_HIT && Math.abs(py - sy) <= HANDLE_HIT) return 'scale';
  return null;
}

// ─── Drag-op transforms ───────────────────────────────────────────────────────

function applyMove(s: DrawingShape, dx: number, dy: number): DrawingShape {
  switch (s.type) {
    case 'arrow':
    case 'line':      return { ...s, x1: s.x1+dx, y1: s.y1+dy, x2: s.x2+dx, y2: s.y2+dy };
    case 'circle':    return { ...s, cx: s.cx+dx, cy: s.cy+dy };
    case 'square':    return { ...s, x: s.x+dx, y: s.y+dy };
    case 'rectangle': return { ...s, x: s.x+dx, y: s.y+dy };
    case 'triangle':
    case 'star':
    case 'diamond':
    case 'cross':     return { ...s, cx: s.cx+dx, cy: s.cy+dy };
  }
}

function applyScale(s: DrawingShape, startX: number, startY: number, curX: number, curY: number): DrawingShape {
  const { cx, cy } = getBBox(s);
  const d0 = dist(startX, startY, cx, cy);
  if (d0 < 1) return s;
  const ratio = Math.max(0.1, Math.min(10, dist(curX, curY, cx, cy) / d0));
  switch (s.type) {
    case 'arrow':
    case 'line': {
      const mx = (s.x1+s.x2)/2, my = (s.y1+s.y2)/2;
      return { ...s, x1: mx+(s.x1-mx)*ratio, y1: my+(s.y1-my)*ratio, x2: mx+(s.x2-mx)*ratio, y2: my+(s.y2-my)*ratio };
    }
    case 'circle':    return { ...s, r: Math.max(5, s.r * ratio) };
    case 'square':  { const ns = s.side * ratio; return { ...s, x: cx-ns/2, y: cy-ns/2, side: ns }; }
    case 'rectangle':{ const nw = s.w*ratio, nh = s.h*ratio; return { ...s, x: cx-nw/2, y: cy-nh/2, w: nw, h: nh }; }
    case 'triangle':
    case 'star':
    case 'diamond':
    case 'cross':     return { ...s, r: Math.max(5, s.r * ratio) };
  }
}

function applyRotate(s: DrawingShape, startX: number, startY: number, curX: number, curY: number): DrawingShape {
  const { cx, cy } = getBBox(s);
  const delta = Math.atan2(curY - cy, curX - cx) - Math.atan2(startY - cy, startX - cx);
  return { ...s, rotation: (s.rotation ?? 0) + delta };
}

// ─── Canvas rendering ─────────────────────────────────────────────────────────

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, alpha = 1) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;
  const angle = Math.atan2(dy, dx);
  const head = Math.min(18, len * 0.25);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, dashed: boolean, alpha = 1) {
  const dx = x2 - x1, dy = y2 - y1;
  if (Math.sqrt(dx * dx + dy * dy) < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha = 1) {
  if (r < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, alpha = 1) {
  if (Math.abs(w) < 2 || Math.abs(h) < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawTriangle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha = 1) {
  if (r < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha = 1) {
  if (r < 2) return;
  const inner = r * 0.42;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 / 10) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : inner;
    const x = cx + rad * Math.cos(angle);
    const y = cy + rad * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha = 1) {
  if (r < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawCross(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha = 1) {
  if (r < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
  ctx.stroke();
  ctx.restore();
}

function renderShapeInner(ctx: CanvasRenderingContext2D, s: DrawingShape, alpha = 1) {
  switch (s.type) {
    case 'arrow':     drawArrow(ctx, s.x1, s.y1, s.x2, s.y2, s.color, alpha); break;
    case 'line':      drawLine(ctx, s.x1, s.y1, s.x2, s.y2, s.color, s.dashed ?? false, alpha); break;
    case 'circle':    drawCircle(ctx, s.cx, s.cy, s.r, s.color, alpha); break;
    case 'square':    drawRect(ctx, s.x, s.y, s.side, s.side, s.color, alpha); break;
    case 'rectangle': drawRect(ctx, s.x, s.y, s.w, s.h, s.color, alpha); break;
    case 'triangle':  drawTriangle(ctx, s.cx, s.cy, s.r, s.color, alpha); break;
    case 'star':      drawStar(ctx, s.cx, s.cy, s.r, s.color, alpha); break;
    case 'diamond':   drawDiamond(ctx, s.cx, s.cy, s.r, s.color, alpha); break;
    case 'cross':     drawCross(ctx, s.cx, s.cy, s.r, s.color, alpha); break;
  }
}

function renderShape(ctx: CanvasRenderingContext2D, s: DrawingShape, alpha = 1) {
  const rot = s.rotation ?? 0;
  if (rot !== 0) {
    const { cx, cy } = getBBox(s);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-cx, -cy);
    renderShapeInner(ctx, s, alpha);
    ctx.restore();
  } else {
    renderShapeInner(ctx, s, alpha);
  }
}

function drawSelectionHandles(ctx: CanvasRenderingContext2D, s: DrawingShape) {
  const { cx, cy, hw, hh } = getBBox(s);
  const pad = 8;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(cx - hw - pad, cy - hh - pad, (hw + pad) * 2, (hh + pad) * 2);
  ctx.setLineDash([]);
  ctx.restore();

  if (s.type === 'arrow' || s.type === 'line') {
    [[s.x1, s.y1], [s.x2, s.y2]].forEach(([px, py]) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    });
    return;
  }

  // Connector to rotate handle
  const ry = cy - hh - pad - 28;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh - pad);
  ctx.lineTo(cx, ry + 7);
  ctx.stroke();
  ctx.setLineDash([]);

  // Rotate handle
  ctx.beginPath();
  ctx.arc(cx, ry, 7, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Scale handle (bottom-right)
  const sx = cx + hw + pad, sy = cy + hh + pad;
  ctx.fillStyle = 'white';
  ctx.fillRect(sx - 5, sy - 5, 10, 10);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx - 5, sy - 5, 10, 10);
  ctx.restore();
}

// ─── Draft shape builder ──────────────────────────────────────────────────────

interface DraftState {
  tool: DrawingTool;
  startX: number; startY: number;
  curX: number; curY: number;
  color: string;
}

function buildDraftShape(draft: DraftState): DrawingShape | null {
  const { tool, startX, startY, curX, curY, color } = draft;
  const dx = curX - startX, dy = curY - startY;
  const id = '__draft__';
  const r = Math.sqrt(dx * dx + dy * dy);
  switch (tool) {
    case 'arrow':        return { id, type: 'arrow', x1: startX, y1: startY, x2: curX, y2: curY, color };
    case 'line':         return { id, type: 'line', x1: startX, y1: startY, x2: curX, y2: curY, color, dashed: false };
    case 'dashed-line':  return { id, type: 'line', x1: startX, y1: startY, x2: curX, y2: curY, color, dashed: true };
    case 'circle':       return { id, type: 'circle', cx: startX, cy: startY, r, color };
    case 'square': {
      const side = Math.max(Math.abs(dx), Math.abs(dy)) * Math.sign(dx || 1);
      return { id, type: 'square', x: startX, y: startY, side, color };
    }
    case 'rectangle':    return { id, type: 'rectangle', x: startX, y: startY, w: dx, h: dy, color };
    case 'triangle':     return { id, type: 'triangle', cx: startX, cy: startY, r, color };
    case 'star':         return { id, type: 'star', cx: startX, cy: startY, r, color };
    case 'diamond':      return { id, type: 'diamond', cx: startX, cy: startY, r, color };
    case 'cross':        return { id, type: 'cross', cx: startX, cy: startY, r, color };
    default: return null;
  }
}

function finalizeShape(draft: DraftState): DrawingShape | null {
  const shape = buildDraftShape(draft);
  if (!shape) return null;
  return { ...shape, id: crypto.randomUUID() };
}

// ─── Component ────────────────────────────────────────────────────────────────

type DragOp = {
  kind: 'move' | 'scale' | 'rotate' | 'arrow-start' | 'arrow-end';
  startX: number; startY: number;
  snapshot: DrawingShape;
} | null;

export default function DrawingCanvas() {
  const { state, dispatch } = useTacticalBoard();
  const { activeTool, activeColor, shapes } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOp, setDragOp] = useState<DragOp>(null);
  const [previewShape, setPreviewShape] = useState<DrawingShape | null>(null);

  // Deselect when switching to a drawing tool
  useEffect(() => {
    if (activeTool !== 'select') {
      setSelectedId(null);
      setPreviewShape(null);
      setDragOp(null);
    }
  }, [activeTool]);

  // Keyboard: delete / escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        dispatch({ type: 'DELETE_SHAPE', id: selectedId });
        setSelectedId(null);
        setPreviewShape(null);
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setPreviewShape(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, dispatch]);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h) return;
    canvas.width = size.w;
    canvas.height = size.h;
  }, [size]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const displayShape = previewShape ?? (selectedId ? shapes.find(s => s.id === selectedId) ?? null : null);

    shapes.forEach(s => {
      if (s.id === selectedId) return;
      renderShape(ctx, s);
    });

    if (displayShape) {
      renderShape(ctx, displayShape);
      drawSelectionHandles(ctx, displayShape);
    }

    if (draft) {
      const ds = buildDraftShape(draft);
      if (ds) renderShape(ctx, ds, 0.65);
    }
  }, [shapes, draft, selectedId, previewShape]);

  useEffect(() => { redraw(); }, [redraw]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getPos(e);

    if (activeTool === 'select') {
      if (selectedId) {
        const sel = shapes.find(s => s.id === selectedId);
        if (sel) {
          const handle = hitTestHandles(sel, x, y);
          if (handle) {
            setDragOp({ kind: handle, startX: x, startY: y, snapshot: sel });
            setPreviewShape(sel);
            return;
          }
        }
      }
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (hitTestShape(s, x, y)) {
          setSelectedId(s.id);
          setDragOp({ kind: 'move', startX: x, startY: y, snapshot: s });
          setPreviewShape(s);
          return;
        }
      }
      setSelectedId(null);
      setPreviewShape(null);
      return;
    }

    setSelectedId(null);
    setPreviewShape(null);
    setDraft({ tool: activeTool, startX: x, startY: y, curX: x, curY: y, color: activeColor });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e);

    if (dragOp) {
      const { kind, startX, startY, snapshot } = dragOp;
      const dx = x - startX, dy = y - startY;
      let updated: DrawingShape;
      switch (kind) {
        case 'move':        updated = applyMove(snapshot, dx, dy); break;
        case 'scale':       updated = applyScale(snapshot, startX, startY, x, y); break;
        case 'rotate':      updated = applyRotate(snapshot, startX, startY, x, y); break;
        case 'arrow-start': updated = { ...(snapshot as ArrowShape | LineShape), x1: x, y1: y }; break;
        case 'arrow-end':   updated = { ...(snapshot as ArrowShape | LineShape), x2: x, y2: y }; break;
      }
      setPreviewShape(updated!);
      return;
    }

    if (draft) {
      setDraft(d => d ? { ...d, curX: x, curY: y } : null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (dragOp && previewShape) {
      dispatch({ type: 'UPDATE_SHAPE', shape: previewShape });
      setDragOp(null);
      setPreviewShape(null);
      return;
    }

    if (draft) {
      const shape = finalizeShape(draft);
      if (shape) dispatch({ type: 'ADD_SHAPE', shape });
      setDraft(null);
    }
  };

  // Compute delete button position from selected shape bbox
  const deleteButtonPos = (() => {
    if (!selectedId || dragOp || !size.w) return null;
    const selShape = previewShape ?? shapes.find(s => s.id === selectedId);
    if (!selShape) return null;
    const { cx, cy, hw, hh } = getBBox(selShape);
    const pad = 8;
    return {
      left: Math.min(cx + hw + pad + 6, size.w - 36),
      top: Math.max(cy - hh - pad - 36, 4),
    };
  })();

  const cursor = activeTool !== 'select' ? 'crosshair' : dragOp ? 'grabbing' : 'default';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 30, pointerEvents: 'auto' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor, display: 'block' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Delete button overlay — visible when a shape is selected and not being dragged */}
      {deleteButtonPos && (
        <button
          style={{
            position: 'absolute',
            left: deleteButtonPos.left,
            top: deleteButtonPos.top,
            zIndex: 40,
          }}
          onClick={() => {
            dispatch({ type: 'DELETE_SHAPE', id: selectedId! });
            setSelectedId(null);
            setPreviewShape(null);
          }}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-400 text-white shadow-lg transition-colors"
          title="Delete shape"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
