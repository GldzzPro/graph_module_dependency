/** @odoo-module */
import { Component, useRef, onMounted, onWillUnmount, useEffect } from "@odoo/owl";
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
        this.visLoaded = false;

        // Initialize network on mount
        onMounted(async () => {
            // Load vis.js libraries first
            await this.loadVisLibrary();

            // Wait a small amount of time to ensure library is initialized
            setTimeout(() => {
                if (this.containerRef.el) {
                    this.initializeNetwork();
                    this.updateNetwork();
                }
            }, 200);
        });

        // Clean up network on unmount
        onWillUnmount(() => {
            if (this.network) {
                this.network.destroy();
                this.network = null;
            }
        });

        // Update network when graph data changes
        useEffect(() => {
            // Only update if network is already initialized
            if (this.network && this.visLoaded) {
                this.updateNetwork();
            }
        });
    }

    /**
     * Load the vis.js library
     */
    async loadVisLibrary() {
        try {
            await Promise.all([
                loadJS("https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.js"),
                loadCSS("https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.css")
            ]);
            this.visLoaded = true;
            return true;
        } catch (error) {
            console.error("Error loading vis.js:", error);
            return false;
        }
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
                smooth: {
                    type: 'cubicBezier',
                    forceDirection: 'horizontal',
                    roundness: 0.4
                }
            },
            nodes: {
                shape: "box",
                margin: 10,
                font: {
                    size: 12,
                    face: 'Arial'
                },
                borderWidth: 2,
                shadow: true
            },
            physics: {
                enabled: true,
                hierarchicalRepulsion: {
                    nodeDistance: 120
                },
                solver: 'hierarchicalRepulsion'
            },
            layout: {
                hierarchical: {
                    direction: 'LR',
                    sortMethod: 'directed',
                    levelSeparation: 150
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

        // Fit the network to the container
        setTimeout(() => {
            if (this.network) {
                this.network.fit();
            }
        }, 100);
    }

    /**
     * Set up network event handlers
     */
    setupNetworkEvents() {
        if (!this.network) return;

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

            const nodeId = this.network.getNodeAt(params.pointer.DOM);
            if (nodeId) {
                this.props.onRemoveModule(nodeId);
            }
        });
    }

    /**
     * Update the network with new graph data
     */
    updateNetwork() {
        if (!this.network || !this.graphNodes || !this.graphEdges) {
            console.warn("Network or datasets not initialized");
            return;
        }

        console.log("Updating network with data:", this.props.graphData);

        try {
            // Clear existing data
            this.graphNodes.clear();
            this.graphEdges.clear();

            // Prepare nodes with appropriate properties
            if (this.props.graphData.nodes && this.props.graphData.nodes.length > 0) {
                const nodeData = this.props.graphData.nodes.map(node => ({
                    id: node.id,
                    label: node.label || `Module ${node.id}`,
                    color: {
                        background: node.color || '#97c2fc',
                        border: '#2B7CE9',
                        highlight: {
                            background: '#D2E5FF',
                            border: '#2B7CE9'
                        }
                    },
                    title: node.shortdesc || node.label
                }));
                this.graphNodes.add(nodeData);
            }

            // Add edges
            if (this.props.graphData.edges && this.props.graphData.edges.length > 0) {
                this.graphEdges.add(this.props.graphData.edges);
            }

            // Fit the network to the available space
            setTimeout(() => {
                if (this.network && (this.graphNodes.length > 0 || this.graphEdges.length > 0)) {
                    this.network.fit();
                }
            }, 100);
        } catch (error) {
            console.error("Error updating network:", error);
        }
    }
}