import type { GraphPanel } from '@blocksuite/affine-fragment-graph-visualizer';
import type { EditorHost } from '@blocksuite/affine/std';
import { useCallback, useEffect, useRef } from 'react';

import { useService } from '@toeverything/infra';
import { GraphVisualizerService } from '@affine/core/modules/graph-visualizer';

import * as styles from './graph.css';

// A wrapper for GraphPanel
export const EditorGraphPanel = ({
  editor,
}: {
  editor: EditorHost | null;
}) => {
  const graphPanelRef = useRef<GraphPanel | null>(null);
  const graphVisualizerService = useService(GraphVisualizerService);

  const onRefChange = useCallback(
    async (container: HTMLDivElement | null) => {
      if (container && editor && container.children.length === 0) {
        // Dynamically import the GraphPanel to avoid circular dependencies
        const { GraphPanel } = await import(
          '@blocksuite/affine-fragment-graph-visualizer'
        );

        graphPanelRef.current = new GraphPanel();
        graphPanelRef.current.editor = editor;

        // Set graph data from service
        const graphData = await graphVisualizerService.getWorkspaceGraph();
        (graphPanelRef.current as any).setGraphData?.(graphData);

        container.append(graphPanelRef.current);
      }
    },
    [editor, graphVisualizerService]
  );

  useEffect(() => {
    if (editor && graphPanelRef.current) {
      graphPanelRef.current.editor = editor;
    }
  }, [editor]);

  return <div className={styles.root} ref={onRefChange} />;
};
