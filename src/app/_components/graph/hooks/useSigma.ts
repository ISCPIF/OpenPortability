'use client';

import { useState, useRef, useCallback } from 'react';
import { GraphData, GraphNode } from '../types';

export function useSigma() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [sigmaReady, setSigmaReady] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaInstance = useRef<any>(null);
  const initializingRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    if (sigmaInstance.current) {
      try {
        sigmaInstance.current.kill();
      } catch (e) {
        console.warn('Error cleaning up sigma:', e);
      }
      sigmaInstance.current = null;
    }
    setSigmaReady(false);
    initializingRef.current = false;
  }, []);

  return {
    selectedNode,
    setSelectedNode,
    sigmaReady,
    setSigmaReady,
    containerRef,
    sigmaInstance,
    initializingRef,
    cleanup
  };
}