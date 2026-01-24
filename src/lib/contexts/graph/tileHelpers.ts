/**
 * Tile calculation helpers for spatial indexing
 * Similar to Google Maps / OpenStreetMap tile system
 */

import { BoundingBox } from '@/lib/types/graph';
import { TileKey, TileZoomLevel, TileSystemConfig, DEFAULT_TILE_SYSTEM_CONFIG } from './types';

// ============================================
// Scale to Zoom Level Conversion
// ============================================

/**
 * Convert embedding-atlas scale to tile zoom level
 * 
 * Scale ranges (embedding-atlas):
 * - 0.02-0.05 = zoomed OUT (see whole graph) → level 0
 * - 0.05-0.10 → level 1
 * - 0.10-0.20 → level 2
 * - 0.20-0.40 → level 3
 * - 0.40-0.80 → level 4
 * - 0.80+     → level 5 (max detail)
 */
export function scaleToZoomLevel(
  scale: number, 
  config: TileSystemConfig = DEFAULT_TILE_SYSTEM_CONFIG
): TileZoomLevel {
  if (scale < config.MIN_SCALE) return 0;
  if (scale >= config.MAX_SCALE) return (config.LEVELS - 1) as TileZoomLevel;
  
  // Logarithmic mapping: each level doubles the scale threshold
  const normalizedScale = scale / config.MIN_SCALE;
  const level = Math.floor(Math.log2(normalizedScale));
  
  return Math.min(level, config.LEVELS - 1) as TileZoomLevel;
}

/**
 * Get the scale threshold for a given zoom level
 */
export function zoomLevelToMinScale(
  level: TileZoomLevel,
  config: TileSystemConfig = DEFAULT_TILE_SYSTEM_CONFIG
): number {
  return config.MIN_SCALE * Math.pow(2, level);
}

// ============================================
// Tile Key Calculation
// ============================================

/**
 * Calculate tile key from coordinates and zoom level
 * 
 * @param x - X coordinate (typically in range [-100, 100])
 * @param y - Y coordinate (typically in range [-100, 100])
 * @param zoomLevel - Tile zoom level (0-5)
 * @param config - Tile system configuration
 * @returns Tile key in format "z{level}_x{tileX}_y{tileY}"
 */
export function getTileKey(
  x: number,
  y: number,
  zoomLevel: TileZoomLevel,
  config: TileSystemConfig = DEFAULT_TILE_SYSTEM_CONFIG
): TileKey {
  const halfRange = config.COORD_RANGE / 2;
  
  // Normalize coordinates to [0, 1]
  const nx = (x + halfRange) / config.COORD_RANGE;
  const ny = (y + halfRange) / config.COORD_RANGE;
  
  // Clamp to valid range
  const clampedNx = Math.max(0, Math.min(1 - 1e-10, nx));
  const clampedNy = Math.max(0, Math.min(1 - 1e-10, ny));
  
  // Number of tiles per axis at this zoom level: 2^zoomLevel
  const tilesPerAxis = Math.pow(2, zoomLevel);
  
  // Calculate tile indices
  const tileX = Math.floor(clampedNx * tilesPerAxis);
  const tileY = Math.floor(clampedNy * tilesPerAxis);
  
  return `z${zoomLevel}_x${tileX}_y${tileY}`;
}

/**
 * Parse a tile key back to its components
 */
export function parseTileKey(tileKey: TileKey): { zoomLevel: number; tileX: number; tileY: number } | null {
  const match = tileKey.match(/^z(\d+)_x(\d+)_y(\d+)$/);
  if (!match) return null;
  
  return {
    zoomLevel: parseInt(match[1], 10),
    tileX: parseInt(match[2], 10),
    tileY: parseInt(match[3], 10),
  };
}

// ============================================
// Tile Bounds Calculation
// ============================================

/**
 * Get the bounding box for a tile
 */
export function getTileBounds(
  tileKey: TileKey,
  config: TileSystemConfig = DEFAULT_TILE_SYSTEM_CONFIG
): BoundingBox | null {
  const parsed = parseTileKey(tileKey);
  if (!parsed) return null;
  
  const { zoomLevel, tileX, tileY } = parsed;
  const halfRange = config.COORD_RANGE / 2;
  const tilesPerAxis = Math.pow(2, zoomLevel);
  const tileSize = config.COORD_RANGE / tilesPerAxis;
  
  return {
    minX: tileX * tileSize - halfRange,
    maxX: (tileX + 1) * tileSize - halfRange,
    minY: tileY * tileSize - halfRange,
    maxY: (tileY + 1) * tileSize - halfRange,
  };
}

