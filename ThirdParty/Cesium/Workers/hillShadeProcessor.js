/// <reference path="../Cesium.js" />

//插值线程
if (typeof self === 'undefined') {
    self = {}; //define self so that the Dojo build can evaluate this file without crashing.
}
if (typeof window === 'undefined') {
    window = self;
}
self.importScripts('../Cesium.js');
HillShadeProcessor = {};
function getColor(val, colorMap) {
    if (isNaN(val)) return [0, 0, 0, 0];
    for (var i = 0; i < colorMap.length; i++) {
        if (val > colorMap[i][0] && val <= colorMap[i][1]) {
            return colorMap[i][2];
        }
    }
    return [0, 0, 0, 0]
}
HillShadeProcessor.init = function (colorMap, tileWidth, tileHeight, zeroBuffer, minHeight, maxHeight) {
    this.colorMap = colorMap;
    this.zeroBuffer = zeroBuffer;
    this.tileHeight = tileHeight;
    this.tileWidth = tileWidth;
    this.maxHeight = maxHeight;
    this.minHeight = minHeight;
    this.deltHeight = parseFloat(maxHeight - minHeight);
    return true;
}

HillShadeProcessor.createHillShadeTile = function (buffer, structure, bufferWidth, bufferHeight, west, south, east, north) {

    var terrainData = new Cesium.HeightmapTerrainData({
        buffer: buffer,
        width: bufferWidth,
        height: bufferHeight,
        childTileMask: 15,
        structure: structure
    });

    var rectangle = Cesium.Rectangle.fromDegrees(west, south, east, north);
    var deltX = (east - west) / this.tileWidth;
    var deltY = (south - north) / this.tileHeight;
    var position = null;
    var height = 0.0;
    var color = [0, 0, 0, 0];
    var imageData = new Uint8ClampedArray(this.tileHeight * this.tileWidth * 4);
    for (var lat_j = 0; lat_j < this.tileHeight; lat_j++) {
        for (var lon_k = 0; lon_k < this.tileWidth; lon_k++) {
            position = Cesium.Cartographic.fromDegrees(west + lon_k * deltX, north + lat_j * deltY);
            height = terrainData.interpolateHeight(rectangle, position.longitude, position.latitude);
            if (height > this.maxHeight) {
                height = this.maxHeight;
            }
            if (height < this.minHeight) {
                height = this.minHeight + 0.1;
            }

            for (var i = 0; i < this.colorMap.length; i++) {
                var min = this.colorMap[i][0];
                var max = this.colorMap[i][1];
                if (height > min && height <= max) {
                    color = this.colorMap[i][2];
                    break;
                }
            }

            var pos = (lat_j * this.tileWidth + lon_k) * 4;
            imageData[pos] = color[0];
            imageData[pos + 1] = color[1];
            imageData[pos + 2] = color[2];
            imageData[pos + 3] = color[3];
        }
    }
    terrainData = null;
    return imageData;
}

function hillShadeProcessorFunc(packedParameters, transferableObjects) {
    var result = HillShadeProcessor[packedParameters.methodName].apply(this, packedParameters.args);
    return result;
}
define("Workers/hillShadeProcessor", [], function () {
    return Cesium.createTaskProcessorWorker(hillShadeProcessorFunc);
});
