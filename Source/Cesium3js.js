//用于合各模块的js文件。具体合并相关工具和说明，请看build目录。
define( [
   'ThreeScene',
   'parseThreeGroup2Obj',
   'Gltf/TechniqueHandler',
   'Gltf/GltfPipeline'
], function (
    ThreeScene
) {

    /**
    * Cesium3js
    * @namespace Cesium3js
    */
    var Cesium3js = {
        version: "1.0.1"
    };
    Cesium3js.ThreeScene = ThreeScene;
    Cesium3js.parseThreeGroup2Obj = parseThreeGroup2Obj;
    Cesium3js.TechniqueHandler = TechniqueHandler;
    Cesium3js.GltfPipeline = GltfPipeline;
     
    return Cesium3js;
});