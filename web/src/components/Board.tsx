import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents.js";
import {
  ASSETS,
  CREATURES,
  GROUPS,
  TILE_NAMES,
  creature,
} from "../../../shared/content.js";
import type { GameView } from "../../../shared/types.js";
export const TILE_COORDS: { x: number; z: number }[] = [
  ...[-10, -6, -2, 2, 6, 10].map((x) => ({ x, z: -10 })),
  ...[-6, -2, 2, 6, 10].map((z) => ({ x: 10, z })),
  ...[6, 2, -2, -6, -10].map((x) => ({ x, z: 10 })),
  ...[6, 2, -2, -6].map((z) => ({ x: -10, z })),
];
interface Runtime {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  tiles: StandardMaterial[];
  markers: Mesh[];
  pawns: Map<string, { root: TransformNode; target: Vector3 }>;
  shadow: ShadowGenerator;
  phase: string;
}
function buildScene(
  canvas: HTMLCanvasElement,
  onTile: (tile: number | null) => void,
): Runtime {
  const engine = new Engine(
    canvas,
    true,
    {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      powerPreference: "high-performance",
    },
    true,
  );
  try {
    engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString("#142b33ff");
    scene.ambientColor = Color3.FromHexString("#829c9d");
    scene.imageProcessingConfiguration.exposure = 1.0;
    scene.imageProcessingConfiguration.contrast = 1.1;
    const camera = new ArcRotateCamera(
      "table-camera",
      Math.PI / 3.65,
      0.94,
      45,
      new Vector3(0, 0.8, 0),
      scene,
    );
    camera.lowerRadiusLimit = 24;
    camera.upperRadiusLimit = 64;
    camera.lowerBetaLimit = 0.48;
    camera.upperBetaLimit = 1.22;
    camera.wheelPrecision = 35;
    camera.panningSensibility = 0;
    camera.attachControl(canvas, true);
    camera.inputs.attached.keyboard?.detachControl();
    const ambient = new HemisphericLight(
      "sky",
      new Vector3(-0.3, 1, 0.4),
      scene,
    );
    ambient.intensity = 0.67;
    ambient.groundColor = Color3.FromHexString("#2c4650");
    const sun = new DirectionalLight(
      "window-light",
      new Vector3(-0.5, -1, -0.35),
      scene,
    );
    sun.position = new Vector3(12, 24, 8);
    sun.intensity = 0.82;
    const shadow = new ShadowGenerator(1024, sun);
    shadow.usePercentageCloserFiltering = true;
    shadow.filteringQuality = ShadowGenerator.QUALITY_LOW;
    shadow.bias = 0.002;
    shadow.normalBias = 0.04;
    const material = (name: string, color: string, metal = false) => {
      const m = new StandardMaterial(name, scene);
      m.diffuseColor = Color3.FromHexString(color);
      m.specularColor = metal
        ? new Color3(0.45, 0.35, 0.17)
        : new Color3(0.07, 0.08, 0.08);
      m.specularPower = metal ? 48 : 18;
      return m;
    };
    const stone = material("warm limestone", "#cfccb5"),
      stoneDark = material("cut stone", "#8b9386"),
      bronze = material("aged bronze", "#9b7b42", true),
      gold = material("gold trim", "#d0aa65", true);
    const timber = material("dark timber", "#584438"),
      board = material("board enamel", "#425a59"),
      ink = material("window inset", "#223c47"),
      paper = material("paper", "#eddfbf");
    const ground = MeshBuilder.CreateGround(
      "chamber floor",
      { width: 300, height: 300 },
      scene,
    );
    ground.material = material("room", "#182e35");
    ground.position.y = -0.72;
    ground.receiveShadows = true;
    ground.isPickable = false;
    const statics: Mesh[] = [];
    function box(
      name: string,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: StandardMaterial,
      list = statics,
    ) {
      const mesh = MeshBuilder.CreateBox(
        name,
        { width: w, height: h, depth: d },
        scene,
      );
      mesh.position.set(x, y, z);
      mesh.material = m;
      mesh.receiveShadows = true;
      list.push(mesh);
      return mesh;
    }
    function cylinder(
      name: string,
      diameter: number,
      height: number,
      x: number,
      y: number,
      z: number,
      m: StandardMaterial,
      list = statics,
      top?: number,
      sides = 24,
    ) {
      const mesh = MeshBuilder.CreateCylinder(
        name,
        {
          diameterBottom: diameter,
          diameterTop: top ?? diameter,
          height,
          tessellation: sides,
        },
        scene,
      );
      mesh.position.set(x, y, z);
      mesh.material = m;
      list.push(mesh);
      return mesh;
    }
    function sphere(
      name: string,
      d: number,
      x: number,
      y: number,
      z: number,
      m: StandardMaterial,
      list = statics,
    ) {
      const mesh = MeshBuilder.CreateSphere(
        name,
        { diameter: d, segments: 12 },
        scene,
      );
      mesh.position.set(x, y, z);
      mesh.material = m;
      list.push(mesh);
      return mesh;
    }
    function merge(list: Mesh[], tile?: number | null) {
      if (!list.length) return;
      const m = Mesh.MergeMeshes(list, true, true, undefined, false, true);
      if (m) {
        m.receiveShadows = true;
        m.metadata = tile !== undefined ? { tile } : {};
        m.isPickable = tile !== undefined;
        shadow.addShadowCaster(m);
        m.freezeWorldMatrix();
      }
    }
    box("wood tabletop", 29, 0.55, 29, 0, -0.43, 0, timber);
    box("brass underlay", 28.5, 0.11, 28.5, 0, -0.1, 0, gold);
    box("country board", 28, 0.26, 28, 0, 0.05, 0, board);
    for (const side of [-1, 1]) {
      box("frame rail", 0.25, 0.25, 28.2, side * 14.0, 0.24, 0, bronze);
      box("frame rail", 28.2, 0.25, 0.25, 0, 0.24, side * 14.0, bronze);
    }
    cylinder(
      "central stone reserve",
      12,
      0.22,
      0,
      0.28,
      0,
      stoneDark,
      statics,
      12,
      64,
    );
    cylinder("central inset", 11.4, 0.09, 0, 0.43, 0, stone, statics, 11.4, 64);
    // All columns stand in a truly open portico, clear of the solid main block.
    box("parliament foundation", 10.5, 0.35, 6.4, 0, 0.56, -0.65, stone);
    box("central chamber", 5.4, 2.45, 3.3, 0, 1.94, -1, stone);
    for (const x of [-4, 4]) {
      box("parliament wing", 2.6, 1.85, 3.3, x, 1.64, -1, stone);
      box("wing cornice", 2.8, 0.22, 3.6, x, 2.67, -1, stoneDark);
      box("wing roof", 2.7, 0.24, 3.5, x, 2.9, -1, bronze);
      for (const wx of [-0.65, 0.65])
        box("closed window", 0.44, 0.85, 0.04, x + wx, 1.9, 0.67, ink);
    }
    box("drum cornice", 5.8, 0.23, 3.8, 0, 3.29, -1, stoneDark);
    cylinder("dome drum", 3.8, 0.58, 0, 3.68, -1, stone);
    const dome = sphere("bronze dome", 4.25, 0, 4.05, -1, bronze);
    dome.scaling.y = 0.62;
    cylinder("dome lantern", 0.7, 0.62, 0, 5.35, -1, gold, statics, 0.42);
    sphere("dome finial", 0.28, 0, 5.76, -1, gold);
    for (const x of [-2.7, -1.62, -0.54, 0.54, 1.62, 2.7]) {
      cylinder("column foot", 0.54, 0.14, x, 0.85, 1.35, stoneDark);
      cylinder("open portico column", 0.28, 2.1, x, 1.98, 1.35, stone);
      cylinder("column capital", 0.53, 0.15, x, 3.09, 1.35, stoneDark);
    }
    box("portico entablature", 6.4, 0.28, 1.18, 0, 3.28, 1.35, stoneDark);
    const pediment = new Mesh("triangular pediment", scene);
    const positions = [
      -3.2, 3.42, 0.7, 3.2, 3.42, 0.7, 0, 4.28, 0.7, -3.2, 3.42, 2, 3.2, 3.42,
      2, 0, 4.28, 2,
    ];
    const indices = [
        0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5,
      ],
      normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.uvs = Array((positions.length / 3) * 2).fill(0);
    vd.applyToMesh(pediment);
    pediment.material = stone;
    statics.push(pediment);
    // A closed leaf gives the entry a purpose without implying player traversal.
    box("closed council doors", 0.85, 1.6, 0.08, 0, 1.52, 0.68, bronze);
    for (let i = 0; i < 5; i++)
      box(
        "council stair",
        6.8,
        0.11,
        1.1,
        0,
        0.39 + i * 0.1,
        3.2 - i * 0.48,
        stoneDark,
      );
    for (let i = 0; i < 5; i++) {
      cylinder(
        "NUMBRA seat " + i,
        1.45,
        0.12,
        (i - 2) * 1.95,
        0.64,
        4.35,
        bronze,
      );
      cylinder(
        "seat inset " + i,
        1.16,
        0.025,
        (i - 2) * 1.95,
        0.71,
        4.35,
        board,
      );
    }
    merge(statics, null);
    const tiles: StandardMaterial[] = [],
      markers: Mesh[] = [];
    TILE_COORDS.forEach((pos, i) => {
      const asset = ASSETS.find((a) => a.tile === i),
        m = material(
          "tile-" + i,
          asset ? GROUPS[asset.group].color : "#819990",
        );
      tiles.push(m);
      const tile = MeshBuilder.CreateBox(
        "route-" + i,
        { width: 3.5, height: 0.16, depth: 3.5 },
        scene,
      );
      tile.position.set(pos.x, 0.31, pos.z);
      tile.material = m;
      tile.metadata = { tile: i };
      tile.receiveShadows = true;
      const rim = MeshBuilder.CreateBox(
        "route-rim-" + i,
        { width: 3.65, height: 0.11, depth: 3.65 },
        scene,
      );
      rim.position.set(pos.x, 0.22, pos.z);
      rim.material = bronze;
      rim.metadata = { tile: i };
      const props: Mesh[] = [];
      if (asset) {
        const building = material(
          "facade-" + asset.id,
          asset.group === "industry"
            ? "#b8866c"
            : asset.group === "media"
              ? "#a6baba"
              : asset.group === "logistics"
                ? "#bbc6a1"
                : "#e0ca98",
        );
        const roof = material(
          "roof-" + asset.id,
          asset.group === "industry"
            ? "#615857"
            : asset.group === "media"
              ? "#607b83"
              : asset.group === "logistics"
                ? "#60766d"
                : "#a0824e",
        );
        const x = pos.x,
          z = pos.z - 0.3,
          scale = asset.points === 3 ? 1.15 : 1;
        box(
          asset.id + " footing",
          2.8,
          0.15,
          2.15,
          x,
          0.46,
          z,
          stoneDark,
          props,
        );
        box(
          asset.id + " facade",
          2.35,
          1.35 * scale,
          1.65,
          x,
          0.59 + 0.675 * scale,
          z,
          building,
          props,
        );
        const hip = cylinder(
          asset.id + " pitched roof",
          3.4,
          0.85,
          x,
          1.26 + 1.35 * scale,
          z,
          roof,
          props,
          0,
          4,
        );
        hip.rotation.y = Math.PI / 4;
        hip.scaling.z = 0.78;
        for (const dx of [-0.65, 0.65])
          box(
            "window",
            0.37,
            0.43,
            0.03,
            x + dx,
            0.86 + 0.45 * scale,
            z + 0.845,
            ink,
            props,
          );
        box(
          "closed asset door",
          0.36,
          0.72,
          0.04,
          x,
          0.95,
          z + 0.846,
          timber,
          props,
        );
        if (asset.group === "industry") {
          cylinder(
            "chimney",
            0.38,
            1.8,
            x + 0.8,
            2.1,
            z - 0.45,
            stoneDark,
            props,
          );
          cylinder(
            "chimney rim",
            0.5,
            0.14,
            x + 0.8,
            3.03,
            z - 0.45,
            bronze,
            props,
          );
          box(
            "side workshop",
            0.75,
            0.65,
            1.5,
            x - 1.25,
            0.85,
            z,
            building,
            props,
          );
        }
        if (asset.group === "media") {
          cylinder("broadcast mast", 0.07, 1.1, x, 2.95, z, bronze, props);
          const eye = sphere("broadcast lens", 0.45, x, 3.42, z, bronze, props);
          eye.scaling.z = 0.35;
          sphere("lens", 0.24, x, 3.42, z + 0.09, ink, props);
        }
        if (asset.group === "trade") {
          box("market awning", 2.65, 0.11, 0.9, x, 1.64, z + 1.1, roof, props);
          for (const dx of [-1.2, 1.2])
            cylinder(
              "awning post",
              0.12,
              1.2,
              x + dx,
              1.02,
              z + 1.45,
              timber,
              props,
            );
        }
        if (asset.group === "logistics") {
          for (const dx of [-0.9, 0.8])
            box(
              "shipment crate",
              0.46,
              0.44,
              0.45,
              x + dx,
              0.69,
              z + 1.15,
              timber,
              props,
            );
        }
        merge(props, i);
      } else {
        cylinder(
          "waypoint medallion",
          1.3,
          0.035,
          pos.x,
          0.41,
          pos.z,
          bronze,
          props,
        );
        for (const dx of [-0.4, 0.4])
          cylinder(
            "garden post",
            0.16,
            0.52,
            pos.x + dx,
            0.63,
            pos.z,
            stone,
            props,
          );
        merge(props, i);
      }
      const label = MeshBuilder.CreateGround(
        "tile-label-" + i,
        { width: 1.0, height: 0.52 },
        scene,
      );
      label.position.set(pos.x, 0.42, pos.z + 1.3);
      label.metadata = { tile: i };
      const tex = new DynamicTexture(
        "tile-label-" + i,
        { width: 128, height: 64 },
        scene,
        false,
      );
      tex.hasAlpha = true;
      tex.drawText(
        String(i + 1),
        null,
        49,
        "bold 44px Georgia",
        "#1d343a",
        "transparent",
        true,
      );
      const lm = new StandardMaterial("label-" + i, scene);
      lm.diffuseTexture = tex;
      lm.specularColor = Color3.Black();
      lm.useAlphaFromDiffuseTexture = true;
      label.material = lm;
      const marker = MeshBuilder.CreateCylinder(
        "owner-" + i,
        { diameter: 0.42, height: 0.07, tessellation: 16 },
        scene,
      );
      marker.position.set(pos.x + 1.25, 0.46, pos.z + 1.15);
      marker.material = material("owner-material-" + i, "#d0aa65");
      marker.setEnabled(false);
      marker.isPickable = false;
      markers.push(marker);
    });
    const pawns = new Map<string, { root: TransformNode; target: Vector3 }>();
    CREATURES.forEach((c, index) => {
      const root = new TransformNode("NUMBRA-" + c.id, scene),
        pieces: Mesh[] = [];
      const body = material(c.id + " skin", c.color),
        eye = material(c.id + " ivory", "#faf3df"),
        pupil = material(c.id + " eye", "#18313d");
      const foot = cylinder(
        "pawn-base",
        1.08,
        0.13,
        0,
        0.06,
        0,
        bronze,
        pieces,
      );
      const b = sphere("body", 0.94, 0, 0.67, 0, body, pieces);
      b.scaling.set(0.86, 1.15, 0.7);
      const h = sphere("head", 1.18, 0, 1.32, 0, body, pieces);
      h.scaling.set(1, 0.9, 0.77);
      for (const dx of [-0.25, 0.25]) {
        const e = sphere("ivory eye", 0.32, dx, 1.39, 0.4, eye, pieces);
        e.scaling.set(0.9, 1.2, 0.42);
        const p = sphere("pupil", 0.16, dx + 0.018, 1.39, 0.463, pupil, pieces);
        p.scaling.set(0.87, 1.3, 0.4);
        sphere("catchlight", 0.06, dx + 0.04, 1.45, 0.492, eye, pieces);
        const f = sphere("paw", 0.31, dx, 0.24, 0.12, body, pieces);
        f.scaling.set(1.1, 0.65, 1.2);
        const arm = sphere("arm", 0.29, dx * 1.85, 0.75, 0.08, body, pieces);
        arm.scaling.set(0.65, 1.5, 0.65);
      }
      const mouth = sphere("smile", 0.33, 0, 1.02, 0.414, pupil, pieces);
      mouth.scaling.set(1, 0.25, 0.4);
      const fang = cylinder(
        "fang",
        0.06,
        0.12,
        0.08,
        0.99,
        0.46,
        eye,
        pieces,
        0,
        6,
      );
      fang.rotation.z = Math.PI;
      for (const side of [-1, 1]) {
        if (c.id === "OBFUSCO") {
          const e = sphere(
            "drooping ear",
            0.4,
            side * 0.53,
            1.4,
            0,
            body,
            pieces,
          );
          e.scaling.set(0.6, 1.8, 0.5);
          e.rotation.z = side * 0.5;
        } else {
          const e = cylinder(
            "ear",
            0.3,
            c.id === "MANIPUL" ? 0.85 : 0.58,
            side * 0.38,
            1.9,
            0,
            body,
            pieces,
            0,
            8,
          );
          e.rotation.z = -side * 0.3;
        }
      }
      if (c.id === "TRADOR") {
        const coin = cylinder(
          "coin",
          0.46,
          0.08,
          0.51,
          0.85,
          0.28,
          gold,
          pieces,
        );
        coin.rotation.x = Math.PI / 2;
      }
      if (c.id === "PACTA") {
        box(
          "sealed scroll",
          0.19,
          0.55,
          0.17,
          -0.48,
          0.85,
          0.22,
          paper,
          pieces,
        );
        for (const dx of [-0.22, 0, 0.22])
          cylinder("crown", 0.13, 0.25, dx, 1.88, 0.1, gold, pieces, 0, 6);
      }
      if (c.id === "MANIPUL")
        for (const side of [-1, 1]) {
          const tip = cylinder(
            "finger",
            0.04,
            0.29,
            side * 0.55,
            0.9,
            0.22,
            bronze,
            pieces,
            0,
            5,
          );
          tip.rotation.z = -side * 0.5;
        }
      for (const piece of pieces) {
        piece.parent = root;
        piece.isPickable = false;
        shadow.addShadowCaster(piece);
      }
      foot.receiveShadows = true;
      root.position.set((index - 2) * 1.95, 0.72, 4.35);
      pawns.set(c.id, { root, target: root.position.clone() });
    });
    const trees: Mesh[] = [];
    for (const [x, z] of [
      [-6.8, -5.2],
      [6.8, -5.2],
      [-6.8, 5.8],
      [6.8, 5.8],
      [-5.8, -6.4],
      [5.8, -6.4],
    ]) {
      cylinder("garden trunk", 0.17, 0.6, x, 0.7, z, timber, trees);
      const tree = sphere(
        "clipped cypress",
        1,
        x,
        1.4,
        z,
        material("foliage-" + x + "-" + z, "#668178"),
        trees,
      );
      tree.scaling.set(0.65, 1.6, 0.65);
    }
    merge(trees);
    scene.onPointerObservable.add((info) => {
      if (
        info.type === PointerEventTypes.POINTERTAP &&
        typeof info.pickInfo?.pickedMesh?.metadata?.tile !== "undefined"
      )
        onTile(info.pickInfo.pickedMesh.metadata.tile);
    });
    engine.runRenderLoop(() => {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      for (const pawn of pawns.values())
        if (reduced) pawn.root.position.copyFrom(pawn.target);
        else
          Vector3.LerpToRef(
            pawn.root.position,
            pawn.target,
            0.12,
            pawn.root.position,
          );
      scene.render();
    });
    return {
      engine,
      scene,
      camera,
      tiles,
      markers,
      pawns,
      shadow,
      phase: "preview",
    };
  } catch (error) {
    engine.dispose();
    throw error;
  }
}
function updateRuntime(
  r: Runtime,
  view: GameView | null,
  selection: number | null | undefined,
) {
  const players: { id: string; creature: string; position: number | null }[] =
    view?.players ??
    CREATURES.map((c, i) => ({
      id: "preview-" + i,
      creature: c.id,
      position: null,
    }));
  for (const [id, pawn] of r.pawns) {
    const p = players.find((p) => p.creature === id);
    pawn.root.setEnabled(!!p);
    if (!p) continue;
    const idx = players.indexOf(p);
    if (p.position === null)
      pawn.target.set((idx - (players.length - 1) / 2) * 1.95, 0.72, 4.35);
    else {
      const spot = TILE_COORDS[p.position],
        others = players.filter((x) => x.position === p.position),
        offset = (others.indexOf(p) - (others.length - 1) / 2) * 0.65;
      pawn.target.set(spot.x + offset, 0.41, spot.z + 1.0);
    }
  }
  r.tiles.forEach((m, i) => {
    m.emissiveColor =
      i === selection ? Color3.FromHexString("#665434") : Color3.Black();
    const asset = ASSETS.find((a) => a.tile === i),
      owner = asset && view?.assets[asset.id].owner;
    r.markers[i].setEnabled(!!owner);
    if (owner) {
      const p = view!.players.find((p) => p.id === owner)!;
      (r.markers[i].material as StandardMaterial).diffuseColor =
        Color3.FromHexString(creature(p.creature).color);
    }
  });
  const phase = view?.phase ?? "preview";
  const session = ["proposal", "debate", "vote"].includes(phase);
  if (phase !== r.phase) {
    if (session && !["proposal", "debate", "vote"].includes(r.phase))
      r.camera.radius = 33;
    else if (!session && ["proposal", "debate", "vote"].includes(r.phase))
      r.camera.radius = 45;
    r.phase = phase;
  }
}
export function Board({
  view = null,
  selection,
  onSelect,
  className = "",
}: {
  view?: GameView | null;
  selection?: number | null;
  onSelect?: (tile: number | null) => void;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    runtime = useRef<Runtime | null>(null),
    handler = useRef(onSelect);
  const [failed, setFailed] = useState(false),
    [flat, setFlat] = useState(false);
  handler.current = onSelect;
  useEffect(() => {
    if (flat) return;
    let r: Runtime;
    try {
      r = buildScene(canvas.current!, (tile) => handler.current?.(tile));
      runtime.current = r;
      updateRuntime(r, view, selection);
    } catch (error) {
      console.error("VADA 3D initialization failed", error);
      setFailed(true);
      return;
    }
    const resize = new ResizeObserver(() => r.engine.resize());
    resize.observe(canvas.current!);
    return () => {
      resize.disconnect();
      r.scene.dispose();
      r.engine.dispose();
      runtime.current = null;
    };
  }, [flat]);
  useEffect(() => {
    if (runtime.current) updateRuntime(runtime.current, view, selection);
  }, [view, selection]);
  return (
    <div className={"board " + className}>
      {!flat && !failed ? (
        <canvas
          ref={canvas}
          aria-label="3D-карта країни VADA. Для вибору клавіатурою скористайтесь списком місць нижче."
        />
      ) : (
        <div className="flat-board">
          <div className="flat-parliament">
            <span>VΛDΛ</span>
            <strong>Парламент</strong>
            <small>
              {view
                ? view.players.filter((p) => p.position === null).length
                : 5}{" "}
              NUMBRA у залі
            </small>
            <button onClick={() => onSelect?.(null)}>Оглянути</button>
          </div>
          {TILE_COORDS.map((p, i) => {
            const a = ASSETS.find((a) => a.tile === i);
            return (
              <button
                key={i}
                className={"flat-tile " + (selection === i ? "selected" : "")}
                style={{
                  left: ((p.x + 12) / 24) * 78 + 6 + "%",
                  top: ((p.z + 12) / 24) * 78 + 6 + "%",
                  borderColor: a ? GROUPS[a.group].color : "var(--line)",
                }}
                onClick={() => onSelect?.(i)}
                aria-label={TILE_NAMES[i]}
              >
                {i + 1}
                <span>{a ? GROUPS[a.group].name : "Площа"}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="board-tools">
        <button className="quiet small" onClick={() => setFlat(!flat)}>
          {flat ? "Об’ємна карта" : "Плоска карта"}
        </button>
        {!flat && !failed && (
          <button
            className="quiet small"
            onClick={() => {
              if (runtime.current) {
                runtime.current.camera.alpha = Math.PI / 3.65;
                runtime.current.camera.beta = 0.94;
                runtime.current.camera.radius = 45;
              }
            }}
          >
            Скинути камеру
          </button>
        )}
      </div>
      {!flat && !failed && (
        <div className="camera-hint">
          Потягніть, щоб обертати · коліщатко для масштабу
        </div>
      )}
      {failed && !flat && (
        <div className="camera-hint">
          Ваш браузер використовує спрощену карту
        </div>
      )}
    </div>
  );
}
