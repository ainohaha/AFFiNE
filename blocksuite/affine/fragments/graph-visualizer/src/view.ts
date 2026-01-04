import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine-ext-loader';

import { effects } from './effects.js';

export class GraphVisualizerViewExtension extends ViewExtensionProvider {
  override name = 'affine-graph-visualizer-fragment';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    // Register any view-specific extensions here if needed
  }
}
