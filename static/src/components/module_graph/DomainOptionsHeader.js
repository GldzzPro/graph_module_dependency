/** @odoo-module */
import { Component } from "@odoo/owl";

export class DomainOptionsHeader extends Component {
    static template = "graph_module_dependency.DomainOptionsHeader";

    onToggleDirection = (direction) => {
        this.props.onChangeDirection(direction);
    }

    onToggleLimitDepth = () => {
        this.props.onToggleLimitDepth();
    }

    onMaxDepthChange = (ev) => {
        this.props.onMaxDepthChange(parseInt(ev.target.value, 10) || 0);
    }

    onClearGraph = () => {
        this.props.onClearGraph();
    }

    onClearStopConditions = () => {
        this.props.onClearStopConditions();
    }
}

export default DomainOptionsHeader;
