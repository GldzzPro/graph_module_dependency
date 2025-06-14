# UML Diagrams for Softifi Graph Module Dependency

This document contains UML diagrams that illustrate the architecture, workflows, and interactions within the Softifi Graph Module Dependency Odoo module.

## 1. Use Case Diagram

```plantuml
@startuml UseCase_GraphModuleDependency
!theme plain

actor "System Administrator" as Admin
actor "Developer" as Dev
actor "External System" as ExtSys

rectangle "Graph Module Dependency System" {
  usecase "View Module Graph" as UC1
  usecase "Analyze Dependencies" as UC2
  usecase "Filter Modules" as UC3
  usecase "Export Graph Data" as UC4
  usecase "Configure Graph Options" as UC5
  usecase "View Model Relations" as UC6
  usecase "Access via API" as UC7
  usecase "Search Modules" as UC8
  usecase "Navigate Module Details" as UC9
}

Admin --> UC1
Admin --> UC2
Admin --> UC3
Admin --> UC4
Admin --> UC5
Admin --> UC8
Admin --> UC9

Dev --> UC1
Dev --> UC2
Dev --> UC6
Dev --> UC7
Dev --> UC8

ExtSys --> UC7

UC1 ..> UC3 : <<includes>>
UC1 ..> UC8 : <<includes>>
UC2 ..> UC5 : <<extends>>
UC7 ..> UC4 : <<includes>>

@enduml
```

## 2. Class Diagram

```plantuml
@startuml Class_GraphModuleDependency
!theme plain

package "Controllers" {
  class GraphAPI {
    +module_graph(module_ids, options)
    +reverse_module_graph(module_ids, options)
    +category_module_graph(category_prefixes, options)
    +reverse_category_module_graph(category_prefixes, options)
    +model_graph(model_ids, options)
  }
  
  class ModuleGraphController {
    +get_module_graph_route(module_ids, options)
    +get_reverse_dependency_graph_route(module_ids, options)
    +get_category_module_graph_route(category_prefixes, options)
    +get_reverse_category_module_graph_route(category_prefixes, options)
  }
}

package "Models" {
  abstract class GraphBuilderMixin {
    +_build_graph_core(record_ids, options, callbacks)
    +_process_graph_relations(record, get_relations, create_edge, options)
    +_process_graph_exclusions(record, get_exclusions, create_edge, options)
  }
  
  class IrModuleModule {
    +get_module_graph(module_ids, options)
    +get_reverse_dependency_graph(module_ids, options)
    +get_category_module_graph(category_prefixes, options)
    +get_reverse_category_module_graph(category_prefixes, options)
    +_get_module_dependencies(module)
    +_get_reverse_module_dependencies(module)
    +_create_module_node(module, options)
    +_should_stop_graph_traversal(module, options)
  }
  
  class IrModel {
    +get_model_relation_graph(model_ids, max_depth)
    +_get_model_relations(model)
    +_create_model_node(model, options)
  }
  
  class ModuleCategoryHelper {
    +get_modules_by_category_prefixes(category_prefixes, options)
    +_match_category_prefix(category, prefix, exact_match)
  }
}

package "Frontend Components" {
  class GraphModuleComponent {
    -state: Object
    -network: vis.Network
    +setup()
    +onMounted()
    +setupNetworkEvents()
    +createNodeObject(dataNode)
    +showModuleInfo(moduleId)
    +updateGraph()
    +onInputKeyup(event)
    +onClickModule(event)
  }
  
  class GraphModelComponent {
    -state: Object
    -network: vis.Network
    +setup()
    +onMounted()
    +onInputKeyup(event)
    +onChangeDepth(event)
    +onClickModel(event)
  }
}

GraphAPI --> IrModuleModule : uses
GraphAPI --> IrModel : uses
ModuleGraphController --> IrModuleModule : uses
IrModuleModule --|> GraphBuilderMixin : extends
IrModel --|> GraphBuilderMixin : extends
IrModuleModule --> ModuleCategoryHelper : uses
GraphModuleComponent --> GraphAPI : calls
GraphModelComponent --> GraphAPI : calls

@enduml
```

## 3. Sequence Diagram - Module Graph Generation

