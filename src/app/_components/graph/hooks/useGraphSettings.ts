'use client';

import { useState } from 'react';
import { ConnectionType, LayoutType, GraphMode } from '../types';

export function useGraphSettings() {
  const [connectionType, setConnectionType] = useState<ConnectionType>('both');
  const [limit, setLimit] = useState<number>(100);
  const [layoutType, setLayoutType] = useState<LayoutType>('community');
  const [showOnlyConnections, setShowOnlyConnections] = useState<boolean>(true);
  const [minConnections, setMinConnections] = useState<number>(2);
  const [hideUserNode, setHideUserNode] = useState<boolean>(false);
  const [graphMode, setGraphMode] = useState<GraphMode>('anonymous');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleTypeChange = (type: ConnectionType) => {
    setConnectionType(type);
  };
  
  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
  };

  return {
    connectionType,
    limit,
    layoutType,
    showOnlyConnections,
    minConnections,
    hideUserNode,
    graphMode,
    isTransitioning,
    setConnectionType,
    setLimit,
    setLayoutType,
    setShowOnlyConnections,
    setMinConnections,
    setHideUserNode,
    setGraphMode,
    setIsTransitioning,
    handleTypeChange,
    handleLimitChange
  };
}