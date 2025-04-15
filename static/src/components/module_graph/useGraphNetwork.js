/** @odoo-module */
import { useRef, onMounted, onWillStart, onWillDestroy } from "@odoo/owl";
import { loadJS, loadCSS } from "@web/core/assets";

const DEFAULT_NETWORK_OPTIONS = {
  edges: { arrows: "to" },
  nodes: {
    margin: 10,
    shape: "image",
    size: 20,
    font: { size: 12, face: "Arial", multi: "html" },
  },
};

/**
 * Custom hook to encapsulate vis.js graph logic.
 *
 * @param {Object} options
 * @param {Array} options.initialNodes - Initial node data.
 * @param {Array} options.initialEdges - Initial edge data.
 * @param {Function} [options.onGraphReady] - Callback when the graph is initialized.
 *
 * @returns {Object} { containerRef, updateGraph, clearGraph, removeModule }
 */
export function useGraphNetwork({
  initialNodes = [],
  initialEdges = [],
  networkOptions = DEFAULT_NETWORK_OPTIONS,
  onGraphReady,
} = {}) {
  // Ref for attaching the graph container DOM element.
  const containerRef = useRef("graphContainer");

  let graphNodes = null;
  let graphEdges = null;
  let network = null;

  // Preload vis.js library and its CSS.
  onWillStart(async () => {
    await loadJS(
      "https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.js"
    );
    await loadCSS(
      "https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.css"
    );
  });

  // Initialize the vis.js network when the container is mounted.
  onMounted(() => {
    if (containerRef.el) {
      graphNodes = new vis.DataSet(initialNodes);
      graphEdges = new vis.DataSet(initialEdges);
      network = new vis.Network(
        containerRef.el,
        { nodes: graphNodes, edges: graphEdges },
        networkOptions
      );
      setupNetworkEvents();
      if (onGraphReady) {
        onGraphReady(network);
      }
    }
  });

  // Optionally remove event listeners when the component is destroyed.
  onWillDestroy(() => {
    if (network) {
      network.destroy();
    }
  });

  const updateGraph = ({ nodes, edges }) => {
    if (graphNodes && nodes) {
      graphNodes.clear();
      graphNodes.add(nodes);
    }
    if (graphEdges && edges) {
      graphEdges.clear();
      graphEdges.add(edges);
    }
  };

  const clearGraph = () => {
    if (graphNodes) graphNodes.clear();
    if (graphEdges) graphEdges.clear();
  };

  const removeModule = (moduleId) => {
    if (graphNodes && graphNodes._data[moduleId]) {
      graphNodes.remove(moduleId);
    }
    if (graphEdges) {
      const edgesToRemove = Object.values(graphEdges._data)
        .filter((e) => e.from === moduleId || e.to === moduleId)
        .map((e) => e.id);
      if (edgesToRemove.length) {
        graphEdges.remove(edgesToRemove);
      }
    }
  };

  const setupNetworkEvents = () => {
    network.on("doubleClick", (params) => {
      const moduleId = params.nodes[0];
      if (moduleId) {
        console.log("Double-clicked module:", moduleId);
      }
    });
    network.on("oncontext", (params) => {
      params.event.preventDefault();
      params.event.stopPropagation();
      const moduleId = params.nodes[0];
      if (moduleId) {
        removeModule(moduleId);
      }
    });
  };

  return {
    containerRef,
    updateGraph,
    clearGraph,
    removeModule,
  };
}
