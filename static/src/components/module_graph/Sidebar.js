/** @odoo-module */
import { Component, useState } from "@odoo/owl";

export class Sidebar extends Component {
    static template = "graph_module_dependency.Sidebar";

    static props = {
        modules: { type: Array, optional: true },
        onSelectModule: Function,
        onChangeColor: Function,
    };

    setup() {
        this.localState = useState({
            searchValue: "",
        });
    }

    get filteredModules() {
        const search = this.localState.searchValue.toUpperCase();
        return (this.props.modules || []).filter((m) =>
            m.name.toUpperCase().includes(search) ||
            m.shortdesc.toUpperCase().includes(search)
        );
    }

    onSearchInput = (ev) => {
        this.localState.searchValue = ev.target.value;
    }

    onModuleClick = (ev, module) => {
        this.props.onSelectModule(module);
    }

    onColorChange = (ev, module) => {
        this.props.onChangeColor(ev.target.value, module);
    }
}

export default Sidebar;
