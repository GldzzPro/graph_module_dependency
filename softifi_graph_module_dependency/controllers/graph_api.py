# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class GraphAPI(http.Controller):
    """Controller providing JSON-RPC endpoints for graph functionality."""

    @http.route('/api/graph/module', type='json', auth='public', csrf=False)
    def module_graph(self, module_ids, options, **kwargs):
        """
        Get module dependency graph data.
        """
        result = request.env['ir.module.module'].sudo().get_module_graph(
            module_ids, 
            options
        )
        return result

    @http.route('/api/graph/reverse', type='json', auth='public', csrf=False)
    def reverse_module_graph(self, module_ids, options, **kwargs):
        result = request.env['ir.module.module'].sudo().get_reverse_dependency_graph(
            module_ids,
            options
        )
        return result

    @http.route('/api/graph/model', type='json', auth='public', csrf=False)
    def model_graph(self, model_ids, options, **kwargs):
        result = request.env['ir.model'].sudo().get_model_relation_graph(
            model_ids,
            options.get('max_depth', None)
        )
        return result