/// <reference path="../../ThirdParty/three.js" />
/// <reference path="../../ThirdParty/Cesium/Cesium.js" />
/// <reference path="webgl/WebGLProgram.js" />


var Matrix4 = Cesium.Matrix4;
var Matrix3 = Cesium.Matrix3;
var Cartesian3 = Cesium.Cartesian3;
var CesiumMath = Cesium.Math;
var DrawCommand = Cesium.DrawCommand;
var defined = Cesium.defined;
var GeometryPipeline = Cesium.GeometryPipeline;
var BufferUsage = Cesium.BufferUsage;
var BlendingState = Cesium.BlendingState;
var VertexArray = Cesium.VertexArray;
var ShaderProgram = Cesium.ShaderProgram;
var DepthFunction = Cesium.DepthFunction;
var CullFace = Cesium.CullFace;
var RenderState = Cesium.RenderState;
var defaultValue = Cesium.defaultValue;
var WindingOrder = Cesium.WindingOrder;
var BlendEquation = Cesium.BlendEquation;
var BlendFunction = Cesium.BlendFunction;
var StencilFunction = Cesium.StencilFunction;
var StencilOperation = Cesium.StencilOperation;
var Texture = Cesium.Texture;
var WebGLConstants = Cesium.WebGLConstants;

var yUpToZUp = Matrix4.fromRotationTranslation(Matrix3.fromRotationX(CesiumMath.PI_OVER_TWO));
var boundingSphereCartesian3Scratch = new Cartesian3();
var scratchTranslationRtc = new Cartesian3();

//供参考Cesium内置矩阵,通过uniform传到vertexShader中，用于坐标转换
//Cesium
var gltfSemanticUniforms = {
    MODEL: function (uniformState, model) {
        return function () {
            return uniformState.model;
        };
    },
    VIEW: function (uniformState, model) {
        return function () {
            return uniformState.view;
        };
    },
    PROJECTION: function (uniformState, model) {
        return function () {
            return uniformState.projection;
        };
    },
    MODELVIEW: function (uniformState, model) {
        return function () {
            return uniformState.modelView;
        };
    },
    CESIUM_RTC_MODELVIEW: function (uniformState, model) {
        // CESIUM_RTC extension
        var mvRtc = new Matrix4();
        return function () {
            if (defined(model._rtcCenter)) {
                Matrix4.getTranslation(uniformState.model, scratchTranslationRtc);
                Cartesian3.add(scratchTranslationRtc, model._rtcCenter, scratchTranslationRtc);
                Matrix4.multiplyByPoint(uniformState.view, scratchTranslationRtc, scratchTranslationRtc);
                return Matrix4.setTranslation(uniformState.modelView, scratchTranslationRtc, mvRtc);
            }
            return uniformState.modelView;
        };
    },
    MODELVIEWPROJECTION: function (uniformState, model) {
        return function () {
            return uniformState.modelViewProjection;
        };
    },
    MODELINVERSE: function (uniformState, model) {
        return function () {
            return uniformState.inverseModel;
        };
    },
    VIEWINVERSE: function (uniformState, model) {
        return function () {
            return uniformState.inverseView;
        };
    },
    PROJECTIONINVERSE: function (uniformState, model) {
        return function () {
            return uniformState.inverseProjection;
        };
    },
    MODELVIEWINVERSE: function (uniformState, model) {
        return function () {
            return uniformState.inverseModelView;
        };
    },
    MODELVIEWPROJECTIONINVERSE: function (uniformState, model) {
        return function () {
            return uniformState.inverseModelViewProjection;
        };
    },
    MODELINVERSETRANSPOSE: function (uniformState, model) {
        return function () {
            return uniformState.inverseTransposeModel;
        };
    },
    MODELVIEWINVERSETRANSPOSE: function (uniformState, model) {
        return function () {
            return uniformState.normal;
        };
    },
    VIEWPORT: function (uniformState, model) {
        return function () {
            return uniformState.viewportCartesian4;
        };
    }
    // JOINTMATRIX created in createCommand()
};

//threejs 
function parseIncludes(string) {

    var pattern = /#include +<([\w\d.]+)>/g;

    function replace(match, include) {

        var replace = THREE.ShaderChunk[include];

        if (replace === undefined) {

            throw new Error('Can not resolve #include <' + include + '>');

        }

        return parseIncludes(replace);

    }

    return string.replace(pattern, replace);

}

var shaderIDs = {
    MeshDepthMaterial: 'depth',
    MeshNormalMaterial: 'normal',
    MeshBasicMaterial: 'basic',
    MeshLambertMaterial: 'lambert',
    MeshPhongMaterial: 'phong',
    MeshToonMaterial: 'phong',
    MeshStandardMaterial: 'physical',
    MeshPhysicalMaterial: 'physical',
    LineBasicMaterial: 'basic',
    LineDashedMaterial: 'dashed',
    PointsMaterial: 'points'
};


/**
 *
 *@param {Cesium.Scene}scene
 *@extends Cesium.Primitive
 *@class
 */
