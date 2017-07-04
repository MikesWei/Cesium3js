var viewer = new Cesium.Viewer("cesiumContainer", {
    animation: true,
    timeline: true,
    navigationHelpButton: true //是否显示帮助信息控件
});

var imageryProviderViewModels = viewer.baseLayerPicker.viewModel.imageryProviderViewModels;
viewer.baseLayerPicker.viewModel.selectedImagery = imageryProviderViewModels[imageryProviderViewModels.length - 1];


 

var center = Cesium.Cartesian3.fromDegrees(116.391402337129, 39.9031909, 500);
var modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(center);
viewer.camera.lookAtTransform(modelMatrix,new Cesium.Cartesian3(0.0, -47.0, 39.0));
var cesiumRenderer = new CesiumRenderer(viewer.scene, modelMatrix);
cesiumRenderer.debug = false;