/**
 * Get tile bounds from components (faster than parsing key)
 */
export function getTileBoundsFromComponents(
  zoomLevel: number,
  tileX: number,
  tileY: number,
  config: TileSystemConfig = DEFAULT_TILE_SYSTEM_CONFIG
): BoundingBox {
  const halfRange = config.COORD_RANGE / 2;
  const tilesPerAxis = Math.pow(2, zoomLevel);
  const tileSize = config.COORD_RANGE / tilesPerAxis;
  
  return {
    minX: tileX * tileSize - halfRange,
    maxX: (tileX + 1) * tileSize - halfRange,
    minY: tileY * tileSize - halfRange,
    maxY: (tileY + 1) * tileSize - halfRange,
  };
}

// ============================================
// Visible Tiles Calculation
// ============================================

/**
 * Get all tile keys that are visible in a bounding box at a given zoom level
 * 
 * @param bbox - Viewport bounding box
 * @param zoomLevel - Current tile zoom level
 * @param config - Tile system configuration
 * @returns Array of tile keys that intersect with the bbox
 */
export function getVisibleTileKeys(
  bbox: BoundingBox,
  zoomLevel: TileZoomLevel,
  config: TileSystemConfig = DEFAULT_TILE_SYSTEM_CONFIG
): TileKey[] {
  const halfRange = config.COORD_RANGE / 2;
  const tilesPerAxis = Math.pow(2, zoomLevel);
  
  // Normalize bbox to [0, 1] range
  const minNx = Math.max(0, (bbox.minX + halfRange) / config.COORD_RANGE);
  const maxNx = Math.min(1, (bbox.maxX + halfRange) / config.COORD_RANGE);
  const minNy = Math.max(0, (bbox.minY + halfRange) / config.COORD_RANGE);
  const maxNy = Math.min(1, (bbox.maxY + halfRange) / config.COORD_RANGE);
  
  // Calculate tile index ranges
  const minTileX = Math.floor(minNx * tilesPerAxis);
  const maxTileX = Math.min(tilesPerAxis - 1, Math.floor(maxNx * tilesPerAxis));
  const minTileY = Math.floor(minNy * tilesPerAxis);
  const maxTileY = Math.min(tilesPerAxis - 1, Math.floor(maxNy * tilesPerAxis));
  
  // Generate all tile keys in the range
  const tileKeys: TileKey[] = [];
  
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      tileKeys.push(`z${zoomLevel}_x${tx}_y${ty}`);
    }
  }
  
  return tileKeys;
}

/**
 * Get the total number of tiles at a zoom level
 */
export function getTileCount(zoomLevel: TileZoomLevel): number {
  const tilesPerAxis = Math.pow(2, zoomLevel);
  return tilesPerAxis * tilesPerAxis;
}

/**
 * Get all tile keys at a zoom level
 */
export function getAllTileKeys(zoomLevel: TileZoomLevel): TileKey[] {
  const tilesPerAxis = Math.pow(2, zoomLevel);
  const keys: TileKey[] = [];
  
  for (let tx = 0; tx < tilesPerAxis; tx++) {
    for (let ty = 0; ty < tilesPerAxis; ty++) {
      keys.push(`z${zoomLevel}_x${tx}_y${ty}`);
    }
  }
  
  return keys;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if a point is inside a bounding box
 */
export function isPointInBbox(x: number, y: number, bbox: BoundingBox): boolean {
  return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY;
}

/**
 * Check if two bounding boxes intersect
 */
export function bboxIntersects(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/**
 * Expand a bounding box by a factor (for prefetching adjacent tiles)
 */
export function expandBbox(bbox: BoundingBox, factor: number): BoundingBox {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const expandX = width * (factor - 1) / 2;
  const expandY = height * (factor - 1) / 2;
  
  return {
    minX: bbox.minX - expandX,
    maxX: bbox.maxX + expandX,
    minY: bbox.minY - expandY,
    maxY: bbox.maxY + expandY,
  };
}
