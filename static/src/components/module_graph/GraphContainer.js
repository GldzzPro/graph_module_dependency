/** @odoo-module */
import { Component, useRef, onMounted, onWillStart } from "@odoo/owl";
import { loadJS, loadCSS } from "@web/core/assets";

const DEFAULT_NETWORK_OPTIONS = {
  edges: {
    arrows: "to",
  },
  nodes: {
    margin: 10,
    shape: "image",
    size: 20,
    font: {
      size: 12,
      face: "Arial",
      multi: "html",
    },
  },
};

export class GraphContainer extends Component {
  static template = "graph_module_dependency.GraphContainer";

  static props = {
    initialNodes: {
      type: Array,
      optional: true,
      default: () => [],
    },
    initialEdges: {
      type: Array,
      optional: true,
      default: () => [],
    },
    networkOptions: {
      type: Object,
      optional: true,
      default: () => DEFAULT_NETWORK_OPTIONS,
    },
    onGraphUpdate: {
      type: Function,
    },
    onGraphClear: {
      type: Function,
    },
  };

  setup() {
    this.graphNodes = null;
    this.graphEdges = null;
    this.network = null;
    this.containerRef = useRef("graphContainer");
    onWillStart(async () => {
      // Load vis.js library
      await loadJS(
        "https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.js"
      );
      await loadCSS(
        "https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.css"
      );
    });
    onMounted(() => {
      this.initGraphNetwork();
    });
  }

  initGraphNetwork() {
    if (this.containerRef.el) {
      // Initialize vis.js datasets with initial props (or empty arrays if not provided)
      this.graphNodes = new vis.DataSet(this.props.initialNodes || []);
      this.graphEdges = new vis.DataSet(this.props.initialEdges || []);
      // Initialize the network with custom node rendering
      this.network = new vis.Network(
        this.containerRef.el,
        {
          nodes: this.graphNodes,
          edges: this.graphEdges,
        },
        this.props.networkOptions
      );
      console.log({ network: this.network });
      // Set up network event handlers
      this.setupNetworkEvents();
    }
  }
  /**
   * Public API: Update the graph with new nodes and edges.
   * @param {Object} param0 - The object containing new nodes and edges.
   */
  onUpdateGraph({ nodes, edges }) {
    if (this.graphNodes && nodes) {
      this.graphNodes.update(nodes);
    }
    if (this.graphEdges && edges) {
      this.graphEdges.update(edges);
    }
    
  }
  /**
   * Public API: Clear the entire graph (nodes and edges).
   */
  onGraphClear() {
    if (this.graphNodes) {
      this.graphNodes.clear();
    }
    if (this.graphEdges) {
      this.graphEdges.clear();
    }
  }
  /**
   * Set up event handlers for the vis.js network
   */
  setupNetworkEvents() {
    // Double-click to show module information
    this.network.on("doubleClick", (params) => {
      const moduleId = params.nodes[0];
      if (moduleId) {
        this.showModuleInfo(moduleId);
      }
    });
    // Right-click to remove a node from the graph
    this.network.on("oncontext", (params) => {
      params.event.preventDefault();
      params.event.stopPropagation();

      const nodeId = params.nodes[0];
      if (nodeId) {
        this.graphNodes.remove(nodeId);
        this.state.selectedModules.delete(nodeId);
      }
    });
  }

  /**
   * Public API: Remove a specific module (node) and its connected edges.
   * The child encapsulates the removal logic, so the parent only needs
   * to provide the module ID.
   *
   * @param {string|number} moduleId - The identifier of the module to remove.
   */
  removeModule(moduleId) {
    // Remove the node if it exists.
    if (this.graphNodes && this.graphNodes._data[moduleId]) {
      this.graphNodes.remove(moduleId);
    }
    // Remove any edges connected to this module.
    if (this.graphEdges) {
      const edgesToRemove = Object.values(this.graphEdges._data)
        .filter((e) => e.from === moduleId || e.to === moduleId)
        .map((e) => e.id);
      if (edgesToRemove.length) {
        this.graphEdges.remove(edgesToRemove);
      }
    }
  }
}

export default GraphContainer;
