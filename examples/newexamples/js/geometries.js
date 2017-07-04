/// <reference path="../../ThirdParty/three.js" />
/// <reference path="../../ThirdParty/Cesium/Cesium.js" />
/// <reference path="../../appconfig.js" /> 
/// <reference path="../../Source/Core/CesiumRender.js" />




//requirejs([
//       "../requirejs.config.js",
//       "../appconfig.js",
//       '../Source/Cesium3js'
//], function (
//       config,
//       appconfig,
//       Cesium3js
//       ) { 

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

var scene3js = new THREE.Scene();

var map = new THREE.TextureLoader().load('../textures/UV_Grid_Sm.jpg');
map.wrapS = map.wrapT = THREE.RepeatWrapping;
map.anisotropy = 16;

var material = new THREE.MeshLambertMaterial({ map: map, side: THREE.DoubleSide });

object = new THREE.Mesh(new THREE.SphereGeometry(75, 20, 10), material);
object.position.set(-400, 0, 200);
scene3js.add(object);

object = new THREE.Mesh(new THREE.IcosahedronGeometry(75, 1), material);
object.position.set(-200, 0, 200);
scene3js.add(object);

object = new THREE.Mesh(new THREE.OctahedronGeometry(75, 2), material);
object.position.set(0, 0, 200);
scene3js.add(object);

object = new THREE.Mesh(new THREE.TetrahedronGeometry(75, 0), material);
object.position.set(200, 0, 200);
scene3js.add(object);

object = new THREE.Mesh(new THREE.PlaneGeometry(100, 100, 4, 4), material);
object.position.set(-400, 0, 0);
scene3js.add(object);

object = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100, 4, 4, 4), material);
object.position.set(-200, 0, 0);
scene3js.add(object);

object = new THREE.Mesh(new THREE.CircleGeometry(50, 20, 0, Math.PI * 2), material);
object.position.set(0, 0, 0);
scene3js.add(object);

object = new THREE.Mesh(new THREE.RingGeometry(10, 50, 20, 5, 0, Math.PI * 2), material);
object.position.set(200, 0, 0);
scene3js.add(object);

object = new THREE.Mesh(new THREE.CylinderGeometry(25, 75, 100, 40, 5), material);
object.position.set(400, 0, 0);
scene3js.add(object);

object = new THREE.Mesh(new THREE.TorusGeometry(50, 20, 20, 20), material);
object.position.set(-200, 0, -200);
scene3js.add(object);

object = new THREE.Mesh(new THREE.TorusKnotGeometry(50, 10, 50, 20), material);
object.position.set(0, 0, -200);
scene3js.add(object);

object = new THREE.AxisHelper(50);
object.position.set(200, 0, -200);
scene3js.add(object);

object = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 50);
object.position.set(400, 0, -200);
scene3js.add(object);

scene3js.needUpdate = true;

cesiumRenderer.render(scene3js);

