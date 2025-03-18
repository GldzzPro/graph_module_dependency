# -*- coding: utf-8 -*-
{
    "name": "Graph Module Dependency",
    "summary": """Graph Module Dependency""",
    "author": "Farhat BAAROUN",
    "website": "https://github.com/GldzzPro/graph_module_dependency",
    "category": "Tools",
    "version": "17.0.1.0.0",
    "depends": [
        "base",
        "web",
    ],
    "data": [
        "security/ir.model.access.csv",
        "views/dependency_menus.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "graph_module_dependency/static/src/components/module_graph/ModuleTest.js",
            "graph_module_dependency/static/src/components/module_graph/GraphModuleComponent.js",
            "graph_module_dependency/static/src/components/model_graph/GraphModelComponent.js",
            "graph_module_dependency/static/src/components/module_graph/module_graph.xml",
            "graph_module_dependency/static/src/components/model_graph/model_graph.scss",
            "graph_module_dependency/static/src/components/module_graph/module_graph.scss",
            "graph_module_dependency/static/src/components/model_graph/model_graph.xml",
            "graph_module_dependency/static/src/components/module_graph/test.xml",
        ],
    },
    "images": ["static/description/banner.png"],
    "license": "AGPL-3",
    "installable": True,
    "application": False,
}
