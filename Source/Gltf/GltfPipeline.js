function GltfPipeline() {

}
GltfPipeline.processGltf = function (gltf) {
    var th = new TechniqueHandler(gltf);

    for (var meshId in gltf.meshes) {
        var primitives = gltf.meshes[meshId].primitives;
        primitives.forEach(function (primitive) {
            var withNormals = typeof primitive.attributes.NORMAL !== 'undefined';
            var withTexture = false;
            var transparent = false;

            var mtl = gltf.materials[primitive.material];
            if (mtl.values) {
                for (var mtlVal in mtl.values) {
                    if (typeof mtl.values[mtlVal] === 'string') {
                        withTexture = true;
                        transparent = gltf.textures[mtl.values[mtlVal]].format == Cesium.WebGLConstants.RGBA;
                    }
                }
            }
            var techniqueId = th.getTechniqueId(withTexture, withNormals, transparent)
            mtl.technique = techniqueId;
            mtl.values["transparency"] = 1.0;
        })
    }
    th = null;
    return gltf;
}

if (typeof module === "undefined") {
    this.GltfPipeline = GltfPipeline;
} else {
    module.exports = GltfPipeline;
}
if (typeof define === "function") {
    define(['Gltf/TechniqueHandler'], function (TechniqueHandler) {
        var scope = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};

        scope.TechniqueHandler = TechniqueHandler;

        return GltfPipeline;
    });
}