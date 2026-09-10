'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  OffscreenBufferContext,
  createOffscreenBuffer,
  isOffscreenCanvasSupported,
} from '@/lib/offscreenRenderer';

export function useOffscreenCanvas() {
  const bufferRef = useRef<OffscreenBufferContext | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(isOffscreenCanvasSupported());
  }, []);

  const getOrCreateBuffer = useCallback(
    (
      width: number,
      height: number,
      dpr: number = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
    ) => {
      if (
        !bufferRef.current ||
        bufferRef.current.width !== width ||
        bufferRef.current.height !== height ||
        bufferRef.current.dpr !== dpr
      ) {
        bufferRef.current = createOffscreenBuffer(width, height, dpr);
      }
      return bufferRef.current;
    },
    []
  );

  return {
    bufferRef,
    isSupported,
    getOrCreateBuffer,
  };
}
