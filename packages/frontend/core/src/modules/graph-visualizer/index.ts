import type { Framework } from '@toeverything/infra';

import { WorkspaceScope } from '../workspace';
import { GraphData } from './entities/graph-data';
import { GraphVisualizerService } from './services/graph-visualizer';

export { GraphVisualizerService } from './services/graph-visualizer';
export type { GraphDataResult, GraphNode, GraphLink } from './entities/graph-data';

export function configureGraphVisualizerModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(GraphVisualizerService)
    .entity(GraphData);
}
