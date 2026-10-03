# VADA tabletop room brief

Stage: interactive procedural prototype, not a final exported room asset.

The hero is a limestone parliament with a bronze dome and an open six-column portico. Twenty tiles form a continuous clockwise route around it. Twelve income buildings use four visible families: trade awnings, industrial chimneys, media antennae, and logistics crates. Five original NUMBRA pawns gather on individual council seats or travel to route tiles.

The camera is orbit-only; there is no first-person movement or architectural traversal. The portico is open geometry. All doors and windows on solid building blocks are visibly closed or inset. The board, route, and council seats support one persistent game state; no click fabricates a hidden room transition.

No paid model generation, external models, Blender export, or texture-generation jobs were run. Static geometry is merged with material groups; custom pediment vertices include normals and UVs to match Babylon merge attributes. Dynamic pawn transforms remain independent. Babylon scene/engine and ResizeObserver are disposed on unmount; reduced-motion preference snaps pawn movement.

Visual direction: engraved country map on a warm wood table, teal background, limestone and aged bronze. Controls remain in accessible HTML; a flat map and full place list provide equivalent selections. Current pawns and buildings are original procedural placeholders awaiting the approved sculpture/art pipeline.

Validation: production browser screenshots in `screenshots/`, typechecking, real WebGL canvas creation, switching between 3D and flat view, and game-state placement. Human approval of the final room art has not been recorded. Exportable GLB assets, collision gates and full room traversal are outside this prototype.
