from odoo import models, api, fields


class Module(models.Model):
    _inherit = "ir.module.module"

    @api.model
    def get_module_graph(self, module_ids, options=None):
        """
        Generate a dependency graph for the specified module IDs with custom stop conditions.

        Args:
            module_ids (list): List of module IDs to generate the graph for
            options (dict, optional): Dictionary containing stop conditions:
                - max_depth (int): Maximum recursion depth
                - stop_on_installed (bool): Stop when an installed module is found
                - stop_on_uninstallable (bool): Stop when an uninstallable module is found
                - stop_on_category (str/int): Stop when a module with this category is found
                - stop_on_non_custom (bool): Stop when a non-custom module is found
                - custom_filter (dict): Custom domain filter to stop recursion
                - current_depth (int): Current recursion depth (used internally)

        Returns:
            dict: Dictionary containing nodes and edges of the graph
        """
        if options is None:
            options = {}

        if "current_depth" not in options:
            options["current_depth"] = 0

        # Get the max depth (default to no limit if not specified)
        max_depth = options.get("max_depth", False)

        # Check if we've reached the maximum depth
        if max_depth and options["current_depth"] >= max_depth:
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
                "depth": options["current_depth"],
            }

            # Add category information if available
            if hasattr(module, "category_id") and module.category_id:
                module_data["category"] = module.category_id.name
                module_data["category_id"] = module.category_id.id

            # Add custom flag if available
            if hasattr(module, "is_custom"):
                module_data["is_custom"] = module.is_custom

            nodes.append(module_data)

            # Check stop conditions for the current module
            should_stop = False

            if options.get("stop_on_installed") and module.state == "installed":
                should_stop = True

            elif (
                options.get("stop_on_uninstallable") and module.state == "uninstallable"
            ):
                should_stop = True

            elif options.get("stop_on_category") and hasattr(module, "category_id"):
                category_value = options.get("stop_on_category")
                if (
                    isinstance(category_value, str)
                    and module.category_id.name == category_value
                ) or (
                    isinstance(category_value, int)
                    and module.category_id.id == category_value
                ):
                    should_stop = True

            elif (
                options.get("stop_on_non_custom")
                and hasattr(module, "is_custom")
                and not module.is_custom
            ):
                should_stop = True

            elif options.get("custom_filter"):
                # Apply custom domain filter
                custom_filter = options.get("custom_filter")
                matching_modules = self.env["ir.module.module"].search(
                    [("id", "=", module.id)] + custom_filter
                )
                if matching_modules:
                    should_stop = True

            # If we should stop at this module, don't traverse its dependencies
            if should_stop:
                continue

            # Process dependencies with incremented depth
            dependency_options = dict(options)
            dependency_options["current_depth"] = options["current_depth"] + 1

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
