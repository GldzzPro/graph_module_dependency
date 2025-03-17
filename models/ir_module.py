from odoo import models, api


class Module(models.Model):
    _inherit = "ir.module.module"

    @api.model
    def get_module_graph(self, module_ids, options=None):
        """
        Generate a dependency graph for the specified module IDs with custom stop conditions.

        Args:
            module_ids (list): List of module IDs to generate the graph for
            options (dict, optional): Dictionary containing graph options:
                - max_depth (int): Maximum recursion depth
                - stop_conditions (list): List of condition objects:
                    [{'type': 'installed', 'value': True},
                     {'type': 'category', 'value': category_id},
                     {'type': 'non_custom', 'value': True},
                     {'type': 'custom_domain', 'value': [domain_expr]}]
                - current_depth (int): Current recursion depth (used internally)

        Returns:
            dict: Dictionary containing nodes and edges of the graph
        """
        options = options or {}
        current_depth = options.get("current_depth", 0)
        max_depth = options.get("max_depth", False)
        stop_conditions = options.get("stop_conditions", [])

        # Check if we've reached the maximum depth
        if max_depth and current_depth >= max_depth:
            return {"nodes": [], "edges": []}

        nodes = []
        edges = []

        # Get modules by IDs
        modules = (
            self.browse(module_ids)
            if isinstance(module_ids, list)
            else self.browse([module_ids])
        )

        for module in modules:
            # Add the current module to nodes
            module_data = {
                "id": module.id,
                "label": module.name,
                "state": module.state,
                "depth": current_depth,
            }

            # Add category information if available
            if hasattr(module, "category_id") and module.category_id:
                module_data["category"] = module.category_id.name
                module_data["category_id"] = module.category_id.id

            # Add custom flag if available
            if hasattr(module, "is_custom"):
                module_data["is_custom"] = module.is_custom

            nodes.append(module_data)

            # Check if we should stop recursion based on stop conditions
            if self._should_stop_recursion(module, stop_conditions):
                continue

            # Process dependencies with incremented depth
            dependency_options = dict(options)
            dependency_options["current_depth"] = current_depth + 1

            # Process dependencies
            dependency_modules = []
            for dependency in module.dependencies_id:
                depended_module = dependency.depend_id
                dependency_modules.append(depended_module.id)
                edges.append(
                    {"from": module.id, "to": depended_module.id, "type": "dependency"}
                )

            if dependency_modules:
                res = self.get_module_graph(dependency_modules, dependency_options)
                nodes.extend(res["nodes"])
                edges.extend(res["edges"])

            # Process exclusions with the same approach
            exclusion_modules = []
            for exclusion in module.exclusion_ids:
                excluded_module = exclusion.exclusion_id
                exclusion_modules.append(excluded_module.id)
                edges.append(
                    {"from": module.id, "to": excluded_module.id, "type": "exclusion"}
                )

            if exclusion_modules:
                res = self.get_module_graph(exclusion_modules, dependency_options)
                nodes.extend(res["nodes"])
                edges.extend(res["edges"])

        # De-duplicate nodes and edges
        unique_nodes = list({node["id"]: node for node in nodes}.values())
        unique_edges = list(
            {"%s-%s" % (edge["from"], edge["to"]): edge for edge in edges}.values()
        )

        return {"nodes": unique_nodes, "edges": unique_edges}

    def _should_stop_recursion(self, module, stop_conditions):
        """
        Check if recursion should stop based on the given stop conditions.

        Args:
            module: The module record to check
            stop_conditions: List of condition objects

        Returns:
            bool: True if recursion should stop, False otherwise
        """
        if not stop_conditions:
            return False

        # Check each stop condition
        for condition in stop_conditions:
            condition_type = condition.get("type")
            condition_value = condition.get("value")

            if not condition_type:
                continue

            # Check condition based on type
            if condition_type == "installed" and module.state == "installed":
                return True

            elif condition_type == "uninstallable" and module.state == "uninstallable":
                return True

            elif condition_type == "category" and hasattr(module, "category_id"):
                if (
                    isinstance(condition_value, str)
                    and module.category_id.name == condition_value
                ) or (
                    isinstance(condition_value, int)
                    and module.category_id.id == condition_value
                ):
                    return True

            elif (
                condition_type == "non_custom"
                and hasattr(module, "is_custom")
                and not module.is_custom
            ):
                return True

            elif condition_type == "custom_domain":
                # Apply custom domain filter
                matching_modules = self.env["ir.module.module"].search(
                    [("id", "=", module.id)] + condition_value
                )
                if matching_modules:
                    return True

        return False
