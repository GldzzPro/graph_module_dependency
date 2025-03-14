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

export class GraphModuleComponent extends Component {
    static template = "module_graphe_template";

    static props = {};

    setup() {
        this.state = useState({
            nodes: [],
            edges: [],
            module_info: {},
            selectedModules: new Set(),
            stateFilter: {},
            searchValue: "",
            maxDepth: 3,
            stopOnInstalled: false,
            stopOnCategory: null,
            stopOnNonCustom: false,
            customFilter: null,
            graph: null,
            loading: false,
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
                label: `${node.name} - ${node.id}`,
                state: node.state,
                shortdesc: node.shortdesc,
                icon: node.icon || DEFAULT_MODULE_ICON,
                color: DEFAULT_STATE_COLOR[node.state]
            }));
            const stateSet = new Set(this.state.nodes.map(node => node.state));
            this.state.stateFilter = Object.fromEntries(
                Array.from(stateSet).map(state => [state, true])
            );

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
                    DEFAULT_NETWORK_OPTIONS
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
                useBorderWithImage: true,
                interpolation: true,
                coordinateOrigin: "center",
                borderRadius: 10,
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
        this.state.loading = true;

        // Fetch module dependencies
        try {
            // Build options object with stop conditions
            const options = {};

            if (this.state.maxDepth > 0) {
                options.max_depth = this.state.maxDepth;
            }

            if (this.state.stopOnInstalled) {
                options.stop_on_installed = true;
            }

            if (this.state.stopOnCategory) {
                options.stop_on_category = this.state.stopOnCategory;
            }

            if (this.state.stopOnNonCustom) {
                options.stop_on_non_custom = true;
            }

            if (this.state.customFilter) {
                options.custom_filter = this.state.customFilter;
            }

            // Call the server method with the options
            const data = await this.orm.call(
                'ir.module.module',
                'get_module_graph',
                [moduleId],
                { options }
            );

            console.log({ data })

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
                console.log({ edge, existingEdge })
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

            console.log({ stateEdges: this.graphEdges, dataEdges: data.edges, edges })
        } catch (error) {
            console.error("Error fetching module graph data:", error);
        } finally {
            this.state.loading = false;

        }
    }


    /**
     * Updates max depth setting
     * @param {Event} event Change event from input
     */
    onChangeMaxDepth(event) {
        this.state.maxDepth = parseInt(event.target.value, 10) || 0;
    }

    /**
     * Toggles stop on installed flag
     */
    toggleStopOnInstalled() {
        this.state.stopOnInstalled = !this.state.stopOnInstalled;
    }

    /**
     * Sets category stop condition
     * @param {Object} category Category to stop on
     */
    setStopCategory(category) {
        this.state.stopOnCategory = category.id;
    }

    /**
     * Clears all stop conditions
     */
    clearStopConditions() {
        this.state.maxDepth = 0;
        this.state.stopOnInstalled = false;
        this.state.stopOnCategory = null;
        this.state.stopOnNonCustom = false;
        this.state.customFilter = null;
    }

    /**
     * Sets a custom domain filter
     * @param {Array} domain Odoo domain filter
     */
    setCustomFilter(domain) {
        this.state.customFilter = domain;
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

    onClearGraph() {
        this.graphEdges.clear()
        this.graphNodes.clear()
        this.state.selectedModules = new Set()
        this.state.edges = []
    }

}

// Register this component as a client action
registry.category("actions").add("module_graph", GraphModuleComponent);

export default GraphModuleComponent;