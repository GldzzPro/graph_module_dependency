/** @odoo-module */
import { Component } from "@odoo/owl";

export class ModuleSelector extends Component {
    static template = "module_selector_template";
    static props = {
        modules: Array,
        filteredModules: Array,
        filterState: Object,
        selectedModuleIds: Object, // Set
        onSelectModule: Function,
        onUpdateFilters: Function,
    };

    /**
     * Handle search input change
     * @param {Event} event - Input event
     */
    onSearchInput(event) {
        const searchValue = event.target.value;
        this.props.onUpdateFilters({ searchValue });
        debugger;
    }

    /**
     * Toggle module state filter
     * @param {Event} event - Click event
     */
    onToggleState(event) {
        const stateKey = event.target.dataset.state;
        const stateFilter = {
            ...this.props.filterState.stateFilter,
            [stateKey]: !this.props.filterState.stateFilter[stateKey],
        };
        this.props.onUpdateFilters({ stateFilter });
        debugger;
    }

    /**
     * Handle module selection
     * @param {Event} event - Click event
     */
    onModuleClick(event) {
        const moduleId = parseInt(event.target.dataset.id, 10);
        if (moduleId) {
            this.props.onSelectModule(moduleId);
        }
        debugger;
    }

    /**
     * Check if a module is selected
     * @param {number} moduleId - Module ID to check
     * @returns {boolean} - Whether the module is selected
     */
    isModuleSelected(moduleId) {
        const result = this.props.selectedModuleIds.has(moduleId);
        debugger;
        return result;
    }
}