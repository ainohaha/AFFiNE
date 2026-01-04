import { Service } from '@toeverything/infra';

import type { DocLinksService } from '../../doc-link';
import type { DocsSearchService } from '../../docs-search';
import type { OrganizeService } from '../../organize';
import { GraphData } from '../entities/graph-data.js';

export class GraphVisualizerService extends Service {
  graphData: GraphData;

  constructor(
    private readonly docLinksService: DocLinksService,
    private readonly docsSearchService: DocsSearchService,
    private readonly organizeService: OrganizeService
  ) {
    super();
    this.graphData = this.framework.createEntity(GraphData, [
      docLinksService,
      docsSearchService,
      organizeService,
    ]);
  }

  /**
   * Get graph data for the entire workspace
   */
  getWorkspaceGraph() {
    return this.graphData.graphData$;
  }

  /**
   * Get local graph for a specific document (showing connected nodes)
   */
  async getLocalGraph(docId: string, depth: number = 1) {
    const fullGraph = await this.graphData.graphData$.value;
    const localNodes = new Map();
    const localLinks = [];

    // Start with the target document
    const startNode = fullGraph.nodes.get(docId);
    if (!startNode) return { nodes: localNodes, links: localLinks };

    localNodes.set(docId, startNode);

    // BFS to find connected nodes up to specified depth
    const visited = new Set([docId]);
    const queue: Array<{ id: string; depth: number }> = [
      { id: docId, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= depth) continue;

      // Find connected nodes
      for (const link of fullGraph.links) {
        let connectedId: string | null = null;

        if (link.source === current.id) {
          connectedId = link.target;
        } else if (link.target === current.id) {
          connectedId = link.source;
        }

        if (connectedId && !visited.has(connectedId)) {
          visited.add(connectedId);
          const connectedNode = fullGraph.nodes.get(connectedId);
          if (connectedNode) {
            localNodes.set(connectedId, connectedNode);
            queue.push({ id: connectedId, depth: current.depth + 1 });
          }
        }
      }
    }

    // Add links between local nodes
    for (const link of fullGraph.links) {
      if (localNodes.has(link.source) && localNodes.has(link.target)) {
        localLinks.push(link);
      }
    }

    return { nodes: localNodes, links: localLinks };
  }
}
