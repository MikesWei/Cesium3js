self.importScripts('../Cesium.js');
self.importScripts('./turf.js');
function workerFunc(packedParameters, transferableObjects) {
    var result = turf[packedParameters.methodName].apply(this, packedParameters.args);
    return result;
}

if (define) {
    define("Workers/turfWorker", [], function () {
        return Cesium.createTaskProcessorWorker(workerFunc);
    });
}
