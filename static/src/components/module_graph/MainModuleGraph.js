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

    onSelectModule(module) {
        if (this.state.selectedModules.some(m => m.id === module.id)) return;
        this.state.selectedModules.push(module);
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
