import { Entity, LiveData } from '@toeverything/infra';
import { map, switchMap } from 'rxjs';

import type { DocLinksService } from '../../doc-link';
import type { DocsSearchService } from '../../docs-search';
import type { OrganizeService } from '../../organize';

export interface GraphNode {
  id: string;
  title: string;
  type: 'doc' | 'folder' | 'collection' | 'tag';
  linkCount: number;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'backlink' | 'folder' | 'collection';
  strength: number;
}

export interface GraphDataResult {
  nodes: Map<string, GraphNode>;
  links: GraphLink[];
}

export class GraphData extends Entity {
  constructor(
    private readonly docLinksService: DocLinksService,
    private readonly docsSearchService: DocsSearchService,
    private readonly organizeService: OrganizeService
  ) {
    super();
  }

  /**
   * Build complete graph data including backlinks and folder structure
   */
  graphData$ = LiveData.computed<GraphDataResult>(get => {
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const linkCounts = new Map<string, number>();

    // First, get all documents with their links
    return this.buildFromLinks(nodes, links, linkCounts);
  });

  private async buildFromLinks(
    nodes: Map<string, GraphNode>,
    links: GraphLink[],
    linkCounts: Map<string, number>
  ): Promise<GraphDataResult> {
    try {
      // Query all blocks that have references
      const { nodes: searchNodes } =
        await this.docsSearchService.indexer.search('block', {
          type: 'exists',
          field: 'refDocId',
        }, {
          fields: ['docId', 'refDocId', 'blockId'],
          pagination: { limit: 10000 },
        });

      // Build link map and count links per document
      for (const node of searchNodes) {
        const docId = node.fields.docId;
        const refDocIds = Array.isArray(node.fields.refDocId)
          ? node.fields.refDocId
          : [node.fields.refDocId];

        for (const refDocId of refDocIds) {
          if (typeof refDocId !== 'string') continue;

          // Add link
          links.push({
            source: docId,
            target: refDocId,
            type: 'backlink',
            strength: 1,
          });

          // Update link counts
          linkCounts.set(docId, (linkCounts.get(docId) || 0) + 1);
          linkCounts.set(refDocId, (linkCounts.get(refDocId) || 0) + 1);
        }
      }

      // Get all documents and create nodes
      const allDocs = await this.docsSearchService.indexer.search('doc', {
        type: 'all',
      }, {
        fields: ['id', 'title'],
        pagination: { limit: 10000 },
      });

      for (const doc of allDocs.nodes) {
        const docId = doc.fields.id as string;
        const title = (doc.fields.title as string) || 'Untitled';

        nodes.set(docId, {
          id: docId,
          title,
          type: 'doc',
          linkCount: linkCounts.get(docId) || 0,
        });
      }

      // Add folder nodes and links
      await this.addFolderNodes(nodes, links, linkCounts);

      return { nodes, links };
    } catch (error) {
      console.error('Error building graph data:', error);
      return { nodes, links };
    }
  }

  private async addFolderNodes(
    nodes: Map<string, GraphNode>,
    links: GraphLink[],
    linkCounts: Map<string, number>
  ): Promise<void> {
    try {
      const folderTree = this.organizeService.folderTree;
      const rootFolder = folderTree.rootFolder;

      // Traverse folder tree
      const visitFolder = (folderNode: any) => {
        const folderId = folderNode.id;
        if (!folderId) return; // Skip root

        const info = folderNode.info$.value;
        if (!info) return;

        // Add folder node
        if (info.type === 'folder') {
          nodes.set(folderId, {
            id: folderId,
            title: info.data || 'Untitled Folder',
            type: 'folder',
            linkCount: 0,
          });
        }

        // Add links for children
        const children = folderNode.sortedChildren$.value || [];
        for (const child of children) {
          const childInfo = child.info$.value;
          if (!childInfo) continue;

          if (childInfo.type === 'doc') {
            // Link from folder to document
            links.push({
              source: folderId,
              target: childInfo.data, // data contains docId
              type: 'folder',
              strength: 0.5,
            });

            linkCounts.set(folderId, (linkCounts.get(folderId) || 0) + 1);
            linkCounts.set(
              childInfo.data,
              (linkCounts.get(childInfo.data) || 0) + 1
            );
          } else if (childInfo.type === 'folder') {
            // Link from parent folder to child folder
            links.push({
              source: folderId,
              target: child.id,
              type: 'folder',
              strength: 0.5,
            });

            linkCounts.set(folderId, (linkCounts.get(folderId) || 0) + 1);
            linkCounts.set(child.id, (linkCounts.get(child.id) || 0) + 1);

            // Recursively visit child folder
            visitFolder(child);
          }
        }
      };

      // Visit all top-level folders
      const rootChildren = rootFolder.sortedChildren$.value || [];
      for (const child of rootChildren) {
        visitFolder(child);
      }
    } catch (error) {
      console.error('Error adding folder nodes:', error);
    }
  }

  /**
   * Filter graph data based on query
   */
  filterNodes(
    graphData: GraphDataResult,
    options: {
      searchQuery?: string;
      showOrphans?: boolean;
      showFolders?: boolean;
      showCollections?: boolean;
      minLinkCount?: number;
    }
  ): GraphDataResult {
    const {
      searchQuery = '',
      showOrphans = true,
      showFolders = true,
      showCollections = true,
      minLinkCount = 0,
    } = options;

    const filteredNodes = new Map<string, GraphNode>();
    const filteredLinks: GraphLink[] = [];

    // Filter nodes
    for (const [id, node] of graphData.nodes) {
      // Filter by type
      if (!showFolders && node.type === 'folder') continue;
      if (!showCollections && node.type === 'collection') continue;

      // Filter by search query
      if (
        searchQuery &&
        !node.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        continue;
      }

      // Filter by link count
      if (!showOrphans && node.linkCount === 0) continue;
      if (node.linkCount < minLinkCount) continue;

      filteredNodes.set(id, node);
    }

    // Filter links (only include links where both nodes are in filtered set)
    for (const link of graphData.links) {
      if (filteredNodes.has(link.source) && filteredNodes.has(link.target)) {
        filteredLinks.push(link);
      }
    }

    return {
      nodes: filteredNodes,
      links: filteredLinks,
    };
  }
}
