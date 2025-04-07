/** @odoo-module */
import { Component, useRef, onMounted, onWillUpdateProps } from "@odoo/owl";

export class GraphContainer extends Component {
    static template = "graph_module_dependency.GraphContainer";

    setup() {
        this.containerRef = useRef("graphContainer");
        this.network = null;

        onMounted(() => {
            this.renderGraph();
        });

        onWillUpdateProps(() => {
            this.renderGraph();
        });
    }

    renderGraph() {
        if (!this.containerRef.el) return;

        const visjs = window.vis;
        if (!visjs) return;

        const nodes = new visjs.DataSet(this.props.nodes || []);
        const edges = new visjs.DataSet(this.props.edges || []);

        const options = {
            edges: { arrows: 'to' },
            nodes: {
                margin: 10,
                shape: "image",
                size: 20,
                font: { size: 12, face: 'Arial', multi: 'html' }
            }
        };

        this.network = new visjs.Network(this.containerRef.el, { nodes, edges }, options);
    }
}

export default GraphContainer;
