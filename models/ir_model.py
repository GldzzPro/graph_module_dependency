from odoo import models, api


class Model(models.Model):
    _inherit = "ir.model"

    def get_model_relation_graph(
        self, max_depth=2, current_depth=0, visited_models=None
    ):
        """
        Generate a graph representation of model relations based on foreign keys.
        Returns a dictionary with nodes and edges similar to module dependency graph.

        Parameters:
            max_depth (int): Maximum recursion depth to prevent infinite loops
            current_depth (int): Current recursion depth (used internally)
            visited_models (set): Set of already visited model IDs to prevent cycles

        Returns:
            dict: Dictionary with 'nodes' and 'edges' lists representing the graph
        """
        # Initialize visited_models set if not provided
        if visited_models is None:
            visited_models = set()

        nodes = []
        edges = []

        for model in self:
            # Skip if we've already visited this model to prevent cycles
            if model.id in visited_models:
                continue

            # Add current model to visited set
            visited_models.add(model.id)

            # Add current model as a node
            nodes.append(
                {
                    "id": model.id,
                    "label": model.name,
                    "model": model.model,
                }
            )

            # Stop recursion if we've reached max depth
            if current_depth >= max_depth:
                continue

            # Get all fields of this model that are relational
            relational_fields = self.env["ir.model.fields"].search(
                [
                    ("model_id", "=", model.id),
                    ("ttype", "in", ["many2one", "one2many", "many2many"]),
                ]
            )

            # Process each relational field
            for field in relational_fields:
                # Get the target model
                if field.relation:
                    target_model = self.env["ir.model"].search(
                        [("model", "=", field.relation)], limit=1
                    )
                    if target_model:
                        # Add the target model as a node only if it wasn't already visited
                        if target_model.id not in visited_models:
                            nodes.append(
                                {
                                    "id": target_model.id,
                                    "label": target_model.name,
                                    "model": target_model.model,
                                }
                            )

                        # Add an edge between current model and target model
                        edge_key = f"{model.id}-{target_model.id}"
                        edges.append(
                            {
                                "from": model.id,
                                "to": target_model.id,
                                "field": field.name,
                                "type": field.ttype,
                            }
                        )

                        # Recursively get related models with increased depth
                        if target_model.id not in visited_models:
                            res = target_model.get_model_relation_graph(
                                max_depth=max_depth,
                                current_depth=current_depth + 1,
                                visited_models=visited_models,
                            )
                            nodes.extend(res["nodes"])
                            edges.extend(res["edges"])

        # Ensure uniqueness of nodes and edges
        unique_nodes = list({node["id"]: node for node in nodes}.values())
        unique_edges = list(
            {"%s-%s" % (edge["from"], edge["to"]): edge for edge in edges}.values()
        )

        return {"nodes": unique_nodes, "edges": unique_edges}