```plantuml
@startuml Sequence_ModuleGraphGeneration
!theme plain

participant "Frontend\nComponent" as Frontend
participant "GraphAPI\nController" as API
participant "IrModuleModule\nModel" as Module
participant "GraphBuilder\nMixin" as Builder
participant "Database" as DB

activate Frontend
Frontend -> API: POST /api/graph/module\n{module_ids, options}
activate API

API -> Module: get_module_graph(module_ids, options)
activate Module

Module -> Builder: _build_graph_core(record_ids, options, callbacks)
activate Builder

Builder -> DB: browse(module_ids)
activate DB
DB --> Builder: module_records
deactivate DB

loop for each module
  Builder -> Module: _create_module_node(module, options)
  activate Module
  Module --> Builder: node_data
  deactivate Module
  
  Builder -> Module: _get_module_dependencies(module)
  activate Module
  Module -> DB: search dependencies
  activate DB
  DB --> Module: dependency_records
  deactivate DB
  Module --> Builder: dependencies
  deactivate Module
  
  alt if not max_depth reached
    Builder -> Builder: recursive call for dependencies
  end
end

Builder --> Module: {nodes, edges}
deactivate Builder

Module --> API: graph_data
deactivate Module

API --> Frontend: JSON response\n{nodes, edges}
deactivate API

Frontend -> Frontend: render_graph(graph_data)
deactivate Frontend

@enduml
```

## 4. Activity Diagram - Graph Visualization Workflow

```plantuml
@startuml Activity_GraphVisualization
!theme plain

|User|
start
:Open Module Graph View;

|System|
:Load vis.js Library;
:Fetch Module Data from ORM;
:Initialize Empty Graph;

|User|
:Configure Graph Options;
note right
  - Max Depth
  - Direction (forward/reverse)
  - Stop Conditions
  - Category Filters
end note

|System|
:Apply Filters to Module List;

|User|
:Select Modules for Analysis;

fork
  |System|
  :Build Dependency Graph;
  :Process Module Dependencies;
  :Create Nodes and Edges;
fork again
  |System|
  :Check for Cycles;
  :Mark Cyclic Dependencies;
end fork

:Render Graph with vis.js;

|User|
while (Interacting with Graph?) is (yes)
  fork
    :Double-click Node;
    |System|
    :Open Module Form View;
  fork again
    :Right-click Node;
    |System|
    :Remove Node from Graph;
  fork again
    :Search/Filter;
    |System|
    :Update Graph Display;
  fork again
    :Change Graph Options;
    |System|
    :Rebuild Graph;
  end fork
endwhile (no)

|User|
:Export or Save Results;

stop

@enduml
```

## 5. Activity Diagram with Pools - API Request Processing

```plantuml
@startuml Activity_APIProcessing
!theme plain

|#LightBlue|External Client|
|#LightGreen|Odoo Server|
|#LightYellow|Database|

|External Client|
start
:Prepare JSON-RPC Request;
note right
  {
    "method": "call",
    "params": {
      "module_ids": [1, 2, 3],
      "options": {
        "max_depth": 2,
        "stop_domains": [...]
      }
    }
  }
end note

:Send HTTP POST to\n/api/graph/module;

|Odoo Server|
:Receive Request;
:Validate Parameters;

if (Valid Parameters?) then (yes)
  :Extract module_ids and options;
  
  fork
    :Initialize Graph Builder;
  fork again
    :Set Traversal Options;
  end fork
  
  |Database|
  :Query Module Records;
  :Fetch Dependencies;
  :Return Module Data;
  
  |Odoo Server|
  :Build Graph Structure;
  
  while (More Dependencies?) is (yes)
    if (Max Depth Reached?) then (no)
      |Database|
      :Query Next Level Dependencies;
      :Return Dependency Data;
      
      |Odoo Server|
      :Process Dependencies;
      :Check for Cycles;
      :Add Nodes and Edges;
    else (yes)
      :Stop Traversal;
    endif
  endwhile (no)
  
  :Format Response Data;
  :Create JSON Response;
  
else (no)
  :Create Error Response;
endif

:Send HTTP Response;

|External Client|
:Receive Response;

if (Success Response?) then (yes)
  :Parse Graph Data;
  :Process Nodes and Edges;
  :Visualize or Store Results;
else (no)
  :Handle Error;
  :Log Error Message;
endif

stop

@enduml
```

## Diagram Descriptions

### Use Case Diagram
Shows the main actors (System Administrator, Developer, External System) and their interactions with the graph module dependency system. Key use cases include viewing graphs, analyzing dependencies, filtering modules, and accessing data via API.

### Class Diagram
Illustrates the main classes and their relationships across three packages:
- **Controllers**: Handle HTTP requests and route them to appropriate models
- **Models**: Contain business logic for graph generation and data processing
- **Frontend Components**: Manage user interface and visualization

### Sequence Diagram
Details the flow of a typical module graph generation request, showing interactions between frontend, API controller, model classes, and database.

### Activity Diagrams
1. **Graph Visualization Workflow**: Shows the complete user workflow from opening the graph view to interacting with the visualization
2. **API Request Processing**: Demonstrates the server-side processing of API requests with pools showing different system layers
