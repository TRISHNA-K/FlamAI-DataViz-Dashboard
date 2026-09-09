'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface UseVirtualizationOptions {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

interface VirtualItem {
  index: number;
  offsetTop: number;
}

export function useVirtualization({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 6,
}: UseVirtualizationOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      setScrollTop(target.scrollTop);
      rafIdRef.current = null;
    });
  }, []);

  // Cancel any pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const totalHeight = itemCount * itemHeight;

  const { startIndex, endIndex, virtualItems, topPadding, bottomPadding } = useMemo(() => {
    if (itemCount === 0 || containerHeight === 0) {
      return {
        startIndex: 0,
        endIndex: 0,
        virtualItems: [],
        topPadding: 0,
        bottomPadding: 0,
      };
    }

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(itemCount - 1, start + visibleCount + overscan * 2);

    const items: VirtualItem[] = [];
    for (let i = start; i <= end; i++) {
      items.push({
        index: i,
        offsetTop: i * itemHeight,
      });
    }

    const top = start * itemHeight;
    const bottom = Math.max(0, (itemCount - 1 - end) * itemHeight);

    return {
      startIndex: start,
      endIndex: end,
      virtualItems: items,
      topPadding: top,
      bottomPadding: bottom,
    };
  }, [itemCount, itemHeight, containerHeight, scrollTop, overscan]);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      if (containerRef.current) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    },
    [itemHeight]
  );

  return {
    containerRef,
    onScroll,
    virtualItems,
    startIndex,
    endIndex,
    totalHeight,
    topPadding,
    bottomPadding,
    scrollToBottom,
    scrollToTop,
    scrollToIndex,
  };
}
