/** @odoo-module */
import { Component, useRef, onMounted, onWillStart } from "@odoo/owl";
import { loadJS, loadCSS } from "@web/core/assets";

const DEFAULT_NETWORK_OPTIONS = {
    edges: {
        arrows: 'to',
    },
    nodes: {
        margin: 10,
        shape: "image",
        size: 20,
        font: {
            size: 12,
            face: 'Arial',
            multi: 'html'
        }
    }
}

export class GraphContainer extends Component {
    static template = "graph_module_dependency.GraphContainer";

    static props = {
        graphNodes: Array,
        graphEdges: Array,
    };

    setup() {
        this.containerRef = useRef("graphContainer");
        this.network = null;
        onWillStart(async () => {
            // Load vis.js library
            await loadJS("https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.js");
            await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.css");
        });
        onMounted(() => {
            this.initGraphNetwork();
        });
    }

    initGraphNetwork() {
        if (this.containerRef.el) {
            // Initialize vis.js dataset objects
            this.graphNodes = new vis.DataSet([]);
            this.graphEdges = new vis.DataSet([]);
            // Initialize the network with custom node rendering
            this.network = new vis.Network(
                this.containerRef.el,
                {
                    nodes: this.props.graphNodes,
                    edges: this.props.graphEdges
                },
                DEFAULT_NETWORK_OPTIONS
            );
            // Set up network event handlers
            this.setupNetworkEvents();
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
}

export default GraphContainer;
