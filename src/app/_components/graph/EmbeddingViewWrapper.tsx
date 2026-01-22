
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

interface Label {
  x: number;
  y: number;
  text: string;
  priority?: number;
  level?: number;
}

type EmbeddingVariant = 'standard' | 'mosaic';

// ViewportState type from embedding-atlas
interface ViewportState {
  x: number;
  y: number;
  scale: number; // zoom level (embedding-atlas uses 'scale' not 'k')
}

// Viewport limits - prevent user from zooming/panning too far
const MIN_SCALE = 0.01; // Minimum zoom level (zoomed out)
const MAX_SCALE = 60;   // Maximum zoom level (zoomed in)
const MIN_X = -50;      // Minimum x coordinate (left boundary)
const MAX_X = 50;       // Maximum x coordinate (right boundary)
const MIN_Y = -50;      // Minimum y coordinate (top boundary)
const MAX_Y = 50;       // Maximum y coordinate (bottom boundary)

interface EmbeddingViewWrapperProps {
  data: any;
  width: number;
  height: number;
  categoryColors: string[];
  labels?: Label[] | null;
  tooltip?: any;
  selection?: any;
  rangeSelection?: any; // Rectangle or Point[] for lasso selection
  onTooltip?: (data: any) => void;
  onSelection?: (data: any) => void;
  onRangeSelection?: (data: any) => void; // Callback for lasso/rectangle selection
  querySelection?: (x: number, y: number, unitDistance: number) => Promise<any>;
  customTooltip?: any; // Optional - can cause WeakMap errors
  config?: any;
  theme?: any;
  variant?: EmbeddingVariant;
  onReady?: () => void; // Callback when graph is fully rendered
  selectionLocked?: boolean; // If true, selection cannot be changed by user clicks
  userLabel?: { x: number; y: number; text: string }; // Static label for user position (e.g., "You are here")
  viewportState?: ViewportState | null; // Viewport state (zoom/pan position)
  onViewportState?: (state: ViewportState) => void; // Callback when viewport changes
}

