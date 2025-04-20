from odoo import models, api
import logging
from .graph_builder import GraphBuilderMixin

_logger = logging.getLogger(__name__)


class Module(models.Model):
    _name = 'ir.module.module'
    _inherit = ["ir.module.module", "graph.builder.mixin"]

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
        
        # Use the shared graph builder core
        return self._build_graph_core(
            record_ids=module_ids,
            options=options,
            get_relations=self._get_module_dependencies,
            get_exclusions=self._get_module_exclusions,
            create_node=self._create_module_node,
            create_relation_edge=lambda m, d: {
                "from": m.id,
                "to": d.id,
                "type": "dependency",
            },
            create_exclusion_edge=lambda m, e: {
                "from": m.id,
                "to": e.id,
                "type": "exclusion",
            },
            should_stop_traversal=self._should_stop_graph_traversal,
            check_exclusion=self._check_module_exclusion,
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
        
        # Use the shared graph builder core
        return self._build_graph_core(
            record_ids=module_ids,
            options=options,
            get_relations=self._get_reverse_module_dependencies,
            get_exclusions=self._get_reverse_module_exclusions,
            create_node=self._create_module_node,
            create_relation_edge=lambda m, d: {
                "from": d.id,
                "to": m.id,
                "type": "reverse_dependency",
            },
            create_exclusion_edge=lambda m, e: {
                "from": e.id,
                "to": m.id,
                "type": "reverse_exclusion",
            },
            should_stop_traversal=self._should_stop_graph_traversal,
            check_exclusion=self._check_module_exclusion,
        )

    # Module-specific helper methods for graph building
    
    def _get_module_dependencies(self, module):
        """Get module dependencies."""
        return [d.depend_id for d in module.dependencies_id]
    
    def _get_module_exclusions(self, module):
        """Get module exclusions."""
        return [e.exclusion_id for e in getattr(module, "exclusion_ids", [])]
    
    def _get_reverse_module_dependencies(self, module):
        """Get modules that depend on this module."""
        return self.search(
            [
                (
                    "dependencies_id.depend_id",
                    "in",
                    [module.id],
                )
            ]
        )
    
    def _get_reverse_module_exclusions(self, module):
        """Get modules that exclude this module."""
        return self.search(
            [
                (
                    "exclusion_ids.exclusion_id",
                    "in",
                    [module.id],
                )
            ]
        )
    
    def _create_module_node(self, module, options):
        """Create a node dictionary for a module record."""
        node_data = {
            "id": module.id,
            "label": module.name,
            "state": module.state,
            "depth": options.get("current_depth", 0),
        }
        try:
            category = module.read(["category_id"])
            if category and category[0].get("category_id"):
                cat_id, cat_name = category[0]["category_id"]
                node_data.update({
                    "category": cat_name,
                    "category_id": cat_id,
                })
        except Exception:
            # Skip category if not accessible
            pass
        if hasattr(module, "is_custom"):
            node_data["is_custom"] = module.is_custom
        return node_data
    
    def _create_node_data(self, record, options):
        """Override from graph.builder.mixin to use module-specific node creation."""
        return self._create_module_node(record, options)

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
