/** @odoo-module */
import { Component } from "@odoo/owl";

export class SelectedModulesChips extends Component {
    static template = "graph_module_dependency.SelectedModulesChips";

    static props = {
        selectedModules: { type: Array, optional: true },
        onRemoveModule: Function,
    };

    onRemove = (moduleId) => {
        this.props.onRemoveModule(moduleId);
    }
}

export default SelectedModulesChips;
