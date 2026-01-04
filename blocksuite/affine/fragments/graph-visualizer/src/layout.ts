import type {
  GraphData,
  GraphLayoutConfig,
  GraphLink,
  GraphNode,
} from './types.js';

export class ForceDirectedLayout {
  private config: GraphLayoutConfig;

  constructor(config: Partial<GraphLayoutConfig> = {}) {
    this.config = {
      repulsionStrength: config.repulsionStrength ?? 1000,
      attractionStrength: config.attractionStrength ?? 0.1,
      centerStrength: config.centerStrength ?? 0.01,
      damping: config.damping ?? 0.8,
      iterations: config.iterations ?? 300,
    };
  }

  /**
   * Initialize node positions randomly
   */
  initializePositions(
    nodes: Map<string, GraphNode>,
    width: number,
    height: number
  ): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 4;

    let angle = 0;
    const angleStep = (Math.PI * 2) / nodes.size;

    for (const node of nodes.values()) {
      // Arrange nodes in a circle initially
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
      node.vx = 0;
      node.vy = 0;
      angle += angleStep;
    }
  }

  /**
   * Run force-directed layout simulation
   */
  simulate(
    graphData: GraphData,
    width: number,
    height: number,
    onProgress?: (iteration: number) => void
  ): void {
    const { nodes, links } = graphData;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let iteration = 0; iteration < this.config.iterations; iteration++) {
      // Apply repulsion force between all nodes
      this.applyRepulsion(nodes);

      // Apply attraction force along links
      this.applyAttraction(nodes, links);

      // Apply centering force to keep graph centered
      this.applyCenterForce(nodes, centerX, centerY);

      // Update positions based on velocities
      this.updatePositions(nodes);

      // Report progress
      if (onProgress && iteration % 10 === 0) {
        onProgress(iteration);
      }
    }
  }

  /**
   * Apply repulsion force between all node pairs (O(n²))
   */
  private applyRepulsion(nodes: Map<string, GraphNode>): void {
    const nodeArray = Array.from(nodes.values());

    for (let i = 0; i < nodeArray.length; i++) {
      const nodeA = nodeArray[i];

      for (let j = i + 1; j < nodeArray.length; j++) {
        const nodeB = nodeArray[j];

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distSq = dx * dx + dy * dy;

        // Avoid division by zero
        if (distSq < 1) continue;

        const dist = Math.sqrt(distSq);
        const force = this.config.repulsionStrength / distSq;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        nodeA.vx -= fx;
        nodeA.vy -= fy;
        nodeB.vx += fx;
        nodeB.vy += fy;
      }
    }
  }

  /**
   * Apply attraction force along links (springs)
   */
  private applyAttraction(
    nodes: Map<string, GraphNode>,
    links: GraphLink[]
  ): void {
    for (const link of links) {
      const source = nodes.get(link.source);
      const target = nodes.get(link.target);

      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Avoid division by zero
      if (dist < 1) continue;

      const force = this.config.attractionStrength * dist * link.strength;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }
  }

  /**
   * Apply centering force to keep graph centered
   */
  private applyCenterForce(
    nodes: Map<string, GraphNode>,
    centerX: number,
    centerY: number
  ): void {
    for (const node of nodes.values()) {
      const dx = centerX - node.x;
      const dy = centerY - node.y;

      node.vx += dx * this.config.centerStrength;
      node.vy += dy * this.config.centerStrength;
    }
  }

  /**
   * Update node positions and apply damping
   */
  private updatePositions(nodes: Map<string, GraphNode>): void {
    for (const node of nodes.values()) {
      // Apply damping
      node.vx *= this.config.damping;
      node.vy *= this.config.damping;

      // Update position
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  /**
   * Run a single iteration of the simulation (for incremental updates)
   */
  tick(graphData: GraphData, width: number, height: number): void {
    const { nodes, links } = graphData;
    const centerX = width / 2;
    const centerY = height / 2;

    this.applyRepulsion(nodes);
    this.applyAttraction(nodes, links);
    this.applyCenterForce(nodes, centerX, centerY);
    this.updatePositions(nodes);
  }
}
