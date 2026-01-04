import type { GraphData, GraphNode, GraphViewState } from './types.js';

export class GraphRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2d context');
    }
    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
  }

  /**
   * Resize canvas to match display size
   */
  resize(width: number, height: number): void {
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(this.dpr, this.dpr);
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;
    this.ctx.clearRect(0, 0, width, height);
  }

  /**
   * Render the graph
   */
  render(graphData: GraphData, viewState: GraphViewState): void {
    this.clear();

    const { nodes, links } = graphData;
    const { offsetX, offsetY, scale, hoveredNodeId, selectedNodeId } =
      viewState;

    this.ctx.save();

    // Apply view transform
    this.ctx.translate(offsetX, offsetY);
    this.ctx.scale(scale, scale);

    // Draw links first (so they appear behind nodes)
    this.drawLinks(graphData, viewState);

    // Draw nodes
    this.drawNodes(nodes, hoveredNodeId, selectedNodeId);

    // Draw labels if enabled
    if (viewState.nodeLabels) {
      this.drawLabels(nodes, hoveredNodeId, selectedNodeId);
    }

    this.ctx.restore();
  }

  /**
   * Draw all links
   */
  private drawLinks(graphData: GraphData, viewState: GraphViewState): void {
    const { nodes, links } = graphData;
    const { hoveredNodeId, selectedNodeId } = viewState;

    for (const link of links) {
      const source = nodes.get(link.source);
      const target = nodes.get(link.target);

      if (!source || !target) continue;

      // Highlight links connected to hovered/selected node
      const isHighlighted =
        hoveredNodeId === link.source ||
        hoveredNodeId === link.target ||
        selectedNodeId === link.source ||
        selectedNodeId === link.target;

      this.ctx.beginPath();
      this.ctx.moveTo(source.x, source.y);
      this.ctx.lineTo(target.x, target.y);

      // Style based on link type and highlight state
      if (isHighlighted) {
        this.ctx.strokeStyle = 'var(--affine-primary-color, #1e96eb)';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = 0.8;
      } else {
        this.ctx.strokeStyle = 'var(--affine-border-color, #e3e2e4)';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.4;
      }

      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    }
  }

  /**
   * Draw all nodes
   */
  private drawNodes(
    nodes: Map<string, GraphNode>,
    hoveredNodeId: string | null,
    selectedNodeId: string | null
  ): void {
    for (const node of nodes.values()) {
      const isHovered = node.id === hoveredNodeId;
      const isSelected = node.id === selectedNodeId;

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

      // Fill color based on node type
      this.ctx.fillStyle = this.getNodeColor(node, isHovered, isSelected);
      this.ctx.fill();

      // Border
      if (isSelected) {
        this.ctx.strokeStyle = 'var(--affine-primary-color, #1e96eb)';
        this.ctx.lineWidth = 3;
      } else if (isHovered) {
        this.ctx.strokeStyle = 'var(--affine-primary-color, #1e96eb)';
        this.ctx.lineWidth = 2;
      } else {
        this.ctx.strokeStyle = 'var(--affine-border-color, #e3e2e4)';
        this.ctx.lineWidth = 1;
      }
      this.ctx.stroke();
    }
  }

  /**
   * Draw node labels
   */
  private drawLabels(
    nodes: Map<string, GraphNode>,
    hoveredNodeId: string | null,
    selectedNodeId: string | null
  ): void {
    this.ctx.font = '12px var(--affine-font-family, sans-serif)';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for (const node of nodes.values()) {
      const isHovered = node.id === hoveredNodeId;
      const isSelected = node.id === selectedNodeId;

      // Only show labels for hovered/selected nodes, or if they're large enough
      if (!isHovered && !isSelected && node.radius < 8) {
        continue;
      }

      const labelY = node.y + node.radius + 12;

      // Draw label background
      const metrics = this.ctx.measureText(node.title);
      const padding = 4;
      const bgWidth = metrics.width + padding * 2;
      const bgHeight = 16;

      this.ctx.fillStyle = 'var(--affine-background-primary-color, #fff)';
      this.ctx.globalAlpha = 0.9;
      this.ctx.fillRect(
        node.x - bgWidth / 2,
        labelY - bgHeight / 2,
        bgWidth,
        bgHeight
      );
      this.ctx.globalAlpha = 1;

      // Draw label text
      this.ctx.fillStyle = 'var(--affine-text-primary-color, #000)';
      this.ctx.fillText(node.title, node.x, labelY);
    }
  }

  /**
   * Get node color based on type and state
   */
  private getNodeColor(
    node: GraphNode,
    isHovered: boolean,
    isSelected: boolean
  ): string {
    if (isSelected) {
      return 'var(--affine-primary-color, #1e96eb)';
    }

    if (isHovered) {
      return 'var(--affine-primary-color-alpha, rgba(30, 150, 235, 0.7))';
    }

    // Color based on node type
    switch (node.type) {
      case 'doc':
        return 'var(--affine-text-primary-color, #8e8d91)';
      case 'folder':
        return 'var(--affine-tag-yellow, #ffc107)';
      case 'collection':
        return 'var(--affine-tag-purple, #9c27b0)';
      case 'tag':
        return 'var(--affine-tag-green, #4caf50)';
      default:
        return 'var(--affine-icon-secondary, #8e8d91)';
    }
  }

  /**
   * Convert screen coordinates to graph coordinates
   */
  screenToGraph(
    screenX: number,
    screenY: number,
    viewState: GraphViewState
  ): { x: number; y: number } {
    const { offsetX, offsetY, scale } = viewState;
    return {
      x: (screenX - offsetX) / scale,
      y: (screenY - offsetY) / scale,
    };
  }

  /**
   * Find node at screen position
   */
  findNodeAtPosition(
    screenX: number,
    screenY: number,
    graphData: GraphData,
    viewState: GraphViewState
  ): GraphNode | null {
    const graphPos = this.screenToGraph(screenX, screenY, viewState);

    for (const node of graphData.nodes.values()) {
      const dx = node.x - graphPos.x;
      const dy = node.y - graphPos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= node.radius * node.radius) {
        return node;
      }
    }

    return null;
  }
}
