/** @odoo-module */
import { Component, useState, useEffect } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from '@web/core/registry';
import { ModuleSelector } from "./ModuleSelector";
import { GraphOptions } from "./GraphOptions";
import { ModulesGraphView } from "./ModulesGraphView";

export class ModulesGraphPage extends Component {
    static template = "module_graph_page_template";
    static components = { ModuleSelector, GraphOptions, ModulesGraphView };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");

        // Centralized state management
        this.state = useState({
            // Modules data
            modules: [],
            // Filter state
            filterState: {
                searchValue: "",
                stateFilter: {},
            },
            // Graph options
            graphOptions: {
                maxDepth: 3,
                stopConditions: [],
            },
            // Graph data
            selectedModuleIds: new Set(),
            graphData: {
                nodes: [],
                edges: [],
            },
            // UI state
            loading: false,
        });

        // Load module data on component start
        this.loadModuleData();

        // Set up reactive effect for graph updates
        useEffect(
            () => this.updateGraph(),
            () => [
                this.state.selectedModuleIds,
                this.state.graphOptions,
            ]
        );
        debugger;
    }

    /**
     * Load module data from the server
     */
    async loadModuleData() {
        this.state.loading = true;
        try {
            const data = await this.orm.call(
                'ir.module.module',
                'search_read',
                [],
                {
                    fields: ['id', 'name', 'shortdesc', 'state', 'icon', 'category_id'],
                    order: 'shortdesc',
                }
            );

            // Process module data
            this.state.modules = data.map(module => ({
                id: module.id,
                name: module.name,
                label: `${module.name} - ${module.id}`,
                state: module.state,
                shortdesc: module.shortdesc,
                icon: module.icon || "/base/static/img/icons/default_module_icon.png",
                categoryId: module.category_id && module.category_id[0],
                categoryName: module.category_id && module.category_id[1],
            }));

            // Initialize state filters
            const stateSet = new Set(this.state.modules.map(module => module.state));
            this.state.filterState.stateFilter = Object.fromEntries(
                Array.from(stateSet).map(state => [state, true])
            );
        } catch (error) {
            console.error("Error loading module data:", error);
        } finally {
            this.state.loading = false;
        }
        debugger;
    }

    /**
     * Get filtered modules based on current filter state
     */
    getFilteredModules() {
        const { searchValue, stateFilter } = this.state.filterState;
        const search = searchValue.toUpperCase();

        const filteredModules = this.state.modules.filter(module => {
            const matchesSearch = search === "" ||
                module.name.toUpperCase().includes(search) ||
                module.shortdesc.toUpperCase().includes(search);
            const matchesState = stateFilter[module.state];
            return matchesSearch && matchesState;
        });
        debugger;
        return filteredModules;

    }

    /**
     * Update filter state
     * @param {Object} filters - New filter values
     */
    updateFilters(filters) {
        this.state.filterState = {
            ...this.state.filterState,
            ...filters,
        };
        debugger;
    }

    /**
     * Update graph options
     * @param {Object} options - New graph options
     */
    updateGraphOptions(options) {
        this.state.graphOptions = {
            ...this.state.graphOptions,
            ...options,
        };
        debugger;
    }

    /**
     * Select a module for the graph
     * @param {number} moduleId - Module ID to select
     */
    selectModule(moduleId) {
        if (!this.state.selectedModuleIds.has(moduleId)) {
            // Create a new Set with the added moduleId
            const updatedSet = new Set(this.state.selectedModuleIds);
            updatedSet.add(moduleId);
            this.state.selectedModuleIds = updatedSet;
        }
        debugger;
    }

    /**
     * Remove a module from the graph
     * @param {number} moduleId - Module ID to remove
     */
    removeModule(moduleId) {
        if (this.state.selectedModuleIds.has(moduleId)) {
            const updatedSet = new Set(this.state.selectedModuleIds);
            updatedSet.delete(moduleId);
            this.state.selectedModuleIds = updatedSet;
        }
        debugger;
    }

    /**
     * Clear the graph
     */
    clearGraph() {
        this.state.selectedModuleIds = new Set();
        this.state.graphData.nodes.update(nodes);
        this.state.graphData.edges.update(edges);
        debugger;
    }

    /**
     * Show module information in a popup
     * @param {number} moduleId - Module ID to display
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
        debugger;
    }

    /**
     * Update the graph based on selected modules and options
     */
    async updateGraph() {
        const selectedModuleIds = Array.from(this.state.selectedModuleIds);
        if (selectedModuleIds.length === 0) {
            this.state.graphData = { nodes: [], edges: [] };
            return;
        }

        this.state.loading = true;
        try {
            // Convert graph options to server format
            const options = this.prepareGraphOptions();

            // Fetch graph data
            const data = await this.orm.call(
                'ir.module.module',
                'get_module_graph',
                [selectedModuleIds],
                { options }
            );

            const { nodes, edges } = this.processGraphData(data);
            this.state.graphData.nodes.update(nodes);
            this.state.graphData.edges.update(edges);
        } catch (error) {
            console.error("Error updating graph:", error);
        } finally {
            this.state.loading = false;
        }
        debugger;
    }

    /**
     * Prepare graph options for the server API
     * @returns {Object} - Graph options in server format
     */
    prepareGraphOptions() {
        const options = {};
        const { maxDepth, stopConditions } = this.state.graphOptions;

        if (maxDepth > 0) {
            options.max_depth = maxDepth;
        }

        // Convert stop conditions to the format expected by the server
        if (stopConditions && stopConditions.length > 0) {
            options.stop_conditions = stopConditions.map(condition => ({
                type: condition.type,
                value: condition.value,
            }));
        }
        debugger
        return options;
    }

    /**
     * Process graph data received from the server
     * @param {Object} data - Raw graph data from server
     * @returns {Object} - Processed graph data
     */
    processGraphData(data) {
        const nodes = data.nodes.map(node => {
            const moduleInfo = this.state.modules.find(m => m.id === node.id);
            if (!moduleInfo) return null;

            return {
                id: node.id,
                label: moduleInfo.label,
                state: moduleInfo.state,
                shortdesc: moduleInfo.shortdesc,
                icon: moduleInfo.icon,
                color: this.getNodeColor(moduleInfo.state),
            };
        }).filter(Boolean);

        const edges = data.edges.map(edge => {
            const edgeObject = {
                from: edge.from,
                to: edge.to,
            };

            if (edge.type === 'exclusion') {
                edgeObject.color = {
                    color: 'red',
                    highlight: 'red',
                };
            }

            return edgeObject;
        });
        debugger
        return { nodes, edges };
    }

    /**
     * Get color for a module state
     * @param {string} state - Module state
     * @returns {string} - Color for the state
     */
    getNodeColor(state) {
        const STATE_COLORS = {
            'uninstallable': '#eaeaa4',
            'installed': '#97c2fc',
            'uninstalled': '#e5f8fc',
            'to install': '#939afc',
            'to upgrade': '#AEFCAB',
            'to remove': '#fcadb7',
        };
        const nodeColor = STATE_COLORS[state] || '#e5f8fc';
        debugger
        return nodeColor
    }
}

registry.category("actions").add("module_graph", ModulesGraphPage);