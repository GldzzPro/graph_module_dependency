# -*- coding: utf-8 -*-
{
    "name": "Graph Module Dependency",
    "summary": """Graph Module Dependency""",
    "author": "Kochyn's Band",
    "website": "https://github.com/kochyns-band/module_dependency_graph",
    "category": "Tools",
    "version": "17.0.1.0.0",
    "depends": [
        "base",
        "web",
    ],
    "data": [
        "views/ir_module.xml",
        "views/dependency_menus.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "graph_module_dependency/static/src/components/module_graph/GraphModuleComponent.js",
            "graph_module_dependency/static/src/components/model_graph/GraphModelComponent.js",
            "graph_module_dependency/static/src/components/module_graph/module_graph.xml",
            "graph_module_dependency/static/src/components/model_graph/model_graph.scss",
            "graph_module_dependency/static/src/components/module_graph/module_graph.scss",
            "graph_module_dependency/static/src/components/model_graph/model_graph.xml",
        ],
    },
    "images": ["static/description/banner.png"],
    "license": "AGPL-3",
    "installable": True,
    "application": False,
}
