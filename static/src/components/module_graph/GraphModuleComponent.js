/** @odoo-module */
import { Component, useState, useRef, onWillStart, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from '@web/core/registry';
import { loadJS, loadCSS } from "@web/core/assets";

const DEFAULT_MODULE_ICON = `/base/static/img/icons/default_module_icon.png`;


export class GraphModuleComponent extends Component {
    static template = "module_graphe_template"; // Refers to our QWeb template

    static props = {};

    setup() {
        this.state = useState({
            nodes: [],
            edges: [],
            module_info: {},
            filteredNodes: [],
            selectedModules: new Set(),
            stateColors: {
                'uninstallable': '#eaeaa4',
                'installed': '#97c2fc',
                'uninstalled': '#e5f8fc',
                'to install': '#939afc',
                'to upgrade': '#AEFCAB',
                'to remove': '#fcadb7',
            },
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

            // Fetch module data
            const data = await this.orm.call(
                'ir.module.module',
                'search_read',
                [],
                {
                    fields: ['id', 'name', 'shortdesc', 'state', 'icon'],
                    order: 'shortdesc',
                }
            );

            // Process module data
            this.state.nodes = data.map(node => ({
                id: node.id,
                label: node.name,
                state: node.state,
                shortdesc: node.shortdesc,
                icon: node.icon || DEFAULT_MODULE_ICON,
            }));



            // Initially, filtered nodes are the same as all nodes
            this.state.filteredNodes = [...this.state.nodes];
        });

        onMounted(() => {
            if (this.containerRef.el) {
                // Initialize vis.js dataset objects
                this.graphNodes = new vis.DataSet([]);
                this.graphEdges = new vis.DataSet([]);
                // Initialize the network with custom node rendering
                this.network = new vis.Network(
                    this.containerRef.el,
                    {
                        nodes: this.graphNodes,
                        edges: this.graphEdges
                    },
                    {
                        edges: {
                            arrows: 'to',
                        },
                        nodes: {
                            shape: 'box',
                            margin: 10,
                            size: 50,
                            font: {
                                size: 12,
                                face: 'Arial',
                                multi: 'html'
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
     * Open the module form view
     * @param {number} moduleId - The ID of the module to display
     */
    showModuleInfo(moduleId) {
        this.action.doAction({
            type: 'ir.actions.act_window',
            view_type: 'form',
            view_mode: 'form',
            views: [[false, 'form']],
            target: 'new',
            res_model: 'ir.module.module',
            res_id: moduleId,
        });
    }

    /**
     * Handle filter input for module search
     * @param {Event} event - Input keyup event
     */
    onInputKeyup(event) {
        const filter = event.target.value.toUpperCase();
        // Filter nodes based on search input
        this.state.filteredNodes = this.state.nodes.filter(node =>
            node.label.toUpperCase().includes(filter) ||
            node.shortdesc.toUpperCase().includes(filter)
        );
    }
    /**
     * Update all nodes in the graph with current settings
     */
    updateAllNodes() {
        if (!this.graphNodes) return;
        const nodesToUpdate = [];
        this.graphNodes.forEach(node => {
            const originalNode = this.state.nodes.find(n => n.id === node.id);
            if (originalNode) {
                nodesToUpdate.push(this.createNodeObject(originalNode));
            }
        });

        if (nodesToUpdate.length > 0) {
            this.graphNodes.update(nodesToUpdate);
        }
    }

    /**
     * Create a node object with proper formatting for the graph
     * @param {Object} node - The node data
     * @returns {Object} - Formatted node object for vis.js
     */
    createNodeObject(node) {
        const iconPath = node.icon || DEFAULT_MODULE_ICON;
        return {
            id: node.id,
            label: node.label,
            color: this.state.stateColors[node.state],
            state: node.state,
            image: iconPath,
            shape: "circularImage",
            shapeProperties: {
                useImageSize: true,
                useBorderWithImage: false,
                interpolation: false,
                coordinateOrigin: "center",
            },
            title: node.shortdesc
        };
    }

    /**
     * Handle clicking on a module in the navigation list
     * @param {Event} event - Click event
     */
    async onClickModule(event) {
        const moduleId = parseInt(event.target.dataset.id);
        const moduleNode = this.state.nodes.find(n => n.id === moduleId);

        if (!moduleId || this.state.selectedModules.has(moduleId) || !moduleNode) {
            return;
        }

        // Update the graph with the selected module
        this.graphNodes.update([this.createNodeObject(moduleNode)]);
        this.state.selectedModules.add(moduleId);

        // Fetch module dependencies
        try {
            const data = await this.orm.call(
                'ir.module.module',
                'get_module_graph',
                [moduleId]
            );

            // Process and add nodes to the graph
            const nodes = [];
            data.nodes.forEach(node => {
                if (node.id) {
                    // Find the original node with all information
                    const originalNode = this.state.nodes.find(n => n.id === node.id);
                    if (originalNode) {
                        nodes.push(this.createNodeObject(originalNode));
                        this.state.selectedModules.add(node.id);
                    }
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
                        to: edge.to
                    };

                    if (edge.type === 'exclusion') {
                        newEdge.color = {
                            color: 'red',
                            highlight: 'red'
                        };
                    }

                    this.state.edges.push(newEdge);
                    edges.push(newEdge);
                }
            });

            this.graphEdges.update(edges);
        } catch (error) {
            console.error("Error fetching module graph data:", error);
        }
    }

    /**
     * Check if a module is selected in the graph
     * @param {number} moduleId - Module ID to check
     * @returns {boolean} - True if the module is selected
     */
    isModuleSelected(moduleId) {
        return this.state.selectedModules.has(moduleId);
    }

    /**
     * Handle color change for a module state
     * @param {Event} event - Change event from the color input
     */
    onChangeStateColor(event) {
        const state = event.target.dataset.state;
        const color = event.target.value;

        // Update the color in state
        this.state.stateColors[state] = color;

        // Update all nodes with the new color settings
        this.updateAllNodes();
    }
}

// Register this component as a client action
registry.category("actions").add("module_graph", GraphModuleComponent);

export default GraphModuleComponent;