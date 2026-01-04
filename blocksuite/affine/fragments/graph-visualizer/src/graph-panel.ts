import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
import type { EditorHost } from '@blocksuite/std';
import { css, html } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import type { GraphData, GraphNode, GraphViewState } from './types.js';
import { ForceDirectedLayout } from './layout.js';
import { GraphRenderer } from './renderer.js';

export class GraphPanel extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .graph-visualizer-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--affine-background-primary-color);
      border-radius: 8px;
      overflow: hidden;
    }

    .graph-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid var(--affine-border-color);
      background: var(--affine-background-secondary-color);
    }

    .graph-toolbar-button {
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid var(--affine-border-color);
      background: var(--affine-background-primary-color);
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .graph-toolbar-button:hover {
      background: var(--affine-hover-color);
    }

    .graph-toolbar-button.active {
      background: var(--affine-primary-color);
      color: white;
      border-color: var(--affine-primary-color);
    }

    .graph-search {
      flex: 1;
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid var(--affine-border-color);
      background: var(--affine-background-primary-color);
      font-size: 14px;
    }

    .graph-canvas-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    .graph-canvas {
      width: 100%;
      height: 100%;
      cursor: grab;
    }

    .graph-canvas.dragging {
      cursor: grabbing;
    }

    .graph-info {
      position: absolute;
      bottom: 12px;
      right: 12px;
      padding: 8px 12px;
      background: var(--affine-background-overlay-panel-color);
      border-radius: 4px;
      font-size: 12px;
      color: var(--affine-text-secondary-color);
      pointer-events: none;
    }

    .graph-loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 14px;
      color: var(--affine-text-secondary-color);
    }
  `;

  @property({ attribute: false })
  accessor editor!: EditorHost;

  @query('.graph-canvas')
  private accessor canvas!: HTMLCanvasElement;

  @state()
  private accessor graphData: GraphData = {
    nodes: new Map(),
    links: [],
  };

  @state()
  private accessor viewState: GraphViewState = {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    hoveredNodeId: null,
    selectedNodeId: null,
    draggingNodeId: null,
    showOrphans: true,
    showFolders: true,
    showCollections: true,
    searchQuery: '',
    nodeLabels: true,
    linkLabels: false,
  };

  @state()
  private accessor isLoading = false;

  private renderer?: GraphRenderer;
  private layout?: ForceDirectedLayout;
  private animationFrameId?: number;
  private lastMousePos = { x: 0, y: 0 };

  override connectedCallback(): void {
    super.connectedCallback();
    void this.buildGraphData();
  }

  override firstUpdated(): void {
    this.initializeGraph();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private initializeGraph(): void {
    if (!this.canvas) return;

    this.renderer = new GraphRenderer(this.canvas);
    this.layout = new ForceDirectedLayout();

    // Setup canvas size
    this.resizeCanvas();

    // Initialize layout
    const rect = this.canvas.getBoundingClientRect();
    this.layout.initializePositions(this.graphData.nodes, rect.width, rect.height);

    // Run initial layout simulation
    this.isLoading = true;
    this.layout.simulate(
      this.graphData,
      rect.width,
      rect.height,
      (iteration) => {
        // Update render every 10 iterations during simulation
        if (iteration % 10 === 0) {
          this.renderGraph();
        }
      }
    );
    this.isLoading = false;

    // Initial render
    this.renderGraph();

    // Setup event listeners
    this.setupEventListeners();

    // Handle window resize
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }

  private resizeCanvas(): void {
    if (!this.canvas || !this.renderer) return;

    const container = this.canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);

    // Reset view to center
    this.viewState.offsetX = rect.width / 2;
    this.viewState.offsetY = rect.height / 2;

    this.renderGraph();
  }

  private setupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), {
      passive: false,
    });
    this.canvas.addEventListener('click', this.handleClick.bind(this));
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.renderer) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = this.renderer.findNodeAtPosition(
      x,
      y,
      this.graphData,
      this.viewState
    );

    if (node) {
      this.viewState = {
        ...this.viewState,
        draggingNodeId: node.id,
      };
    }

    this.lastMousePos = { x: e.clientX, y: e.clientY };
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.renderer) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Handle node dragging
    if (this.viewState.draggingNodeId) {
      const node = this.graphData.nodes.get(this.viewState.draggingNodeId);
      if (node) {
        const graphPos = this.renderer.screenToGraph(x, y, this.viewState);
        node.x = graphPos.x;
        node.y = graphPos.y;
        node.vx = 0;
        node.vy = 0;
        this.renderGraph();
        return;
      }
    }

    // Handle view panning (no node being dragged)
    if (e.buttons === 1 && !this.viewState.draggingNodeId) {
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;

      this.viewState = {
        ...this.viewState,
        offsetX: this.viewState.offsetX + dx,
        offsetY: this.viewState.offsetY + dy,
      };

      this.renderGraph();
    }

    // Update hovered node
    const node = this.renderer.findNodeAtPosition(
      x,
      y,
      this.graphData,
      this.viewState
    );

    const newHoveredId = node ? node.id : null;
    if (newHoveredId !== this.viewState.hoveredNodeId) {
      this.viewState = {
        ...this.viewState,
        hoveredNodeId: newHoveredId,
      };
      this.renderGraph();
    }

    this.lastMousePos = { x: e.clientX, y: e.clientY };
  }

  private handleMouseUp(): void {
    this.viewState = {
      ...this.viewState,
      draggingNodeId: null,
    };
  }

  private handleMouseLeave(): void {
    this.viewState = {
      ...this.viewState,
      hoveredNodeId: null,
      draggingNodeId: null,
    };
    this.renderGraph();
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(
      0.1,
      Math.min(5, this.viewState.scale * zoomFactor)
    );

    // Zoom towards mouse position
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleRatio = newScale / this.viewState.scale;
    const newOffsetX =
      mouseX - (mouseX - this.viewState.offsetX) * scaleRatio;
    const newOffsetY =
      mouseY - (mouseY - this.viewState.offsetY) * scaleRatio;

    this.viewState = {
      ...this.viewState,
      scale: newScale,
      offsetX: newOffsetX,
      offsetY: newOffsetY,
    };

    this.renderGraph();
  }

  private handleClick(e: MouseEvent): void {
    if (!this.renderer) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = this.renderer.findNodeAtPosition(
      x,
      y,
      this.graphData,
      this.viewState
    );

    if (node) {
      this.viewState = {
        ...this.viewState,
        selectedNodeId: node.id,
      };

      // Navigate to the document/folder
      if (node.type === 'doc') {
        this.navigateToDoc(node.id);
      }

      this.renderGraph();
    }
  }

  private navigateToDoc(docId: string): void {
    // Dispatch event to navigate to document
    this.dispatchEvent(
      new CustomEvent('navigate-to-doc', {
        detail: { docId },
        bubbles: true,
        composed: true,
      })
    );
  }

  private renderGraph(): void {
    if (!this.renderer) return;
    this.renderer.render(this.graphData, this.viewState);
  }

  private async buildGraphData(): Promise<void> {
    // This will be populated by the setGraphData method from the service
    // Default to empty graph
    if (this.graphData.nodes.size === 0) {
      this.graphData = {
        nodes: new Map(),
        links: [],
      };
    }
  }

  /**
   * Set graph data from external source (e.g., GraphVisualizerService)
   */
  setGraphData(data: { nodes: Map<string, any>; links: any[] }): void {
    // Convert service data to graph node format with physics properties
    const graphNodes = new Map<string, GraphNode>();

    for (const [id, node] of data.nodes) {
      // Calculate radius based on link count
      const radius = Math.max(5, Math.min(15, 5 + node.linkCount * 0.5));

      graphNodes.set(id, {
        id,
        title: node.title,
        type: node.type,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius,
        color: this.getNodeColorForType(node.type),
        linkCount: node.linkCount,
      });
    }

    this.graphData = {
      nodes: graphNodes,
      links: data.links,
    };

    // Re-initialize layout if canvas is ready
    if (this.canvas && this.layout) {
      const rect = this.canvas.getBoundingClientRect();
      this.layout.initializePositions(this.graphData.nodes, rect.width, rect.height);
      this.layout.simulate(this.graphData, rect.width, rect.height);
      this.renderGraph();
    }

    this.requestUpdate();
  }

  private getNodeColorForType(
    type: 'doc' | 'folder' | 'collection' | 'tag'
  ): string {
    switch (type) {
      case 'doc':
        return '#8e8d91';
      case 'folder':
        return '#ffc107';
      case 'collection':
        return '#9c27b0';
      case 'tag':
        return '#4caf50';
      default:
        return '#8e8d91';
    }
  }

  private handleToggleOrphans(): void {
    this.viewState = {
      ...this.viewState,
      showOrphans: !this.viewState.showOrphans,
    };
    void this.buildGraphData();
  }

  private handleToggleFolders(): void {
    this.viewState = {
      ...this.viewState,
      showFolders: !this.viewState.showFolders,
    };
    void this.buildGraphData();
  }

  private handleToggleLabels(): void {
    this.viewState = {
      ...this.viewState,
      nodeLabels: !this.viewState.nodeLabels,
    };
    this.renderGraph();
  }

  private handleSearch(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.viewState = {
      ...this.viewState,
      searchQuery: input.value,
    };
    void this.buildGraphData();
  }

  private handleResetView(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.viewState = {
      ...this.viewState,
      offsetX: rect.width / 2,
      offsetY: rect.height / 2,
      scale: 1,
    };
    this.renderGraph();
  }

  override render() {
    const nodeCount = this.graphData.nodes.size;
    const linkCount = this.graphData.links.length;

    return html`
      <div class="graph-visualizer-container">
        <div class="graph-toolbar">
          <button
            class="graph-toolbar-button ${this.viewState.showOrphans
              ? 'active'
              : ''}"
            @click=${this.handleToggleOrphans}
          >
            Show Orphans
          </button>
          <button
            class="graph-toolbar-button ${this.viewState.showFolders
              ? 'active'
              : ''}"
            @click=${this.handleToggleFolders}
          >
            Show Folders
          </button>
          <button
            class="graph-toolbar-button ${this.viewState.nodeLabels
              ? 'active'
              : ''}"
            @click=${this.handleToggleLabels}
          >
            Show Labels
          </button>
          <input
            type="text"
            class="graph-search"
            placeholder="Search nodes..."
            @input=${this.handleSearch}
            .value=${this.viewState.searchQuery}
          />
          <button class="graph-toolbar-button" @click=${this.handleResetView}>
            Reset View
          </button>
        </div>

        <div class="graph-canvas-container">
          <canvas
            class="graph-canvas ${this.viewState.draggingNodeId
              ? 'dragging'
              : ''}"
          ></canvas>

          ${this.isLoading
            ? html`<div class="graph-loading">Building graph...</div>`
            : ''}

          <div class="graph-info">
            ${nodeCount} nodes · ${linkCount} links
          </div>
        </div>
      </div>
    `;
  }
}
