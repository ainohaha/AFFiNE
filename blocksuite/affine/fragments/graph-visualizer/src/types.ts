export interface GraphNode {
  id: string;
  title: string;
  type: 'doc' | 'folder' | 'collection' | 'tag';
  // Position in graph
  x: number;
  y: number;
  // Velocity for physics simulation
  vx: number;
  vy: number;
  // Visual properties
  radius: number;
  color: string;
  // Link counts for sizing
  linkCount: number;
}

export interface GraphLink {
  source: string; // node id
  target: string; // node id
  type: 'backlink' | 'folder' | 'collection';
  strength: number;
}

export interface GraphData {
  nodes: Map<string, GraphNode>;
  links: GraphLink[];
}

export interface GraphViewState {
  // View transform
  offsetX: number;
  offsetY: number;
  scale: number;

  // Interaction state
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  draggingNodeId: string | null;

  // Filter state
  showOrphans: boolean;
  showFolders: boolean;
  showCollections: boolean;
  searchQuery: string;

  // Display options
  nodeLabels: boolean;
  linkLabels: boolean;
}

export interface GraphLayoutConfig {
  repulsionStrength: number;
  attractionStrength: number;
  centerStrength: number;
  damping: number;
  iterations: number;
}
