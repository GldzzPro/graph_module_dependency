/** @odoo-module **/

import { Component, useState, onWillStart, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from '@web/core/registry';

export class ModuleFilters extends Component {

    static template = "module_filters.ModuleFilters";

    static props = {};
    setup() {
        this.orm = useService("orm");
        this.dropdownStateRef = useRef("dropdownState");
        this.dropdownCategoryRef = useRef("dropdownCategory");

        // States for our component
        this.state = useState({
            // All modules data
            modules: [],

            // Available states and categories with counts
            availableStates: new Map(),
            availableCategories: new Map(),

            // Selected states and categories
            selectedStates: [],
            selectedCategories: [],

            // Filter modes (include = true, exclude = false)
            stateFilterMode: true,     // Default is "is one of" (include)
            categoryFilterMode: true,  // Default is "is one of" (include)

            // Application filter: null = all, true = only apps, false = non-apps
            applicationFilter: null,

            // Combined domain for filtering
            domain: [],

            // Filtered modules based on domain
            filteredModules: [],

            // UI states for dropdowns
            stateDropdownOpen: false,
            categoryDropdownOpen: false,
        });

        onWillStart(async () => {
            await this.fetchModules();
            this.processModuleData();
        });
    }

    async fetchModules() {
        this.state.modules = await this.orm.call(
            'ir.module.module',
            'search_read',
            [],
            {
                fields: ['id', 'name', 'shortdesc', 'state', 'category_id', 'application'],
                order: 'shortdesc',
            }
        );
    }

    processModuleData() {
        // Extract unique states with counts
        const stateMap = new Map();
        // Extract unique categories with counts
        const categoryMap = new Map();

        for (const module of this.state.modules) {
            // Process states
            const state = module.state;
            if (stateMap.has(state)) {
                stateMap.set(state, stateMap.get(state) + 1);
            } else {
                stateMap.set(state, 1);
            }

            // Process categories
            if (module.category_id && module.category_id.length === 2) {
                const [categoryId, categoryName] = module.category_id;
                if (categoryMap.has(categoryId)) {
                    categoryMap.set(categoryId, {
                        name: categoryName,
                        count: categoryMap.get(categoryId).count + 1
                    });
                } else {
                    categoryMap.set(categoryId, {
                        name: categoryName,
                        count: 1
                    });
                }
            }
        }

        this.state.availableStates = stateMap;
        this.state.availableCategories = categoryMap;
    }

    // Toggle dropdown visibility
    toggleDropdown(type) {
        if (type === 'state') {
            this.state.stateDropdownOpen = !this.state.stateDropdownOpen;
            if (this.state.stateDropdownOpen) {
                this.state.categoryDropdownOpen = false;
            }
        } else if (type === 'category') {
            this.state.categoryDropdownOpen = !this.state.categoryDropdownOpen;
            if (this.state.categoryDropdownOpen) {
                this.state.stateDropdownOpen = false;
            }
        }
    }

    // Toggle filter mode (include/exclude)
    toggleFilterMode(type) {
        if (type === 'state') {
            this.state.stateFilterMode = !this.state.stateFilterMode;
        } else if (type === 'category') {
            this.state.categoryFilterMode = !this.state.categoryFilterMode;
        }
        this.updateDomain();
    }

    // Set application filter
    setApplicationFilter(value) {
        // value can be: null (all), true (only apps), false (non-apps)
        this.state.applicationFilter = value;
        this.updateDomain();
    }

    // Toggle selection for a filter item
    toggleSelection(type, value) {
        let targetArray;
        if (type === 'state') {
            targetArray = this.state.selectedStates;
        } else if (type === 'category') {
            targetArray = this.state.selectedCategories;
        }

        const index = targetArray.indexOf(value);
        if (index > -1) {
            targetArray.splice(index, 1);
        } else {
            targetArray.push(value);
        }

        this.updateDomain();
    }

    // Clear all selections for a filter type
    clearSelections(type) {
        if (type === 'state') {
            this.state.selectedStates = [];
        } else if (type === 'category') {
            this.state.selectedCategories = [];
        }

        this.updateDomain();
    }

    // Get the operator based on filter mode
    getOperator(isIncludeMode) {
        return isIncludeMode ? 'in' : 'not in';
    }

    // Count modules that match the application filter
    getApplicationFilterCount(filterValue) {
        if (filterValue === null) {
            return this.state.modules.length;
        }
        return this.state.modules.filter(module => module.application === filterValue).length;
    }

    // Update domain based on selected filters
    updateDomain() {
        const domain = [];

        // Add state conditions if any selected
        if (this.state.selectedStates.length > 0) {
            const operator = this.getOperator(this.state.stateFilterMode);
            domain.push(['state', operator, this.state.selectedStates]);
        }

        // Add category conditions if any selected
        if (this.state.selectedCategories.length > 0) {
            const operator = this.getOperator(this.state.categoryFilterMode);
            domain.push(['category_id', operator, this.state.selectedCategories]);
        }

        // Add application filter if set
        if (this.state.applicationFilter !== null) {
            domain.push(['application', '=', this.state.applicationFilter]);
        }

        this.state.domain = domain;
        this.applyFilters();
    }

    // Apply filters using the current domain
    async applyFilters() {
        if (this.state.domain.length === 0) {
            // If no filters, show all modules
            this.state.filteredModules = this.state.modules;
        } else {
            // Otherwise fetch filtered modules
            this.state.filteredModules = await this.orm.call(
                'ir.module.module',
                'search_read',
                [this.state.domain],
                {
                    fields: ['id', 'name', 'shortdesc', 'state', 'category_id', 'application'],
                    order: 'shortdesc',
                }
            );
        }
    }

    // String representation of the domain for debugging
    stringifyDomain() {
        return JSON.stringify(this.state.domain);
    }

    // Close dropdowns when clicking outside
    onClickOutside(ev) {
        const stateDropdown = this.dropdownStateRef.el;
        const categoryDropdown = this.dropdownCategoryRef.el;

        if (stateDropdown && !stateDropdown.contains(ev.target)) {
            this.state.stateDropdownOpen = false;
        }

        if (categoryDropdown && !categoryDropdown.contains(ev.target)) {
            this.state.categoryDropdownOpen = false;
        }
    }
}



// Register this component as a client action
registry.category("actions").add("module_test", ModuleFilters);

export default ModuleFilters;