export function EmbeddingViewWrapper(props: EmbeddingViewWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [embeddingModule, setEmbeddingModule] = useState<{ EmbeddingView?: any; EmbeddingViewMosaic?: any } | null>(null);

  // Store callbacks in refs to avoid recreating the view when callbacks change
  const onRangeSelectionRef = useRef(props.onRangeSelection);
  const onSelectionRef = useRef(props.onSelection);
  const onViewportStateRef = useRef(props.onViewportState);
  onRangeSelectionRef.current = props.onRangeSelection;
  onSelectionRef.current = props.onSelection;
  onViewportStateRef.current = props.onViewportState;

  // Ref to track programmatic viewport changes (to avoid re-applying user changes)
  const lastAppliedViewportRef = useRef<string | null>(null);
  
  // Track if view has been created with data (to trigger initial creation but not recreate on data changes)
  const hasCreatedWithDataRef = useRef(false);

  // Simple viewport state passthrough - no clamping, let embedding-atlas handle its own limits
  // This avoids infinite loops and FPS drops from fighting with the library
  const handleViewportStateSimple = useCallback((state: ViewportState) => {
    onViewportStateRef.current?.(state);
  }, []);

  const variant: EmbeddingVariant = props.variant ?? 'standard';

  // Load embedding-atlas once
  useEffect(() => {
    let mounted = true;
    import('embedding-atlas')
      .then((mod) => {
        if (mounted) {
          setEmbeddingModule({
            EmbeddingView: mod.EmbeddingView,
            EmbeddingViewMosaic: mod.EmbeddingViewMosaic,
          });
        }
      })
      .catch((err) => {
        console.error('🏷️ [Wrapper] Failed to initialize embedding-atlas:', err);
        if (mounted) {
          setError('Impossible de charger le module de visualisation: ' + (err as Error).message);
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const SelectedEmbeddingClass = useMemo(() => {
    if (!embeddingModule) {
      return null;
    }
    if (variant === 'mosaic' && embeddingModule.EmbeddingViewMosaic) {
      return embeddingModule.EmbeddingViewMosaic;
    }
    if (variant === 'mosaic' && !embeddingModule.EmbeddingViewMosaic) {
      console.warn('🏷️ [Wrapper] EmbeddingMosaicView not available, falling back to EmbeddingView');
    }
    return embeddingModule.EmbeddingView;
  }, [embeddingModule, variant]);

  // Create / recreate the view when structural props change
  // IMPORTANT: We only create the view once when data is first available
  // Subsequent data changes (e.g., tile nodes added) use update() to preserve viewport
  useEffect(() => {
    if (!SelectedEmbeddingClass || !containerRef.current || !props.data?.x?.length) {
      return;
    }
    
    // Skip if view already exists and was created with data
    // This prevents viewport reset when tile nodes are added
    if (viewRef.current && hasCreatedWithDataRef.current) {
      return;
    }

    setIsLoading(true);
    hasCreatedWithDataRef.current = true;

    if (viewRef.current) {
      viewRef.current.destroy?.();
      viewRef.current = null;
    }
    containerRef.current.innerHTML = '';

    // Filter and validate labels to avoid WeakMap key errors
    const validLabels = props.labels?.filter((label: any) => 
      label && 
      typeof label.x === 'number' && !isNaN(label.x) && isFinite(label.x) &&
      typeof label.y === 'number' && !isNaN(label.y) && isFinite(label.y) &&
      typeof label.text === 'string' && label.text.length > 0
    );

    // Merge userLabel with existing labels (userLabel has max priority to always show)
    const labelsWithUserLabel = (() => {
      const baseLabels = validLabels && validLabels.length > 0 ? [...validLabels] : [];
      if (props.userLabel) {
        baseLabels.push({
          x: props.userLabel.x,
          y: props.userLabel.y,
          text: props.userLabel.text,
          priority: 9999, // Max priority to always display
          level: 0,
        });
      }
      return baseLabels.length > 0 ? baseLabels : undefined;
    })();
    
    // Use stable callbacks that reference the refs
    const stableOnRangeSelection = (data: any) => {
      onRangeSelectionRef.current?.(data);
    };
    
    const stableOnSelection = (data: any) => {
      onSelectionRef.current?.(data);
    };
    
    // Simple passthrough - no clamping to avoid infinite loops
    const stableOnViewportState = handleViewportStateSimple;
    
    const viewProps: any = {
      data: props.data,
      width: props.width,
      height: props.height,
      categoryColors: props.categoryColors,
      labels: labelsWithUserLabel,
      tooltip: props.tooltip,
      selection: props.selection,
      rangeSelection: props.rangeSelection,
      customTooltip: props.customTooltip,
      config: props.config,
      theme: props.theme,
      querySelection: props.querySelection,
      onTooltip: props.onTooltip,
      // When selection is locked, pass null to prevent internal selection changes
      // (requires modified embedding-atlas that respects null onSelection)
      onSelection: props.selectionLocked ? null : stableOnSelection,
      onRangeSelection: props.selectionLocked ? null : stableOnRangeSelection,
      // Viewport state for persistence
      viewportState: props.viewportState,
      onViewportState: stableOnViewportState,
      // Enable automatic labels from text column
      automaticLabels: true,
    };

    // Check for NaN values in data
    let hasNaN = false;
    if (props.data?.x) {
      for (let i = 0; i < Math.min(100, props.data.x.length); i++) {
        if (isNaN(props.data.x[i]) || isNaN(props.data.y[i])) {
          hasNaN = true;
          break;
        }
      }
    }

    const view = new SelectedEmbeddingClass(containerRef.current, viewProps);
    viewRef.current = view;
    
    // Force apply viewport state after creation if provided
    // embedding-atlas may not apply viewportState correctly on initial render
    const initialViewport = props.viewportState;
    if (initialViewport && view.update) {
      // Small delay to ensure the view is fully initialized
      setTimeout(() => {
        try {
          view.update({ viewportState: initialViewport });
        } catch (e) {
          // Ignore errors - view might not support update yet
        }
      }, 50);
    }
    
    setIsLoading(false);
    
    // Signal that graph is ready after a short delay for rendering
    if (props.onReady) {
      setTimeout(() => {
        props.onReady?.();
      }, 100);
    }

    return () => {
      view.destroy?.();
      viewRef.current = null;
      hasCreatedWithDataRef.current = false; // Reset so view can be recreated if needed
    };
  // Note: We use refs for onSelection and onRangeSelection to avoid recreating the view when callbacks change
  // selectionLocked is kept as dependency because it changes the view behavior
  // handleViewportStateSimple is stable (useCallback with empty deps)
  // IMPORTANT: Do NOT include props.data?.x?.length - data changes should use update(), not recreate the view
  // This prevents viewport reset when tile nodes are added
  }, [SelectedEmbeddingClass, props.width, props.height, props.onReady, props.theme?.backgroundColor, props.selectionLocked, handleViewportStateSimple]);
  // Update existing view when content/config props change
  // Note: We wrap in try-catch to avoid WeakMap errors from embedding-atlas
  useEffect(() => {
    if (!viewRef.current || !viewRef.current.update || !props.data?.x?.length) {
      return;
    }

    // Filter and validate labels for update too
    const validLabelsForUpdate = props.labels?.filter((label: any) => 
      label && 
      typeof label.x === 'number' && !isNaN(label.x) && isFinite(label.x) &&
      typeof label.y === 'number' && !isNaN(label.y) && isFinite(label.y) &&
      typeof label.text === 'string' && label.text.length > 0
    );

    // Merge userLabel with existing labels (same logic as in view creation)
    const labelsWithUserLabelForUpdate = (() => {
      const baseLabels = validLabelsForUpdate && validLabelsForUpdate.length > 0 ? [...validLabelsForUpdate] : [];
      if (props.userLabel) {
        baseLabels.push({
          x: props.userLabel.x,
          y: props.userLabel.y,
          text: props.userLabel.text,
          priority: 9999, // Max priority to always display
          level: 0,
        });
      }
      return baseLabels.length > 0 ? baseLabels : undefined;
    })();
    
    try {
      viewRef.current.update({
        data: props.data,
        labels: labelsWithUserLabelForUpdate,  // <-- Changed from validLabelsForUpdate
        categoryColors: props.categoryColors,
        tooltip: props.tooltip,
        selection: props.selection,
        rangeSelection: props.rangeSelection,
        customTooltip: props.customTooltip,
        config: props.config,
        theme: props.theme,
        querySelection: props.querySelection,
        onTooltip: props.onTooltip,
        // When selection is locked, pass null to prevent internal selection changes
        // (requires modified embedding-atlas that respects null onSelection)
        onSelection: props.selectionLocked ? null : props.onSelection,
        onRangeSelection: props.selectionLocked ? null : props.onRangeSelection,
        // Don't include viewportState here - it's managed in a separate effect
      });
    } catch (err) {
      // Ignore WeakMap errors from embedding-atlas internal state
      console.warn('🏷️ [Wrapper] Update error (ignored):', err);
    }
  }, [
    props.data,
    props.labels,
    props.userLabel,
    props.categoryColors,
    // Don't include props.tooltip - it changes on every mouse move and embedding-atlas handles it internally
    props.selection,
    props.rangeSelection,
    props.customTooltip,
    props.config,
    props.theme,
    // Don't include onSelection, onRangeSelection - they use refs to avoid recreating the view
    // selectionLocked is kept because it changes the view behavior
    props.selectionLocked,
    // Don't include props.querySelection, props.onTooltip - they are stable callbacks
  ]);

  // Update viewport state when it changes programmatically (e.g., centering on a search result)
  // Only apply if this is a NEW viewport state (not one we already applied)
  useEffect(() => {
    if (!viewRef.current || !viewRef.current.update || !props.viewportState) {
      return;
    }
    
    // Create a key to identify this viewport state
    const viewportKey = `${props.viewportState.x.toFixed(4)}_${props.viewportState.y.toFixed(4)}_${props.viewportState.scale.toFixed(4)}`;
    
    // Only apply if this is a new programmatic change (not a re-render with same values)
    if (lastAppliedViewportRef.current === viewportKey) {
      return;
    }
    
    lastAppliedViewportRef.current = viewportKey;
    
    try {
      viewRef.current.update({
        viewportState: props.viewportState,
      });
    } catch (err) {
      console.warn('🔍 [EmbeddingWrapper] Viewport update error:', err);
    }
  }, [props.viewportState?.x, props.viewportState?.y, props.viewportState?.scale]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent">
        <div className="text-red-400 text-center">
          <p className="font-mono">{error}</p>
        </div>
      </div>
    );
  }

  // Ne pas rendre le container tant que le module n'est pas chargé
  // Cela évite de créer un canvas WebGL avec fond noir pendant le chargement
  if (!embeddingModule || !props.data?.x?.length) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#1d4ed8] font-mono tracking-wider text-sm">Initialisation du graphe...</p>
        </div>
      </div>
    );
  }

  // Le container est rendu uniquement quand tout est prêt
  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
