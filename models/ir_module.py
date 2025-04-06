from odoo import models, api
import logging

_logger = logging.getLogger(__name__)


class Module(models.Model):
    _inherit = "ir.module.module"

    @api.model
    def get_module_graph(self, module_ids, options=None):
        """Build a dependency graph following module dependencies."""
        options = options or {}
        if options.get("max_depth", -1) == 0:
            modules = self.browse(module_ids)
            nodes = [
                {
                    "id": m.id,
                    "label": m.name,
                    "state": m.state,
                }
                for m in modules
            ]
            return {"nodes": nodes, "edges": []}
        return self._build_graph(
            module_ids=module_ids,
            options=options,
            get_dependencies=lambda m: [d.depend_id for d in m.dependencies_id],
            get_exclusions=lambda m: [
                e.exclusion_id for e in getattr(m, "exclusion_ids", [])
            ],
            create_dependency_edge=lambda m, d: {
                "from": m.id,
                "to": d.id,
                "type": "dependency",
            },
            create_exclusion_edge=lambda m, e: {
                "from": m.id,
                "to": e.id,
                "type": "exclusion",
            },
        )

    @api.model
    def get_reverse_dependency_graph(self, module_ids, options=None):
        """Build a reverse dependency graph showing dependent modules."""
        options = options or {}
        if options.get("max_depth", -1) == 0:
            modules = self.browse(module_ids)
            nodes = [
                {
                    "id": m.id,
                    "label": m.name,
                    "state": m.state,
                }
                for m in modules
            ]
            return {"nodes": nodes, "edges": []}
        return self._build_graph(
            module_ids=module_ids,
            options=options,
            get_dependencies=lambda m: self.search(
                [
                    (
                        "dependencies_id.depend_id",
                        "in",
                        [m.id],
                    )  # Changed from '=' to 'in'
                ]
            ),
            get_exclusions=lambda m: self.search(
                [
                    (
                        "exclusion_ids.exclusion_id",
                        "in",
                        [m.id],
                    )  # Changed from '=' to 'in'
                ]
            ),
            create_dependency_edge=lambda m, d: {
                "from": d.id,
                "to": m.id,
                "type": "reverse_dependency",
            },
            create_exclusion_edge=lambda m, e: {
                "from": e.id,
                "to": m.id,
                "type": "reverse_exclusion",
            },
        )

    def _build_graph(
        self,
        module_ids,
        options,
        get_dependencies,
        get_exclusions,
        create_dependency_edge,
        create_exclusion_edge,
    ):
        """Shared graph builder with configurable traversal logic."""
        options = dict(options or {})
        if "current_depth" not in options:
            options["current_depth"] = 0
        if "cycle_counter" not in options:
            options.update(
                {
                    "cycle_counter": 0,
                    "all_visited": set(),
                    "current_path": [],
                    "cycles": {},
                }
            )

        module_ids = module_ids if isinstance(module_ids, list) else [module_ids]
        if not module_ids or (
            options.get("max_depth", False)
            and options["current_depth"] > options["max_depth"]
        ):
            return {"nodes": [], "edges": []}

        modules = self.browse(module_ids)
        nodes, edges = [], []

        for module in modules:
            # Cycle detection
            if module.id in options["current_path"]:
                cycle_start = options["current_path"].index(module.id)
                cycle_nodes = options["current_path"][cycle_start:] + [module.id]
                options["cycle_counter"] += 1
                options["cycles"][options["cycle_counter"]] = set(cycle_nodes)
                continue

            options["current_path"].append(module.id)
            options["all_visited"].add(module.id)

            # Node creation
            node_data = {
                "id": module.id,
                "label": module.name,
                "state": module.state,
                "depth": options["current_depth"],
            }
            if module.category_id:
                node_data.update(
                    {
                        "category": module.category_id.name,
                        "category_id": module.category_id.id,
                    }
                )
            if hasattr(module, "is_custom"):
                node_data["is_custom"] = module.is_custom
            nodes.append(node_data)

            if not self._should_stop_graph_traversal(module, options):
                next_options = dict(options, current_depth=options["current_depth"] + 1)

                # Process dependencies
                if options.get("include_dependencies", True):
                    deps = self._process_relations(
                        module,
                        get_dependencies,
                        create_dependency_edge,
                        next_options,
                        edges,
                        nodes,
                        # Pass through all graph-building parameters:
                        get_dependencies,
                        get_exclusions,
                        create_dependency_edge,
                        create_exclusion_edge,
                    )

                # Process exclusions
                if options.get("include_exclusions", True):
                    self._process_relations(
                        module,
                        get_exclusions,
                        create_exclusion_edge,
                        next_options,
                        edges,
                        nodes,
                        # Pass through all graph-building parameters:
                        get_dependencies,
                        get_exclusions,
                        create_dependency_edge,
                        create_exclusion_edge,
                    )

            options["current_path"].pop()

        # Final processing
        if options["current_depth"] == 0:
            self._mark_cycles_in_graph(nodes, edges, options["cycles"])

        return {
            "nodes": list({n["id"]: n for n in nodes}.values()),
            "edges": list({f"{e['from']}-{e['to']}": e for e in edges}.values()),
        }

    def _process_relations(
        self,
        module,
        get_relations,
        create_edge,
        next_options,
        edges,
        nodes,
        get_dependencies,
        get_exclusions,
        create_dependency_edge,
        create_exclusion_edge,
    ):
        """Helper to process dependencies/exclusions."""
        relations = []
        for rel in get_relations(module):
            if self._check_module_exclusion(rel, next_options):
                continue
            relations.append(rel.id)
            edges.append(create_edge(module, rel))

        if relations:
            res = self._build_graph(
                relations,
                next_options,
                get_dependencies,  # Pass through original parameters
                get_exclusions,
                create_dependency_edge,
                create_exclusion_edge,
            )
            nodes.extend(res["nodes"])
            edges.extend(res["edges"])
        return relations

    def _mark_cycles_in_graph(self, nodes, edges, cycles):
        """
        Mark all nodes and edges that are part of cycles.

        Args:
            nodes: List of node dictionaries
            edges: List of edge dictionaries
            cycles: Dictionary mapping cycle_id to set of node IDs in that cycle

        Returns:
            Tuple (nodes, edges) with cycle information added
        """
        # Process nodes
        for node in nodes:
            for cycle_id, cycle_nodes in cycles.items():
                if node["id"] in cycle_nodes:
                    node["in_cycle"] = True
                    node["cycle_id"] = cycle_id
                    node["type"] = "cycleNode"

        # Process edges
        for edge in edges:
            for cycle_id, cycle_nodes in cycles.items():
                # Check if both ends of the edge are in the same cycle
                if edge["from"] in cycle_nodes and edge["to"] in cycle_nodes:
                    # Check if they're adjacent in the cycle path
                    # (This requires more complex logic to determine edge direction in cycle)
                    edge["in_cycle"] = True
                    edge["cycle_id"] = cycle_id
                    edge["type"] = "cycleDirection"

        return nodes, edges

    def _should_stop_graph_traversal(self, module, options):
        """
        Determine if graph traversal should stop at this module based on stop_domains.

        Args:
            module: The current module record
            options: Dictionary of options with optional stop_domains

        Returns:
            Boolean indicating if traversal should stop
        """
        # If no stop domains, continue traversal
        if not options.get("stop_domains"):
            return False

        # Check each domain in stop_domains
        for domain in options.get("stop_domains", []):
            # Ensure domain is a list
            if not isinstance(domain, list):
                continue

            try:
                # Create a domain with the current module ID
                full_domain = [("id", "=", module.id)] + domain

                # Search for modules matching the domain
                matching_modules = self.search(full_domain)

                # If we find a match, stop traversal
                if matching_modules:
                    return True

            except Exception as e:
                _logger.error(f"Error processing domain {domain}: {e}")

        return False

    def _check_module_exclusion(self, module, options):
        """
        Check if a module should be excluded from the graph based on exclude_domains.

        Args:
            module: The module record to check
            options: Dictionary of options with optional exclude_domains

        Returns:
            Boolean indicating if module should be excluded
        """
        # If no exclude domains, don't exclude
        if not options.get("exclude_domains"):
            return False

        # Check each domain in exclude_domains
        for domain in options.get("exclude_domains", []):
            # Ensure domain is a list
            if not isinstance(domain, list):
                continue

            try:
                # Create a domain with the current module ID
                full_domain = [("id", "=", module.id)] + domain

                # Search for modules matching the domain
                matching_modules = self.search(full_domain)

                # If we find a match, exclude the module
                if matching_modules:
                    return True

            except Exception as e:
                _logger.error(f"Error processing domain {domain}: {e}")

        return False
