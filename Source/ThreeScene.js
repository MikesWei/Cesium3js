


/**
*
*@memberof Cesium3js 
*@extends Cesium.Primitive
*@class
*/
function ThreeScene(options) {
    this.gltfModel = null;
    this.scene3js = null;
    this._ready = false;
    this.dirty = true;
    this._state = ThreeScene.States.Ready;

    this._objFromThree = null;
    this._gltfCache = null;
    this._gltf = null;
    this.heightReference = options.heightReference;
    this.scene = options.scene;
    this.basePath = Cesium.defaultValue(options.basePath, "");
    this.name = Cesium.defaultValue(options.basePath, Cesium.createGuid());

    this.modelMatrix = Cesium.defaultValue(options.modelMatrix, Cesium.Matrix4.IDENTITY);
}

/**
*
*@memberof Cesium3js.ThreeScene
*@type {Object}
*/
ThreeScene.States = {
    Ready: 1,
    Parsing: 2,
    ParseComplete: 3,
    Creating: 4,
    CreateComplete: 5,
    Processing: 6,
    ProcessComplete: 6,
    BuildModel: 7,
    Completed: 8,
    Failed: 0
};

Cesium.defineProperties(ThreeScene.prototype, {
    ready: {
        get: function () {
            return this._ready;
        }
    }
})

/**
*
*@param {THREE.Scene|THREE.Group|THREE.Mesh}scene3js
*/
ThreeScene.prototype.setScene3js = function (scene3js) {
    if (this._state == ThreeScene.States.Completed
        || this._state == ThreeScene.States.Failed
        || this._state == ThreeScene.States.Ready) {
        this.scene3js = scene3js;
        this._state = ThreeScene.States.Ready;
        this.dirty = true;
        this._ready = true;
    }


}

ThreeScene.prototype.update = function (frameState) {
    if (!this._ready) {
        return;
    }
    var that = this;
    if (this._state == ThreeScene.States.Ready) {
        this._state = ThreeScene.States.Parsing;

        var objFromThreePromise = parseThreeGroup2Obj(this.scene3js);
        if (!objFromThreePromise) {
            this._state = ThreeScene.States.Failed;
            console.log(new Error("模型“" + fname + "”转换失败。"));
            return;
        }

        objFromThreePromise.then(function (objFromThree) {
            that._objFromThree = objFromThree;
            if (!objFromThree) {
                console.log(new Error("模型“" + fname + "”转换失败。"));
                that._state = ThreeScene.States.Failed;
                return;
            }
            else {
                that._state = ThreeScene.States.ParseComplete;
            }

        }, function (err) {
            console.log(new Error("模型“" + fname + "”转换失败。" + err));
            that._state = ThreeScene.States.Failed;
        });

    }
    if (that._state == ThreeScene.States.ParseComplete) {
        that._state = ThreeScene.States.Creating;
        this._gltfCache = createGltf(this._objFromThree, this.basePath, this.name);
        Cesium.requestAnimationFrame(function () {
            that._state = ThreeScene.States.CreateComplete;
        })
    }

    if (that._state == ThreeScene.States.CreateComplete) {
        this._state = ThreeScene.States.Processing;
        this._gltf = GltfPipeline.processGltf(this._gltfCache);
        Cesium.requestAnimationFrame(function () {
            that._state = ThreeScene.States.ProcessComplete;
        })
    }

    if (that._state == ThreeScene.States.ProcessComplete) {
        var options = {
            gltf: this._gltf,
            modelMatrix: this.modelMatrix,
            scene: this.scene,
            minimumPixelSize: 256,
            heightReference: this.heightReference
        }
        if (!this.scene) {
            delete options.heightReference;
        }
        this.gltfModel = new Cesium.Model(options);

        this._state = ThreeScene.States.Completed;
    }

    if (this._state == ThreeScene.States.Completed) {
        this.gltfModel.update(frameState);
    }
}

define([
  //'ThirdParty/three',
  'parseThreeGroup2Obj',
  'Path',
  'Gltf/GltfPipeline',
  'Gltf/createGltf'
], function (
  //THREE,
  parseThreeGroup2Obj,
  Path,
  GltfPipeline,
  createGltf
  ) {

    //ThreeScene.THREE = THREE;

    THREE.TextureLoader.prototype.load = function (url, onLoad, onProgress, onError) {

        var texture = new THREE.Texture();

        var loader = new THREE.ImageLoader(this.manager);
        loader.setCrossOrigin(this.crossOrigin);
        loader.setPath(this.path);
        texture.image = url; 
     
        loader.load(url, function (image) {

            // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
            var isJPEG = url.search(/\.(jpg|jpeg)$/) > 0 || url.search(/^data\:image\/jpeg/) === 0;

            texture.format = isJPEG ? THREE.RGBFormat : THREE.RGBAFormat;
            texture.image = image;
            texture.needsUpdate = true;

            if (onLoad !== undefined) {

                onLoad(texture);

            }

        }, onProgress, onError);

        return texture;

    };
    return ThreeScene;
})