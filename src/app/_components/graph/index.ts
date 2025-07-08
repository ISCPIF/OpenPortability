// Main component
export { default as ConnectionGraph } from './ConnectionGraph';

// Sub-components
export { default as GraphControls } from './GraphControls';
export { default as AdvancedControls } from './AdvancedControls';
export { default as NodeDetails } from './NodeDetails';
export { default as GraphLegend } from './GraphLegend';

// Loading states
export { 
  LoadingSpinner, 
  ErrorDisplay, 
  EmptyState, 
  AuthRequired 
} from './LoadingStates';

// Hooks
export { useGraphData } from './hooks/useGraphData';
export { useSigma } from './hooks/useSigma';
export { useGraphSettings } from './hooks/useGraphSettings';

// Utils
export {
  detectCommunities,
  applyForceLayout,
  createInterConnections,
  processGraphData,
  setupSigmaPolyfill
} from './utils/graphUtils';

// Types
export type {
  GraphNode,
  GraphEdge,
  GraphMetadata,
  GraphData,
  ConnectionType,
  LayoutType,
  GraphMode
} from './types';

// Constants
export { 
  COMMUNITY_COLORS, 
  NODE_COLORS, 
  EDGE_COLORS 
} from './constants';