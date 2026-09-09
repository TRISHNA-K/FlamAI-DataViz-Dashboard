'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { setupHiDPICanvas } from '@/lib/canvasUtils';

interface Dimensions {
  width: number;
  height: number;
}

interface TransformState {
  zoom: number;
  panX: number;
  panY: number;
}

export function useChartRenderer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 600, height: 320 });
  const [transform, setTransform] = useState<TransformState>({ zoom: 1, panX: 0, panY: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Resize observer to auto-adapt to container size
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Update canvas HiDPI scaling whenever dimensions change
  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0 || dimensions.height === 0) return;
    setupHiDPICanvas(canvasRef.current, dimensions.width, dimensions.height);
  }, [dimensions]);

  // Interactive mouse handlers for Zoom & Pan
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setTransform((prev) => {
      const newZoom = Math.min(50, Math.max(1, prev.zoom * zoomFactor));
      if (newZoom === 1) {
        return { zoom: 1, panX: 0, panY: 0 };
      }
      // Zoom centered around mouse pointer
      const newPanX = mouseX - (mouseX - prev.panX) * (newZoom / prev.zoom);
      return {
        zoom: newZoom,
        panX: newPanX,
        panY: 0,
      };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Left click only
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const rafMouseRef = useRef<number | null>(null);
  const pendingMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const pendingDeltaXRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    pendingMousePosRef.current = { x: mouseX, y: mouseY };

    if (isDraggingRef.current) {
      pendingDeltaXRef.current += e.clientX - lastMousePosRef.current.x;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }

    if (rafMouseRef.current === null) {
      rafMouseRef.current = requestAnimationFrame(() => {
        rafMouseRef.current = null;
        if (pendingMousePosRef.current) {
          setMousePos(pendingMousePosRef.current);
          setIsHovered(true);
        }
        if (pendingDeltaXRef.current !== 0) {
          const delta = pendingDeltaXRef.current;
          pendingDeltaXRef.current = 0;
          setTransform((prev) => ({
            ...prev,
            panX: prev.panX + delta,
          }));
        }
      });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    setIsHovered(false);
    setMousePos(null);
    if (rafMouseRef.current !== null) {
      cancelAnimationFrame(rafMouseRef.current);
      rafMouseRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafMouseRef.current !== null) {
        cancelAnimationFrame(rafMouseRef.current);
        rafMouseRef.current = null;
      }
    };
  }, []);

  const handleDoubleClick = useCallback(() => {
    // Reset zoom and pan
    setTransform({ zoom: 1, panX: 0, panY: 0 });
  }, []);

  const resetTransform = useCallback(() => {
    setTransform({ zoom: 1, panX: 0, panY: 0 });
  }, []);

  return {
    canvasRef,
    containerRef,
    dimensions,
    transform,
    mousePos,
    isHovered,
    eventHandlers: {
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onDoubleClick: handleDoubleClick,
    },
    resetTransform,
  };
}
