const wasm = require("./tolw");

function writeBufferIntoWasmMemory(heap8, address, buffer) {
  for (let ii = 0; ii < buffer.length; ++ii) {
    heap8[address + ii] = buffer[ii];
  };
};

function create_attrib_t(wasm) {
  let attrVertices = wasm["getAttribVertices"]();
  let attrNormals = wasm["getAttribNormals"]();
  let attrTexCoords = wasm["getAttribTexCoords"]();
  let attrColors = wasm["getAttribColors"]();
  let vertices = new Float32Array(attrVertices.size());
  let normals = new Float32Array(attrNormals.size());
  let texcoords = new Float32Array(attrTexCoords.size());
  let colors = new Float32Array(attrColors.size());
  // vertices
  {
    let length = attrVertices.size();
    for (let ii = 0; ii < length; ++ii) vertices[ii] = attrVertices.get(ii);
  }
  // normals
  {
    let length = attrNormals.size();
    for (let ii = 0; ii < length; ++ii) normals[ii] = attrNormals.get(ii);
  }
  // texcoords
  {
    let length = attrTexCoords.size();
    for (let ii = 0; ii < length; ++ii) texcoords[ii] = attrTexCoords.get(ii);
  }
  // colors
  {
    let length = attrColors.size();
    for (let ii = 0; ii < length; ++ii) colors[ii] = attrColors.get(ii);
  }
  let attrib_t = {
    vertices,
    normals,
    texcoords,
    colors
  };
  return attrib_t;
};

function create_index_t(wasm, meshIdx, indexIdx) {
  let index_t = wasm["getMeshIndex"](meshIdx, indexIdx);
  let vertex_index = index_t.get(0);
  let normal_index = index_t.get(1);
  let texcoord_index = index_t.get(2);
  return { vertex_index, normal_index, texcoord_index };
};

function create_mesh_t(wasm, meshIdx) {
  let mesh_t = {
    num_face_vertices: [],
    indices: [],
    material_ids: [],
    smoothing_group_ids: []
  };
  // mesh_t.indices
  {
    let meshIndices = wasm["getMeshIndices"](meshIdx);
    let length = meshIndices.size();
    for (let ii = 0; ii < length; ++ii) {
      let index_t = create_index_t(wasm, meshIdx, ii);
      mesh_t.indices.push(index_t);
    };
  }
  // mesh_t.num_face_vertices
  {
    let numFaceVertices = wasm["getMeshNumFaceVertices"](meshIdx);
    let length = numFaceVertices.size();
    for (let ii = 0; ii < length; ++ii) {
      let faceCount = numFaceVertices.get(ii);
      mesh_t.num_face_vertices.push(faceCount);
    };
  }
  // mesh_t.material_ids
  {
    let materialIds = wasm["getMeshMaterialIds"](meshIdx);
    let length = materialIds.size();
    for (let ii = 0; ii < length; ++ii) {
      let materialId = materialIds.get(ii);
      mesh_t.material_ids.push(materialId);
    };
  }
  // mesh_t.smoothing_group_ids
  {
    let smoothingGroupIds = wasm["getMeshSmoothingGroupIds"](meshIdx);
    let length = smoothingGroupIds.size();
    for (let ii = 0; ii < length; ++ii) {
      let smoothingGroupId = smoothingGroupIds.get(ii);
      mesh_t.smoothing_group_ids.push(smoothingGroupId);
    };
  }
  return mesh_t;
};

function create_shape_t(wasm, shapeIdx) {
  let shape_t = {
    name: wasm["getShapeName"](shapeIdx),
    mesh: create_mesh_t(wasm, shapeIdx),
    path: null
  };
  return shape_t;
};

function serialize(wasm) {
  let shapes = [];
  let attrib = null;
  // shapes
  {
    let shapeCount = wasm["getShapeCount"]();
    for (let ii = 0; ii < shapeCount; ++ii) {
      let shape_t = create_shape_t(wasm, ii);
      shapes.push(shape_t);
    };
  }
  // attrib
  {
    attrib = create_attrib_t(wasm);
  }
  return { attrib, shapes };
};

let loaded = false;

module.exports.init = function(resolve) {
  if (loaded) throw `Wasm module already initialized!`;
  wasm.onRuntimeInitialized = _ => {
    api = {
      loadObj: wasm.cwrap("loadObj", "number", ["number", "number"]),
      allocateSpace: wasm.cwrap("allocateSpace", "number", ["number"])
    };
    loaded = true;
    // tell user we're ready
    resolve(true);
  };
};

module.exports.loadObj = function(data) {
  if (!loaded) throw `Wasm module not initialized yet! Use .init() to initialize the module`;
  let buffer = new Uint8Array(data.buffer);
  let addr = api.allocateSpace(buffer.byteLength);
  writeBufferIntoWasmMemory(wasm.HEAP8, addr, buffer);
  {
    let ret = api.loadObj(addr, buffer.byteLength);
    if (!ret) throw `Failed to load object file!`;
  }
  let serialized = serialize(wasm);
  return serialized;
};
