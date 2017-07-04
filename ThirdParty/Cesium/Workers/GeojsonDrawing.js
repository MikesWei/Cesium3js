/// <reference path="CanvasWorker.js" />
/// <reference path="../Cesium.js" />
/// <reference path="turf.js" />

if (typeof self === 'undefined') {
    self = {}; //define self so that the Dojo build can evaluate this file without crashing.
}
if (typeof window === 'undefined') {
    window = self;
}
self.importScripts('../Cesium.js');
self.importScripts('./CanvasWorker.js');
self.importScripts('./turf.js');

var geojsonDrawWorker = {};

geojsonDrawWorker.init = function (geojson, width, height) {
    this.width = width;
    this.height = height;
    this.geojson = geojson;
    this.canvas = new CanvasWorker.Canvas(width, height);
    this.context = this.canvas.getContext("2d");
    this.context.lineWidth = 2;
    this.context.strokeStyle = "rgb(255,255,0)";
    this.context.fillStyle = "rgb(255,255,255,0)";
    this.context.clearRect(0, 0, width, height);
}

geojsonDrawWorker.drawRectangle = function (rectangle) {

    var rectangleGeojson = turf.polygon([[
          [rectangle.west, rectangle.north],
          [rectangle.west, rectangle.south],
          [rectangle.east, rectangle.south],
          [rectangle.east, rectangle.north],
          [rectangle.west, rectangle.north]
    ]]);
    var features = [];
    var intersection = null;
    turf.featureEach(this.geojson, function (currentFeature, currentIndex) {
        try {
            intersection = turf.intersect(rectangleGeojson, currentFeature);
            features.push(intersection);
        } catch (e) {

        }
    });
    intersection = null;
    if (features.length > 0) {
        try {
            features = turf.featureCollection(features);
            this.context.drawGeojson(0, 0, features);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function drawFunc(packedParameters, transferableObjects) {
    var result = geojsonDrawWorker[packedParameters.methodName].apply(this, packedParameters.args);
    return result;
    return transferableObjects;
}

drawWorker = Cesium.createTaskProcessorWorker(drawFunc);
if (define) {
    define("Workers/GeojsonDrawing", [], function () {
        return drawWorker;
    });
}