/** @odoo-module */
import { Component, useState, onWillStart } from "@odoo/owl";
import { fetchModules, useOrm, useAction } from "./utils.js";
import { Sidebar } from "./Sidebar.js";
import { DomainOptionsHeader } from "./DomainOptionsHeader.js";
import { SelectedModulesChips } from "./SelectedModulesChips.js";
import { GraphContainer } from "./GraphContainer.js";

export class MainModuleGraph extends Component {
    static template = "graph_module_dependency.MainModuleGraph";
    static components = { Sidebar, DomainOptionsHeader, SelectedModulesChips, GraphContainer };

    setup() {
        this.orm = useOrm();
        this.action = useAction();
        this.graphNodes = null;
        this.graphEdges = null;

        this.state = useState({
            modules: [],
            selectedModules: [],
            nodes: [],
            edges: [],
            direction: 'depends_on',
            limitDepthEnabled: false,
            maxDepth: 0,
        });

        onWillStart(async () => {
            const data = await fetchModules(this.orm);
            this.state.modules = data.map(m => ({
                ...m,
                color: '#97c2fc'  // default color
            }));
        });
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

        this.state.loading = true;

        // Fetch module dependencies
        try {
            // Build options object with stop conditions
            const options = {}

            const moduleIds = [...Array.from(this.state.selectedModules), moduleId];

            // Determine which backend method to call based on direction
            const method = this.state.direction === 'depends_on' ? 'get_module_graph' : 'get_reverse_dependency_graph';

            // Call the server method with the options
            const data = await this.orm.call(
                'ir.module.module',
                method,
                [moduleIds],
                { options }
            );


            this.graphNodes.update(data.nodes.map(node => this.createNodeObject(node)));

            const edges = [];
            const graphEdges = Object.values(this.graphEdges._data)

            data.edges.forEach(edge => {
                const existingEdge = graphEdges.find(e =>
                    e.from == edge.from && e.to == edge.to
                );

                if (!existingEdge) {
                    const newEdge = {
                        from: edge.from,
                        to: edge.to
                    };
                    if (edge.type === 'cycleDirection') {
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
            this.state.selectedModules.add(moduleId);

        } catch (error) {
            console.error("Error fetching module graph data:", error);
        } finally {
            this.state.loading = false;

        }
    }

    onSelectModule(module) {
        if (this.state.selectedModules.some(m => m.id === module.id)) return;
        this.state.selectedModules.push(module);
        console.log({ module, selectedModules: this.state.selectedModules });
        this.fetchGraph();
    }

    onRemoveModule(moduleId) {
        this.state.selectedModules = this.state.selectedModules.filter(m => m.id !== moduleId);
        this.fetchGraph();
    }

    onChangeColor(color, module) {
        const mod = this.state.modules.find(m => m.id === module.id);
        if (mod) mod.color = color;
        this.fetchGraph();
    }

    onChangeDirection(direction) {
        this.state.direction = direction;
        this.fetchGraph();
    }

    onToggleLimitDepth() {
        this.state.limitDepthEnabled = !this.state.limitDepthEnabled;
        this.fetchGraph();
    }

    onMaxDepthChange(value) {
        this.state.maxDepth = value;
        this.fetchGraph();
    }

    onClearGraph() {
        this.state.selectedModules = [];
        this.state.nodes = [];
        this.state.edges = [];
    }

    onClearStopConditions() {
        this.state.limitDepthEnabled = false;
        this.state.maxDepth = 0;
        this.fetchGraph();
    }

    async fetchGraph() {
        if (!this.state.selectedModules.length) {
            this.state.nodes = [];
            this.state.edges = [];
            return;
        }

        const moduleIds = this.state.selectedModules.map(m => m.id);
        const options = {};

        if (this.state.limitDepthEnabled) {
            options.max_depth = this.state.maxDepth;
        }

        const method = this.state.direction === 'depends_on' ? 'get_module_graph' : 'get_reverse_dependency_graph';

        const data = await this.orm.call('ir.module.module', method, [moduleIds], { options });

        this.state.nodes = data.nodes.map(n => {
            const mod = this.state.modules.find(m => m.id === n.id);
            return {
                ...n,
                color: mod ? mod.color : '#97c2fc',
                icon: mod ? mod.icon : '',
                shortdesc: mod ? mod.shortdesc : '',
                name: mod ? mod.name : ''
            };
        });
        this.state.edges = data.edges;
    }
}

import { registry } from "@web/core/registry";

registry.category("actions").add("module_graph", MainModuleGraph);

export default MainModuleGraph;
