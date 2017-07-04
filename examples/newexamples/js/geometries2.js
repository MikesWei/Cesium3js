/// <reference path="../../ThirdParty/three.js" />
/// <reference path="../../ThirdParty/Cesium/Cesium.js" />
/// <reference path="../../appconfig.js" /> 
/// <reference path="../../Source/Core/CesiumRender.js" />
 
/**
*
*@type {Cesium.Viewer}
*/
var viewer = new Cesium.Viewer("cesiumContainer", {
    animation: true,
    timeline: true,
    navigationHelpButton: true //是否显示帮助信息控件
});

var imageryProviderViewModels = viewer.baseLayerPicker.viewModel.imageryProviderViewModels;
viewer.baseLayerPicker.viewModel.selectedImagery = imageryProviderViewModels[imageryProviderViewModels.length - 1];

viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(116.391402337129, 39.9031919, 5000)
});


var center = Cesium.Cartesian3.fromDegrees(116.391402337129, 39.9031909, 500);
var modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(center);

var cesiumRenderer = new CesiumRenderer(viewer.scene, modelMatrix);
var scene = new THREE.Scene();

var light, object, materials;

scene.add(new THREE.AmbientLight(0x404040));

light = new THREE.DirectionalLight(0xffffff);
light.position.set(0, 0, 1);
scene.add(light);

var map = new THREE.TextureLoader().load('../textures/UV_Grid_Sm.jpg');
map.wrapS = map.wrapT = THREE.RepeatWrapping;
map.anisotropy = 16;

materials = [
            new THREE.MeshLambertMaterial({ map: map, side: THREE.DoubleSide }),
            new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.1, side: THREE.DoubleSide })
];

var p = 2;
var q = 3;
var radius = 150, tube = 10, segmentsT = 50, segmentsR = 20;

var GrannyKnot = new THREE.Curves.GrannyKnot();

var torus2 = new THREE.ParametricGeometries.TorusKnotGeometry(radius, tube, segmentsT, segmentsR, p, q);
var sphere2 = new THREE.ParametricGeometries.SphereGeometry(75, 20, 10);
var tube2 = new THREE.ParametricGeometries.TubeGeometry(GrannyKnot, 150, 2, 8, true, false);

var geo;

// Klein Bottle

geo = new THREE.ParametricBufferGeometry(THREE.ParametricGeometries.klein, 20, 20);
object = THREE.SceneUtils.createMultiMaterialObject(geo, materials);
object.position.set(0, 0, 0);
object.scale.multiplyScalar(10);
scene.add(object);

// Mobius Strip

geo = new THREE.ParametricBufferGeometry(THREE.ParametricGeometries.mobius, 20, 20);
object = THREE.SceneUtils.createMultiMaterialObject(geo, materials);
object.position.set(10, 0, 0);
object.scale.multiplyScalar(100);
scene.add(object);

// Plane

geo = new THREE.ParametricBufferGeometry(THREE.ParametricGeometries.plane(200, 200), 10, 20);
object = THREE.SceneUtils.createMultiMaterialObject(geo, materials);
object.position.set(0, 0, 0);
scene.add(object);

object = THREE.SceneUtils.createMultiMaterialObject(torus2, materials);
object.position.set(0, 100, 0);
scene.add(object);

object = THREE.SceneUtils.createMultiMaterialObject(sphere2, materials);
object.position.set(200, 0, 0);
scene.add(object);

object = THREE.SceneUtils.createMultiMaterialObject(tube2, materials);
object.position.set(100, 0, 0);
scene.add(object);

object = new THREE.AxisHelper(50);
object.position.set(200, 0, -200);
scene.add(object);

cesiumRenderer.render(scene);

