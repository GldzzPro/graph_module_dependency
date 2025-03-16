/** @odoo-module */
import { Component } from "@odoo/owl";

export class GraphOptions extends Component {
    static template = "graph_options_template";
    static props = {
        graphOptions: Object,
        onUpdateOptions: Function,
        onClearGraph: Function,
    };

    /**
     * Handle max depth change
     * @param {Event} event - Input event
     */
    onChangeMaxDepth(event) {
        const maxDepth = parseInt(event.target.value, 10) || 0;
        this.props.onUpdateOptions({ maxDepth });
    }

    /**
     * Toggle a stop condition
     * @param {string} conditionType - Type of condition to toggle
     * @param {any} value - Value for the condition
     */
    toggleStopCondition(conditionType, value = true) {
        const stopConditions = [...this.props.graphOptions.stopConditions];

        // Check if the condition already exists
        const existingIndex = stopConditions.findIndex(
            cond => cond.type === conditionType && cond.value === value
        );

        if (existingIndex >= 0) {
            // Remove the condition if it exists
            stopConditions.splice(existingIndex, 1);
        } else {
            // Add the condition if it doesn't exist
            stopConditions.push({ type: conditionType, value });
        }

        this.props.onUpdateOptions({ stopConditions });
    }

    /**
     * Check if a stop condition is active
     * @param {string} conditionType - Type of condition to check
     * @param {any} value - Value for the condition
     * @returns {boolean} - Whether the condition is active
     */
    isConditionActive(conditionType, value = true) {
        return this.props.graphOptions.stopConditions.some(
            cond => cond.type === conditionType && cond.value === value
        );
    }

    /**
     * Clear all stop conditions
     */
    clearStopConditions() {
        this.props.onUpdateOptions({
            maxDepth: 0,
            stopConditions: [],
        });
    }
}