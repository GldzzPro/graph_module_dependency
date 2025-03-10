/** @odoo-module */
import { Component, useState, useRef, onWillStart, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from '@web/core/registry';
import { loadJS, loadCSS } from "@web/core/assets";

const DEFAULT_MODULE_ICON = `/base/static/img/icons/default_module_icon.png`;
const DEFAULT_STATE_COLOR = {
    'uninstallable': '#eaeaa4',
    'installed': '#97c2fc',
    'uninstalled': '#e5f8fc',
    'to install': '#939afc',
    'to upgrade': '#AEFCAB',
    'to remove': '#fcadb7',
}

export class GraphModuleComponent extends Component {
    static template = "module_graphe_template"; // Refers to our QWeb template

    static props = {};

    setup() {
        this.state = useState({
            nodes: [],
            edges: [],
            module_info: {},
            selectedModules: new Set(),
            stateFilter: {},
            searchValue: "",
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
                color: DEFAULT_STATE_COLOR[node.state]
            }));
            const stateSet = new Set(this.state.nodes.map(node => node.state));

            this.state.stateFilter = Object.fromEntries(
                Array.from(stateSet).map(state => [state, true])
            );
            console.log({ stateSet })

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
                            margin: 10,
                            shape: "image",
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
       * Create a node object with proper formatting for the graph
       * @param {Object} node - The node data
       * @returns {Object} - Formatted node object for vis.js
       */
    createNodeObject(node) {
        const iconPath = node.icon || DEFAULT_MODULE_ICON;
        return {
            id: node.id,
            label: node.label,
            color: DEFAULT_STATE_COLOR[node.state],
            state: node.state,
            image: iconPath,
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
    onInputKeyup(event) {
        this.state.searchValue = event.target.value;
    }

    onToggleState(event) {
        const stateKey = event.target.dataset.state;
        // Replace the stateFilter object with a new one
        this.state.stateFilter = {
            ...this.state.stateFilter,
            [stateKey]: !this.state.stateFilter[stateKey],
        };
    }

    // A getter that always computes the filtered list from the full nodes array:
    get filteredNodes() {
        const search = this.state.searchValue.toUpperCase();
        const filteredNodes = this.state.nodes.filter(node => {
            const matchesSearch =
                node.label.toUpperCase().includes(search) ||
                node.shortdesc.toUpperCase().includes(search);
            const matchesState = this.state.stateFilter[node.state];
            return matchesSearch && matchesState;
        });
        console.log({ search, fLength: filteredNodes.length })
        return filteredNodes;
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
     * Handle color change for a module
     * @param {Event} event - Change event from the color input
     */
    onChangeColor(event) {
        const color = event.target.value;
        const moduleId = event.target.dataset.id
        const originalNodeIndex = this.state.nodes.findIndex(node => node.id == moduleId)
        this.state.nodes[originalNodeIndex].color = color;
        this.graphNodes.update([this.state.nodes[originalNodeIndex]]);
    }

}

// Register this component as a client action
registry.category("actions").add("module_graph", GraphModuleComponent);

export default GraphModuleComponent;