function CesiumRenderer(scene, modelMatrix) {
    /**
   *
   *@type {Cesium.Scene}
   */
    this.scene = scene;
    /**
    *@type {Array<Cesium.DrawCommand}
    */
    this.drawCommands = [];

    /**
    *
    *@type {Cesium.Matrix4}
    */
    this.modelMatrix = defaultValue(modelMatrix, Matrix4.IDENTITY);

    /**
    *
    *@type {THREE.Scene}
    */
    this.scene3js = null;

    this._ready = true;

    this.scene.primitives.add(this);

    this.needUpdate = true;

    this._commmand = null;

    this.debug = true;

    this._textureCache = {};

    this._uniformMaps = {};

    this.isBuildingDrawCommand = false;

    this._justLoad = true;

    this._transparentObjects = [];
    this._opaqueObjects = [];
    this._opaqueObjectsLastIndex = -1;
    this._transparentObjectsLastIndex = -1;

}

var scratchTranslation = new Cartesian3();
var scratchQuaternion = new Cesium.Quaternion();
var scratchScale = new Cartesian3();
var scratchTranslationQuaternionRotationScale = new Matrix4();
var computeModelMatrix = new Matrix4();

CesiumRenderer.prototype = {
    /**
     *
     *@param {String}info
     *@private
     */
    debugLog: function (info) {
        if (this.debug) {
            console.log(info);
        }
    },
    computeMatrix: function (object, computeModelMatrix) {
        if (object.parent) {
            this.computeMatrix(object.parent, computeModelMatrix);
        }
        scratchTranslation.x = object.position.x;
        scratchTranslation.y = object.position.y;
        scratchTranslation.z = object.position.z;

        scratchScale.x = object.scale.x;
        scratchScale.y = object.scale.y;
        scratchScale.z = object.scale.z;

        scratchQuaternion.x = object.quaternion.x;
        scratchQuaternion.y = object.quaternion.y;
        scratchQuaternion.z = object.quaternion.z;
        scratchQuaternion.w = object.quaternion.w;

        //translate,rotate,scale

        Matrix4.fromTranslationQuaternionRotationScale(
            scratchTranslation, scratchQuaternion,
            scratchScale, scratchTranslationQuaternionRotationScale);

        Matrix4.multiplyTransformation(
            computeModelMatrix,
            scratchTranslationQuaternionRotationScale,
            computeModelMatrix);
    },
    getCommandsFromObject: function (object, commands, frameState) {
        if (!commands) {
            commands = [];
        }
        if (object.visible === false) return commands;
        var that = this;
        if (object.isMesh || object.isLine || object.isPoints) {
            if (object.commandList && Array.isArray(object.commandList)) {

                var i = 0;
                object.commandList.forEach(function (drawCommand) {


                    Matrix4.clone(that.modelMatrix, computeModelMatrix);
                    that.computeMatrix(object, computeModelMatrix);

                    //yUpToZUp
                    if (object.up && object.up.y) {
                        Matrix4.multiplyTransformation(computeModelMatrix, yUpToZUp, drawCommand._modelMatrix);
                    }
                    var mtl = object.material;
                    if (mtl.isMultiMaterial) {
                        mtl = object.material.materials[i];
                    }
                    if (mtl.needsUpdate) {
                        that.setRenderState(
                            mtl,
                            drawCommand,
                            frameState
                            );
                        that.createUniformMap(mtl,
                            drawCommand,
                            frameState
                            );
                        mtl.needsUpdate = false;
                    }
                    commands.push(drawCommand);
                    i++;
                });
            }
        }

        var children = object.children;

        for (var i = 0, l = children.length; i < l; i++) {

            this.getCommandsFromObject(children[i], commands, frameState);

        }
        return commands;
    },
    /**
    *
    *@param {Cesium.FrameState}framstate 
    */
    update: function (frameState) {
        if (frameState.mode === Cesium.SceneMode.MORPHING) {
            return;
        }
        if (!this._ready) {
            return;
        }
        var that = this;
        if (this.scene3js && !this.isBuildingDrawCommand/*&& this.scene3js.needUpdate*/) {
            this.isBuildingDrawCommand = true;
            //var start = new Date();

            this._render(this.scene3js, frameState);
            if (this._justLoad) {
                this._justLoad = false;
            }
            this.scene3js.needUpdate = false;

            var commands = this.getCommandsFromObject(this.scene3js, null, frameState);
            if (commands && Array.isArray(commands)) {
                this.commands = commands;
            }


            this.debugLog(commands.length);//"CesiumRenderer:" + (new Date() - start) + "ms");

            that.isBuildingDrawCommand = false;

        }

        if (this.commands) {
            this.commands.forEach(function (command) {
                frameState.addCommand(command);

            });
        }

    },

    /**
     *
     *@param {THREE.Geometry}geometry
     *@param {THREE.Material}material
     *@param {THREE.Object}object
     *@param {Object}group
     *@param {Cesium.FrameState}frameState
     *@private
     */
    renderBufferDirect: function (geometry, material, object, group, frameState) {

        var updateBuffers = false;

        var index = geometry.index;
        var position = geometry.attributes.position;
        var rangeFactor = 1;

        if (material.wireframe === true) {

            rangeFactor = 2;

        }

        var dataCount = 0;

        if (index !== null) {

            dataCount = index.count;

        } else if (position !== undefined) {

            dataCount = position.count;
        }

        var rangeStart = geometry.drawRange.start * rangeFactor;
        var rangeCount = geometry.drawRange.count * rangeFactor;

        var groupStart = group !== null ? group.start * rangeFactor : 0;
        var groupCount = group !== null ? group.count * rangeFactor : Infinity;

        var drawStart = Math.max(rangeStart, groupStart);
        var drawEnd = Math.min(dataCount, rangeStart + rangeCount, groupStart + groupCount) - 1;

        var drawCount = Math.max(0, drawEnd - drawStart + 1);

        if (drawCount === 0) return;



        var cesiumGeometry = this.parseBufferGeometry(geometry, drawStart, drawCount);
        if (object.isMesh) {

            if (material.wireframe === true) {
                cesiumGeometry = Cesium.GeometryPipeline.toWireframe(cesiumGeometry);
            }
        }

        if (object.geometry.isInstancedBufferGeometry) {

            throw new Error("InstancedBufferGeometry is not supported now.");

        }

        var drawCommand = this.createDrawCommand(cesiumGeometry, material, frameState);

        drawCommand.receiveShadows = false;

        //if (!drawCommand.uniformMap.u_diffuseMap
        //    && drawCommand._shaderProgram._fragmentShaderText.indexOf("u_diffuseMap") >= 0) {
        //    return
        //}
        if (!object.commandList) {
            object.commandList = [];
        }
        if (group) {
            object.commandList[group.materialIndex] = drawCommand;
        } else {
            object.commandList[0] = drawCommand;
        }

        if (object.isMesh) {

            if (material.wireframe === true) {

                //state.setLineWidth(material.wireframeLinewidth * getTargetPixelRatio());
                //renderer.setMode(_gl.LINES);
                drawCommand.primitiveType = Cesium.PrimitiveType.LINES;
            } else {

                switch (object.drawMode) {

                    case THREE.TrianglesDrawMode:
                        //renderer.setMode(_gl.TRIANGLES);
                        drawCommand.primitiveType = Cesium.PrimitiveType.TRIANGLES;
                        break;

                    case THREE.TriangleStripDrawMode:
                        //renderer.setMode(_gl.TRIANGLE_STRIP);
                        drawCommand.primitiveType = Cesium.PrimitiveType.TRIANGLE_STRIP;
                        break;

                    case THREE.TriangleFanDrawMode:
                        //renderer.setMode(_gl.TRIANGLE_FAN);
                        drawCommand.primitiveType = Cesium.PrimitiveType.TRIANGLE_FAN;
                        break;

                }

            }


        } else if (object.isLine) {

            var lineWidth = material.linewidth;

            if (lineWidth === undefined) lineWidth = 1; // Not using Line*Material

            //state.setLineWidth(lineWidth * getTargetPixelRatio());


            if (object.isLineSegments) {
                drawCommand.primitiveType = Cesium.PrimitiveType.LINES;

                //renderer.setMode(_gl.LINES);

            } else {
                drawCommand.primitiveType = Cesium.PrimitiveType.LINE_STRIP;
                //renderer.setMode(_gl.LINE_STRIP);

            }

        } else if (object.isPoints) {

            drawCommand.primitiveType = Cesium.PrimitiveType.POINTS;
            // renderer.setMode(_gl.POINTS);

        }

        if (geometry && geometry.isInstancedBufferGeometry) {

            if (geometry.maxInstancedCount > 0) {

                // renderer.renderInstances(geometry, drawStart, drawCount);

            }

        } else {

            // renderer.render(drawStart, drawCount);

        }

    },

    updateRenderQueue: function (scene, frameState) {
        var opaqueObjectsLastIndex = 0;

        var transparentObjects = this._transparentObjects;
        var opaqueObjects = this._opaqueObjects;
        var opaqueObjectsLastIndex = -1;
        var transparentObjectsLastIndex = -1;
        var that = this;

        function pushRenderItem(object, geometry, material, group) {

            var array, index;

            // allocate the next position in the appropriate array

            if (material.transparent) {

                array = transparentObjects;
                index = ++transparentObjectsLastIndex;

            } else {

                array = opaqueObjects;
                index = ++opaqueObjectsLastIndex;

            }

            // recycle existing render item or grow the array

            var renderItem = array[index];

            if (renderItem !== undefined) {

                renderItem.id = object.id;
                renderItem.object = object;
                renderItem.geometry = geometry;
                renderItem.material = material;
                //renderItem.z = _vector3.z;
                renderItem.group = group;

            } else {

                renderItem = {
                    id: object.id,
                    object: object,
                    geometry: geometry,
                    material: material,
                    //z: _vector3.z,
                    group: group
                };

                // assert( index === array.length );
                array.push(renderItem);

            }

        }

        function projectObject(object) {

            if (object.visible === false) return;
            if (object.isMesh || object.isLine || object.isPoints) {

                if (object.isSkinnedMesh) {

                    object.skeleton.update();

                }

                var material = object.material;

                if (material.visible === true) {
                    var geometry = object.geometry;

                    if (geometry && geometry instanceof THREE.BufferGeometry) {

                        if (!geometry.needsUpdate && !that._justLoad) {
                            return;
                        }

                        object.geometry.needsUpdate = false;

                    } else {



                        if (
                             geometry.elementsNeedUpdate
                             || geometry.verticesNeedUpdate
                             || geometry.uvsNeedUpdate
                             || geometry.normalsNeedUpdate
                             || geometry.colorsNeedUpdate
                             || geometry.lineDistancesNeedUpdate
                             || geometry.groupsNeedUpdate
                             || that._justLoad
                            ) {

                            geometry.elementsNeedUpdate = false;
                            geometry.verticesNeedUpdate = false;
                            geometry.uvsNeedUpdate = false;
                            geometry.normalsNeedUpdate = false;
                            geometry.colorsNeedUpdate = false;
                            geometry.lineDistancesNeedUpdate = false;
                            geometry.groupsNeedUpdate = false;


                            geometry = new THREE.BufferGeometry().setFromObject(object);
                            if (!material.vertexColors ||( !object.geometry.__directGeometry && (!object.geometry.colors || object.geometry.colors.length == 0))) {
                                delete geometry.attributes.color;
                            }
                        }
                        else {
                            return;
                        }
                    }

                    if (material.isMultiMaterial) {

                        var groups = geometry.groups;
                        var materials = material.materials;

                        for (var i = 0, l = groups.length; i < l; i++) {

                            var group = groups[i];
                            var groupMaterial = materials[group.materialIndex];

                            if (groupMaterial.visible === true) {

                                pushRenderItem(object, geometry, groupMaterial, group);

                            }

                        }

                    } else {

                        pushRenderItem(object, geometry, material, null);

                    }

                }

            }
            var children = object.children;

            for (var i = 0, l = children.length; i < l; i++) {

                projectObject(children[i]);

            }
        }

        projectObject(scene);


    },

    renderNextObject: function (frameState) {


        if (this._opaqueObjects.length > 0) {
            this._opaqueObjectsLastIndex++;
            if (this._opaqueObjectsLastIndex < this._opaqueObjects.length) {
                for (var i = 0; i < this._opaqueObjects.length; i++) {

                    var opaqueObject = this._opaqueObjects[this._opaqueObjectsLastIndex];

                    this.renderObject(opaqueObject, this.scene3js, this.scene3js.overrideMaterial, frameState);

                    this._opaqueObjectsLastIndex++;

                    if (this._opaqueObjectsLastIndex >= this._opaqueObjects.length) {
                        break;
                    }
                }

            }
        }

        if (this._transparentObjects.length > 0) {

            this._transparentObjectsLastIndex++;
            if (this._transparentObjectsLastIndex < this._transparentObjects.length) {

                for (var i = 0; i < 2000; i++) {
                    var transparentObject = this._transparentObjects[this._transparentObjectsLastIndex];

                    this.renderObject(transparentObject, this.scene3js, this.scene3js.overrideMaterial, frameState);

                    this._transparentObjectsLastIndex++;
                    if (this._transparentObjectsLastIndex >= this._transparentObjects.length) {
                        break;
                    }
                }

            }
        }


    },

    renderObject: function (renderItem, scene, overrideMaterial, frameState) {

        var object = renderItem.object;
        var geometry = renderItem.geometry;
        var material = !overrideMaterial ? renderItem.material : overrideMaterial;
        var group = renderItem.group;

        if (object.isImmediateRenderObject) {

        } else {


            this.renderBufferDirect(geometry, material, object, group, frameState);

        }
    },
    /**
     *
     *@param {THREE.Scene}scene
     *@private
     */
    _render: function (scene, frameState) {
        if (this._justLoad) {
            this._opaqueObjectsLastIndex = -1;
            this._transparentObjectsLastIndex = -1;
        }
        this.updateRenderQueue(this.scene3js, frameState);
        this.renderNextObject(frameState);
    },
    /**
      *
      *@param {Cesium.Geometry}geometry
      *@param {Cesium.DrawCommand}command 
      *@param {Cesium.FrameState}frameState
      *@private
      */
    createVertexArray: function (geometry, command, frameState) {
        var attributeLocations = GeometryPipeline.createAttributeLocations(geometry);

        command.vertexArray = VertexArray.fromGeometry({
            context: frameState.context,
            geometry: geometry,
            attributeLocations: attributeLocations,
            bufferUsage: BufferUsage.STATIC_DRAW
        });
    },
    /**
     *
     *
     *@param {Cesium.Geometry} geometry
     *@param {THREE.Material}material
     *@param {Cesium.DrawCommand}command
     *@param {Cesium.FrameState}frameState
      *@private
     */
    createShaderProgram: function (geometry, material, command, frameState) {
        var attributeLocations = GeometryPipeline.createAttributeLocations(geometry);
        command.shaderProgram = ShaderProgram.fromCache({
            context: frameState.context,
            vertexShaderSource: this.getVertexShaderSource(geometry, material),
            fragmentShaderSource: this.getFragmentShaderSource(geometry, material),
            attributeLocations: attributeLocations
        });
    },
    /**
    *
    *
    *@param {THREE.Material}material
    *@param {Cesium.DrawCommand}command
    *@param {Cesium.FrameState}frameState
    *@private
    */
    setRenderState: function (material, command, frameState) {
        var defaults = {
            frontFace: WindingOrder.COUNTER_CLOCKWISE,
            cull: {
                enabled: false,
                face: CullFace.BACK
            },
            lineWidth: 1,
            polygonOffset: {
                enabled: false,
                factor: 0,
                units: 0
            },
            scissorTest: {
                enabled: false,
                rectangle: {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0
                }
            },
            depthRange: {
                near: 0,
                far: 1
            },
            depthTest: {
                enabled: material.depthTest,
                func: DepthFunction.LESS
            },
            colorMask: {
                red: true,
                green: true,
                blue: true,
                alpha: true
            },
            depthMask: true,
            stencilMask: ~0,
            blending: {
                enabled: material.blending,
                color: {
                    red: 0.0,
                    green: 0.0,
                    blue: 0.0,
                    alpha: 0.0
                },
                equationRgb: BlendEquation.ADD,
                equationAlpha: BlendEquation.ADD,
                functionSourceRgb: BlendFunction.ONE,
                functionSourceAlpha: BlendFunction.ONE,
                functionDestinationRgb: BlendFunction.ZERO,
                functionDestinationAlpha: BlendFunction.ZERO
            },
            stencilTest: {
                enabled: true,
                frontFunction: WebGLConstants.ALWAYS,
                backFunction: WebGLConstants.ALWAYS,
                // reference: stencilReference,
                mask: ~0,
                frontOperation: {
                    fail: WebGLConstants.KEEP,
                    zFail: WebGLConstants.KEEP,
                    zPass: WebGLConstants.REPLACE
                },
                backOperation: {
                    fail: WebGLConstants.KEEP,
                    zFail: WebGLConstants.KEEP,
                    zPass: WebGLConstants.REPLACE
                }
            },
            sampleCoverage: {
                enabled: false,
                value: 1.0,
                invert: false
            }
        };

        command.renderState = RenderState.fromCache(defaults);

        if (material.transparent) {

            command.renderState.cull.enabled = true;
            command.renderState.depthMask = false;
            Object.assign(command.renderState.blending, BlendingState.ALPHA_BLEND);
            command.renderState.blending.color.alpha = material.opacity;
        } else {
            command.renderState.depthMask = true;
        }
    },
    /**
    *
    *
    *@param {THREE.Material}material
    *@param {Cesium.DrawCommand}drawCommand
    *@param {Cesium.FrameState}frameState
    *@private
    */
    createUniformMap: function (material, drawCommand, frameState) {
        if (this._uniformMaps[material.uuid] && !material.needsUpdate && !this._justLoad) {
            drawCommand.uniformMap = this._uniformMaps[material.uuid];
            return;
        }
        var uniformMap = {};
        this._uniformMaps[material.uuid] = uniformMap;
        drawCommand.uniformMap = this._uniformMaps[material.uuid];
        material.needsUpdate = false;

        uniformMap.cameraPosition = function () {
            return frameState.camera.position;
        }
        uniformMap.u_cameraPosition = function () {
            return frameState.camera.position;
        }
        //base matrix
        uniformMap.u_normalMatrix = function () {
            return frameState.context.uniformState.normal;
        }
        uniformMap.u_projectionMatrix = function () {
            return frameState.context.uniformState.projection;
        }

        uniformMap.u_modelViewMatrix = function () {
            return frameState.context.uniformState.modelView;
        }
        //base matrix for threejs
        uniformMap.normalMatrix = function () {
            return frameState.context.uniformState.normal;
        }
        uniformMap.projectionMatrix = function () {
            return frameState.context.uniformState.projection;
        }

        uniformMap.modelViewMatrix = function () {
            return frameState.context.uniformState.modelView;
        }
        uniformMap.modelMatrix = function () {
            return frameState.context.uniformState.model;
        }
        uniformMap.u_modelMatrix = function () {
            return frameState.context.uniformState.model;
        }
        uniformMap.u_viewMatrix = function () {
            return frameState.context.uniformState.view;
        }
        uniformMap.viewMatrix = function () {
            return frameState.context.uniformState.view;
        }

        var that = this;
        if (material) {

            function getTextureCallback(texture3js, mtl) {
                return function () {

                    if (!that._textureCache[texture3js.uuid]) {
                        if (texture3js.image
                            && (texture3js.image instanceof HTMLImageElement
                                    || texture3js.image instanceof HTMLCanvasElement
                                    || texture3js.image instanceof HTMLVideoElement
                            )) {
                            var image = texture3js.image;
                            var tex;
                            if (defined(image.internalFormat)) {
                                tex = new Texture({
                                    context: frameState.context,
                                    pixelFormat: image.internalFormat,
                                    width: image.width,
                                    height: image.height,
                                    source: {
                                        arrayBufferView: image.bufferView
                                    }
                                });

                            } else {
                                tex = new Texture({
                                    context: frameState.context,
                                    source: image
                                });

                            }

                            if (typeof image.src === 'string') {
                                mtl.transparent = image.src.startsWith("data:image/png")
                                                   || image.src.endsWith(".png");
                            }

                            mtl.needsUpdate = true;

                            that._textureCache[texture3js.uuid] = tex;
                        }

                        return frameState.context.defaultTexture;
                    } else {
                        return that._textureCache[texture3js.uuid];
                    }

                }
            }

            uniformMap["u_diffuse"] = function () {
                var color = Cesium.Color.SKYBLUE;
                if (material["color"]) {
                    color = new Cesium.Color(material["color"].r,
                        material["color"].g, material["color"].b, material["color"].a, 1.0);
                }
                return color;
            }



            uniformMap["u_specular"] = function () {
                if (material.specular) {
                    return new Cesium.Color(
                        material["specular"].r, material["specular"].g, material["specular"].b, 1.0);
                } else {
                    return new Cesium.Color(0.0, 0, 0);

                }
            }

            if (material["map"] && material["map"].isTexture) {

                uniformMap["u_diffuseMap"] = getTextureCallback(material["map"], material);

            }
            else {
                uniformMap["u_diffuseMap"] = function () {
                    return frameState.context.defaultTexture;
                }
            }
            if (material.uniforms) {

                function setUniformCallbackFunc(name, item) {

                    if (item !== undefined && item !== null) {//item may be 0


                        if (item.value.isVector2) {

                            uniformMap[name] = function () {
                                return new Cesium.Cartesian2(item.value.x, item.value.y);
                            }
                        } else if (typeof item.value === 'number') {
                            uniformMap[name] = function () {
                                return item.value;
                            }
                        } else if (item.value.isVector3) {
                            uniformMap[name] = function () {
                                return new Cesium.Cartesian3(item.value.x, item.value.y, item.value.z);
                            }
                        } else if (item.value.isVector4) {
                            uniformMap[name] = function () {
                                return new Cesium.Cartesian4(item.value.x, item.value.y, item.value.z, item.value.w);
                            }
                        } else if (item.value.isCubeTexture) {
                            uniformMap[name] = function () {
                                if (!that._textureCache[item.value.uuid]
                                    && item.value.images.length > 0) {
                                    var allLoaded = true;
                                    for (var ti = 0; ti < 6; ti++) {
                                        if (item.value.images[ti] === undefined) {
                                            allLoaded = false;
                                            break;
                                        }
                                    }
                                    if (allLoaded) {
                                        that._textureCache[item.value.uuid] = new Cesium.CubeMap({
                                            context: frameState.context,
                                            source: {
                                                positiveX: item.value.images[0],
                                                negativeX: item.value.images[1],
                                                positiveY: item.value.images[2],
                                                negativeY: item.value.images[3],
                                                positiveZ: item.value.images[4],
                                                negativeZ: item.value.images[5]
                                            }
                                        });
                                        return that._textureCache[item.value.uuid];
                                    }

                                }

                                if (!that.defaultTextureImage) {
                                    that.defaultTextureImage = document.createElement("canvas");
                                    that.defaultTextureImage.width = 1;
                                    that.defaultTextureImage.height = 1;
                                }
                                return new Cesium.CubeMap({
                                    context: frameState.context,
                                    source: {
                                        positiveX: that.defaultTextureImage,
                                        negativeX: that.defaultTextureImage,
                                        positiveY: that.defaultTextureImage,
                                        negativeY: that.defaultTextureImage,
                                        positiveZ: that.defaultTextureImage,
                                        negativeZ: that.defaultTextureImage
                                    }
                                });
                            }
                        } else if (item.value.isTexture) {
                            uniformMap[name] = getTextureCallback(item.value, material);
                        } else if (item.value.isMatrix4) {
                            uniformMap[name] = function () {
                                return Matrix4.fromArray(item.value.elements);

                            }
                        } else if (item.value.isColor) {
                            uniformMap[name] = function () {
                                return new Cesium.Color(item.value.r, item.value.g, item.value.b, item.value.a);

                            }
                        }

                    }
                }

                var uniforms = material.uniforms;
                for (var name in uniforms) {

                    if (uniforms.hasOwnProperty(name)) {

                        var item = uniforms[name];
                        if (item.value == undefined || item.value == null) {
                            continue;
                        }
                        setUniformCallbackFunc(name, item);

                    }
                }
            }
        }

    },
    /**
    *
    *@param {Cesium.Geometry} geometry
    *@return {String}  
    */
    getVertexShaderSource: function (geometry, material) {
        //var shaderID = shaderIDs[material.type];
        //var vertexShader = THREE.ShaderLib[shaderID].vertexShader;

        //material.vertexShader = "#define NUM_CLIPPING_PLANES 0\n" + vertexShader;
        function getAttributeDefineBlok(userDefine) {
            var glsl = "";
            var attrs = geometry.attributes;
            for (var name in attrs) {

                if (attrs.hasOwnProperty(name)) {
                    var attr = attrs[name]
                    if (attr) {

                        var type = null;
                        switch (attr.componentsPerAttribute) {
                            case 1:
                                type = "float";
                                break;
                            case 2:
                                type = "vec2";
                                break;
                            case 3:
                                type = "vec3";
                                break;
                            case 4:
                                type = "vec4";
                                break;
                            default:
                        }

                        if (type) {
                            if (userDefine.indexOf("attribute " + type + " " + name) >= 0) {
                                continue;
                            }
                            glsl += "attribute " + type + " " + name + ";\n";
                        }

                    }
                }
            }
            return glsl;
        }

        var uniforms = "\n\
        uniform mat4 modelViewMatrix;\n\
        uniform mat4 viewMatrix;\n\
        uniform mat4 modelMatrix;\n\
        uniform mat4 projectionMatrix;\n\
        uniform mat3 normalMatrix;\n\
        uniform mat4 u_modelViewMatrix;\n\
        uniform mat4 u_viewMatrix;\n\
        uniform mat4 u_modelMatrix;\n\
        uniform mat4 u_projectionMatrix;\n\
        uniform mat3 u_normalMatrix;\n\
        uniform vec3 cameraPosition;\n\
        uniform vec3 u_cameraPosition;\n";

        var innerUniforms = [
            "uniform mat4 modelViewMatrix",
            "uniform mat4 modelMatrix",
            "uniform mat4 projectionMatrix",
            "uniform mat3 normalMatrix",
            "uniform mat4 u_modelViewMatrix",
            "uniform mat4 u_modelMatrix",
            "uniform mat4 u_projectionMatrix",
            "uniform mat3 u_normalMatrix",
            "uniform mat4 u_viewMatrix",
            "uniform mat4 viewMatrix",
            "uniform vec3 cameraPosition",
            "uniform vec3 u_cameraPosition"
        ];
        if (material.vertexShader) {
            uniforms = "";
            innerUniforms.forEach(function (item) {
                if (material.vertexShader.indexOf(item) < 0) {
                    uniforms += item + ";\n";
                }
            });
            var vs = getAttributeDefineBlok(material.vertexShader) + uniforms +
             material.vertexShader;

            vs = parseIncludes(vs);
            return vs;
        }
        var vs = "\n\
                #ifdef GL_ES\n\
                    precision highp float;\n\
                #endif\n\
                \n\
                attribute vec3 position;\n\
                attribute vec3 normal;\n";
        if (geometry.attributes.uv && material.map && material.map.isTexture) {
            vs += "attribute vec2 uv;\n\
                   varying vec2 v_uv;\n";
        }

        vs += uniforms + "\n\
                varying vec3 v_normal;\n\
                \n\
                varying vec3 v_position;\n";
        if (geometry.attributes.color) {
            if (geometry.attributes.color.componentsPerAttribute == 4) {
                vs += "attribute vec4 color;\n\
                   varying vec4 v_color;\n";
            } else {
                vs += "attribute vec3 color;\n\
                   varying vec4 v_color;\n";
            }

        }
        vs += "\n\
                void main(void) \n\
                {\n\
                    vec4 pos = u_modelViewMatrix * vec4(position,1.0);\n\
                    v_position = pos.xyz;\n";
        if (geometry.attributes.color) {
            if (geometry.attributes.color.componentsPerAttribute == 4) {
                vs += "v_color=color;\n";
            }
            else {
                vs += "v_color=vec4(color,1.0);\n";
            }
        }
        if (geometry.attributes.uv && material.map && material.map.isTexture) {
            vs += "v_uv=uv;\n";
        }
        vs += "v_normal = u_normalMatrix * normal;\n\
                    gl_Position = u_projectionMatrix * pos;\n\
                    gl_PointSize =4.0;\n\
                }";
        vs = parseIncludes(vs);
        return vs;
    },
    /**
     *
     *@param {Cesium.Geometry} geometry
     *@return {String} 
     */
    getFragmentShaderSource: function (geometry, material) {
        //var shaderID = shaderIDs[material.type];
        //var fragmentShader = THREE.ShaderLib[shaderID].fragmentShader;
        //material.fragmentShader = fragmentShader;

        if (material.fragmentShader) {
            var fs = parseIncludes(material.fragmentShader);
            return fs;
        }

        var fs = "varying vec4 v_color;\n\
                \n\
                varying vec3 v_position;\n\
                varying vec3 v_normal;\n\
                \n";

        fs += "uniform vec4 u_diffuse;\n";
        fs += "uniform vec4 u_specular;\n";
        if (geometry.attributes.uv && material.map && material.map.isTexture) {

            fs += "uniform sampler2D u_diffuseMap;\n";
            fs += "varying vec2 v_uv;\n";

        }

        fs += "void main()\n\
                {\n\
                    vec3 positionToEyeEC = -v_position; \n\
                \n\
                    vec3 normalEC =normalize(v_normal);\n\
                 \n\
                    czm_material material;\n";

        fs += "material.specular = 0.0;\n\
                    material.shininess = 1.0;\n\
                    material.normal =  normalEC;\n\
                    material.emission =vec3(0.2,0.2,0.2);\n";

        if (geometry.attributes.uv && material.map && material.map.isTexture) {

            fs += "vec4 diffuse = texture2D(u_diffuseMap,v_uv);\n";
            fs += "material.diffuse = diffuse.rgb;\n";
            fs += "material.alpha = diffuse.a;\n";

        }
        else if (geometry.attributes.color) {
            fs += "material.diffuse = v_color.rgb;\n\
                           material.alpha = v_color.a;\n";

        } else {
            fs += "material.diffuse = u_diffuse.rgb ;\n\
                           material.alpha =  u_diffuse.a;\n";
        }

        fs += "gl_FragColor =  czm_phong(normalize(positionToEyeEC), material);\n\
                }\n\
                ";

        fs = parseIncludes(fs);
        return fs;
    },
    /**
     *
     *@param {Cesium.Geometry} geometry
     *@param {THREE.Material} material
     *@param {Cesium.FrameState} frameState
      *@private
     */
    createDrawCommand: function (geometry, material, frameState) {

        var command = new Cesium.DrawCommand({
            modelMatrix: Matrix4.clone(this.modelMatrix),
            owner: this,
            primitiveType: Cesium.PrimitiveType.TRIANGLES,
            pass: Cesium.Pass.OPAQUE
        });

        this.createVertexArray(geometry, command, frameState);
        this.createShaderProgram(geometry, material, command, frameState);
        this.setRenderState(material, command, frameState);
        this.createUniformMap(material, command, frameState);

        return command;
    },

    /**
     *
     *@param {THREE.BufferGeometry}geometry
     *@param {Number}drawStart
     *@param {Number}drawCount
     *@param {Cesium.PrimitiveType}primitiveType
     *@private
     */
    parseBufferGeometry: function (geometry, drawStart, drawCount, primitiveType) {
        // var start = new Date();

        var attributes = {};
        if (!geometry.attributes.normal) {
            geometry.computeFaceNormals();

        }
        for (var attrName in geometry.attributes) {

            if (geometry.attributes.hasOwnProperty(attrName)) {
                var attr = geometry.getAttribute(attrName);
                if (attr && attr.array.length > 0) {

                    attributes[attrName] = new Cesium.GeometryAttribute({
                        componentDatatype: this.getAttributeComponentType(attr.array),
                        componentsPerAttribute: attr.itemSize,
                        values: attr.array,
                        normalize: attr.normalized
                    });

                }

            }
        }

        var index = geometry.getIndex();
        var indices = new Int32Array(drawCount);
        if (!index) {
            var count = geometry.attributes.position.count;

            for (var i = 0; i < drawCount; i++) {
                indices[i] = i + drawStart;
            }
        } else {
            for (var i = 0; i < drawCount; i++) {
                indices[i] = index.array[i + drawStart];
            }
        }

        var cesGeometry = new Cesium.Geometry({
            attributes: attributes,
            indices: indices,
            primitiveType: primitiveType
        });
        /// this.debugLog("create Cesium Geometry:" + (new Date() - start) + " ms");

        return cesGeometry;
    },
    /**
     *
     *@param {TypeArray} array
     *@return {Cesium.ComponentDatatype} 
     *@private
     */
    getAttributeComponentType: function (array) {

        var attributeComponentType = Cesium.ComponentDatatype.SHORT;
        if (array instanceof Int8Array) {
            attributeComponentType = Cesium.ComponentDatatype.BYTE;

        } else if (array instanceof Uint8Array || array instanceof Uint8ClampedArray) {
            attributeComponentType = Cesium.ComponentDatatype.UNSIGNED_BYTE;

        } else if (array instanceof Int16Array) {
            attributeComponentType = Cesium.ComponentDatatype.SHORT;

        } else if (array instanceof Uint16Array) {
            attributeComponentType = Cesium.ComponentDatatype.UNSIGNED_SHORT;

        } else if (array instanceof Int32Array) {
            attributeComponentType = Cesium.ComponentDatatype.INT;

        } else if (array instanceof Uint32Array) {
            attributeComponentType = Cesium.ComponentDatatype.UNSIGNED_INT;

        } else if (array instanceof Float32Array) {
            attributeComponentType = Cesium.ComponentDatatype.FLOAT;

        } else if (array instanceof Float64Array) {
            attributeComponentType = Cesium.ComponentDatatype.DOUBLE;

        }

        return attributeComponentType;

    },

    /**
    *@param {THREE.Scene}scene3js
    */
    render: function (scene3js, camera3js, forceReload) {
        if ((this.scene3js && this.scene3js !== scene3js)
            || !this.scene3js || forceReload) {

            this._justLoad = true;
        }

        if (this.isBuildingDrawCommand) {
            return;
        }
        this.scene3js = scene3js;
        this.scene3js.needUpdate = true;
        this._opaqueObjects = [];
        this._transparentObjects = [];
    }

}
