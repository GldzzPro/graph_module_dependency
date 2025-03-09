/** @odoo-module */
import { Component, useState, useRef, onWillStart, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from '@web/core/registry';
import { loadJS, loadCSS } from "@web/core/assets";

export class GraphModelComponent extends Component {
    static template = "model_graph_template"; // Refers to our QWeb template

    static props = {};

    setup() {
        this.state = useState({
            nodes: [],
            edges: [],
            model_info: {},
            filteredNodes: [],
            selectedModels: new Set(),
            maxDepth: 2, // Default max depth
            relationTypeColors: {
                'many2one': '#red',
                'one2one': '#97c2fc',
                'one2many': '#AEFCAB',
                'many2many': '#fcadb7',
            }
        });

        this.graphNodes = null;
        this.graphEdges = null;
        this.network = null;

        this.containerRef = useRef("graph");
        this.orm = useService("orm");
        this.action = useService("action");

        onWillStart(async () => {
            // Load vis.js library
            await loadJS("https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.js");
            await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.css");

            // Fetch model data
            const data = await this.orm.call(
                'ir.model',
                'search_read',
                [],
                {
                    fields: ['id', 'name', 'model'],
                    order: 'name',
                }
            );

            // Process model data
            this.state.nodes = data.map(node => ({
                id: node.id,
                label: node.name,
                model: node.model,
            }));

            // Initially, filtered nodes are the same as all nodes
            this.state.filteredNodes = [...this.state.nodes];
        });

        onMounted(() => {
            if (this.containerRef.el) {
                // Initialize vis.js dataset objects
                this.graphNodes = new vis.DataSet([]);
                this.graphEdges = new vis.DataSet([]);

                // Initialize the network
                this.network = new vis.Network(
                    this.containerRef.el,
                    {
                        nodes: this.graphNodes,
                        edges: this.graphEdges
                    },
                    {
                        edges: {
                            arrows: 'to',
                            font: {
                                size: 10,
                                align: 'middle'
                            }
                        },
                        physics: {
                            stabilization: true,
                            barnesHut: {
                                gravitationalConstant: -2000,
                                springConstant: 0.04,
                                springLength: 200
                            }
                        }
                    }
                );

                // Set up network event handlers
                this.setupNetworkEvents();
            }
        });
    }

    /**
     * Set up event handlers for the vis.js network
     */
    setupNetworkEvents() {
        // Double-click to show model information
        this.network.on("doubleClick", (params) => {
            const modelId = params.nodes[0];
            if (modelId) {
                this.showModelInfo(modelId);
            }
        });

        // Right-click to remove a node from the graph
        this.network.on("oncontext", (params) => {
            params.event.preventDefault();
            params.event.stopPropagation();

            const nodeId = params.nodes[0];
            if (nodeId) {
                this.graphNodes.remove(nodeId);
                this.state.selectedModels.delete(nodeId);
            }
        });

        // Display field name on hover
        this.network.on("hoverEdge", (params) => {
            const edgeId = params.edge;
            const edge = this.graphEdges.get(edgeId);
            if (edge && edge.title) {
                // Show tooltip with field information
            }
        });
    }

    /**
     * Open the model form view
     * @param {number} modelId - The ID of the model to display
     */
    showModelInfo(modelId) {
        this.action.doAction({
            type: 'ir.actions.act_window',
            view_type: 'form',
            view_mode: 'form',
            views: [[false, 'form']],
            target: 'new',
            res_model: 'ir.model',
            res_id: modelId,
        });
    }

    /**
     * Handle filter input for model search
     * @param {Event} event - Input keyup event
     */
    onInputKeyup(event) {
        const filter = event.target.value.toUpperCase();

        // Filter nodes based on search input
        this.state.filteredNodes = this.state.nodes.filter(node =>
            node.model.toUpperCase().includes(filter) ||
            node.label.toUpperCase().includes(filter)
        );
    }

    /**
     * Change the maximum depth for relation traversal
     * @param {Event} event - Change event from the depth selector
     */
    onChangeDepth(event) {
        this.state.maxDepth = parseInt(event.target.value);
    }

    /**
     * Handle clicking on a model in the navigation list
     * @param {Event} event - Click event
     */
    async onClickModel(event) {
        const modelId = parseInt(event.target.dataset.id);
        const modelLabel = event.target.dataset.label;

        if (!modelId || this.state.selectedModels.has(modelId)) {
            return;
        }

        // Update the graph with the selected model
        this.graphNodes.update([{
            id: modelId,
            label: modelLabel
        }]);

        this.state.selectedModels.add(modelId);

        // Fetch model relationships with depth limit
        try {
            const data = await this.orm.call(
                'ir.model',
                'get_model_relation_graph',
                [modelId, this.state.maxDepth]
            );

            // Process and add nodes to the graph
            const nodes = [];
            data.nodes.forEach(node => {
                if (node.id) {
                    nodes.push({
                        id: node.id,
                        label: node.label,
                        title: node.model,
                        state: node.model
                    });
                    this.state.selectedModels.add(node.id);
                }
            });
            this.graphNodes.update(nodes);

            // Process and add edges to the graph
            const edges = [];
            data.edges.forEach(edge => {
                const existingEdge = this.state.edges.find(e =>
                    e.from === edge.from && e.to === edge.to
                );

                if (!existingEdge) {
                    const newEdge = {
                        from: edge.from,
                        to: edge.to,
                        title: edge.field,
                        label: edge.field,
                    };

                    if (edge.type) {
                        newEdge.color = {
                            color: this.state.relationTypeColors[edge.type] || this.state.relationTypeColors.one2one,
                            highlight: this.state.relationTypeColors[edge.type] || this.state.relationTypeColors.one2one
                        };
                        newEdge.title = `${edge.field} (${edge.type})`;
                    }

                    this.state.edges.push(newEdge);
                    edges.push(newEdge);
                }
            });

            this.graphEdges.update(edges);
        } catch (error) {
            console.error("Error fetching model graph data:", error);
        }
    }

    /**
     * Check if a model is selected in the graph
     * @param {number} modelId - Model ID to check
     * @returns {boolean} - True if the model is selected
     */
    isModelSelected(modelId) {
        return this.state.selectedModels.has(modelId);
    }
    
    /**
     * Handle color change for a relation type
     * @param {Event} event - Change event from the color input
     */
    onChangeRelationColor(event) {
        const relationType = event.target.dataset.relationType;
        const color = event.target.value;
        
        // Update the color in state
        this.state.relationTypeColors[relationType] = color;
        
        // Update the edges in the graph with the new color
        if (this.graphEdges) {
            const edgesToUpdate = [];
            this.graphEdges.forEach(edge => {
                if (edge.type === relationType) {
                    edgesToUpdate.push({
                        id: edge.id,
                        color: {
                            color: color,
                            highlight: color
                        }
                    });
                }
            });
            
            if (edgesToUpdate.length > 0) {
                this.graphEdges.update(edgesToUpdate);
            }
        }
    }
}

// Register this component as a client action
registry.category("actions").add("model_graph", GraphModelComponent);

export default GraphModelComponent;