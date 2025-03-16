/** @odoo-module */
import { Component, useRef, onMounted, useEffect } from "@odoo/owl";
import { loadJS, loadCSS } from "@web/core/assets";

export class ModulesGraphView extends Component {
    static template = "modules_graph_view_template";
    static props = {
        graphData: Object,
        onModuleInfo: Function,
        onRemoveModule: Function,
        loading: Boolean,
    };

    setup() {
        this.containerRef = useRef("graph");
        this.network = null;
        this.graphNodes = null;
        this.graphEdges = null;

        // Load vis.js libraries
        this.loadVisLibrary();

        // Initialize network on mount
        onMounted(() => {
            if (this.containerRef.el) {
                this.initializeNetwork();
            }
        });

        // Update network when graph data changes
        useEffect(
            () => this.updateNetwork(),
            () => [this.props.graphData]
        );
        debugger;
    }

    /**
     * Load the vis.js library
     */
    async loadVisLibrary() {
        try {
            await loadJS("https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.js");
            await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.css");
        } catch (error) {
            console.error("Error loading vis.js:", error);
        }
        debugger;
    }

    /**
     * Initialize the vis.js network
     */
    initializeNetwork() {
        if (!window.vis) {
            console.error("vis.js not loaded");
            return;
        }

        const options = {
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
        };

        // Create datasets
        this.graphNodes = new vis.DataSet([]);
        this.graphEdges = new vis.DataSet([]);

        // Create network
        this.network = new vis.Network(
            this.containerRef.el,
            {
                nodes: this.graphNodes,
                edges: this.graphEdges
            },
            options
        );

        // Set up event handlers
        this.setupNetworkEvents();
        debugger;
    }

    /**
     * Set up network event handlers
     */
    setupNetworkEvents() {
        // Double-click to show module information
        this.network.on("doubleClick", (params) => {
            const moduleId = params.nodes[0];
            if (moduleId) {
                this.props.onModuleInfo(moduleId);
            }
        });

        // Right-click to remove a node from the graph
        this.network.on("oncontext", (params) => {
            params.event.preventDefault();
            params.event.stopPropagation();

            const nodeId = params.nodes[0];
            if (nodeId) {
                this.props.onRemoveModule(nodeId);
            }
        });
        debugger;
    }

    /**
     * Update the network with new graph data
     */
    updateNetwork() {
        if (!this.network || !this.graphNodes || !this.graphEdges) {
            return;
        }

        // Prepare node objects
        const nodes = this.props.graphData.nodes.map(node => ({
            id: node.id,
            label: node.label,
            color: node.color,
            state: node.state,
            image: node.icon,
            shapeProperties: {
                useBorderWithImage: true,
                interpolation: true,
                coordinateOrigin: "center",
                borderRadius: 10,
            },
            title: node.shortdesc
        }));

        // Update nodes and edges
        this.graphNodes.clear();
        this.graphEdges.clear();

        if (nodes.length > 0) {
            this.graphNodes.add(nodes);
        }

        if (this.props.graphData.edges.length > 0) {
            this.graphEdges.add(this.props.graphData.edges);
        }
        debugger;
    }
}