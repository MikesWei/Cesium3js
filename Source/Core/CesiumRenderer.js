/// <reference path="../../ThirdParty/three.js" />
/// <reference path="../../ThirdParty/Cesium/Cesium.js" />


var Matrix4 = Cesium.Matrix4;
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

//CesiumRenderer
function getCommandsFromObject(object, commands) {
    if (!commands) {
        commands = [];
    }
    if (object.visible === false) return commands;

    if (object.isMesh || object.isLine || object.isPoints) {
        if (object.commandList && Array.isArray(object.commandList)) {
            object.commandList.forEach(function (command) {
                commands.push(command);
            });
        }
    }
    var children = object.children;

    for (var i = 0, l = children.length; i < l; i++) {

        getCommandsFromObject(children[i], commands);

    }
    return commands;
}

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

    this.isBuildingDrawCommand = false;
}

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

    /**
    *
    *@param {Cesium.FrameState}framstate 
    */
    update: function (frameState) {
        if (!this._ready) {
            return;
        }

        if (this.scene3js && this.scene3js.needUpdate) {

            var start = new Date();

            this._render(this.scene3js, frameState);

            this.scene3js.needUpdate = false;

            var commands = getCommandsFromObject(this.scene3js);
            if (commands && Array.isArray(commands)) {
                this.commands = commands;
            }

            this.debugLog("CesiumRenderer:" + (new Date() - start) + "ms");

            this.isBuildingDrawCommand = false;
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

        //setMaterial( material );

        //var program = setProgram(camera, fog, material, object);

        var updateBuffers = false;
        //var geometryProgram = geometry.id + '_' + program.id + '_' + material.wireframe;

        //if (geometryProgram !== _currentGeometryProgram) {

        //    _currentGeometryProgram = geometryProgram;
        //    updateBuffers = true;

        //}

        // morph targets

        /*var morphTargetInfluences = object.morphTargetInfluences;

        if (morphTargetInfluences !== undefined) {

            var activeInfluences = [];

            for (var i = 0, l = morphTargetInfluences.length; i < l; i++) {

                var influence = morphTargetInfluences[i];
                activeInfluences.push([influence, i]);

            }

            activeInfluences.sort(absNumericalSort);

            if (activeInfluences.length > 8) {

                activeInfluences.length = 8;

            }

            var morphAttributes = geometry.morphAttributes;

            for (var i = 0, l = activeInfluences.length; i < l; i++) {

                var influence = activeInfluences[i];
                morphInfluences[i] = influence[0];

                if (influence[0] !== 0) {

                    var index = influence[1];

                    if (material.morphTargets === true && morphAttributes.position) geometry.addAttribute('morphTarget' + i, morphAttributes.position[index]);
                    if (material.morphNormals === true && morphAttributes.normal) geometry.addAttribute('morphNormal' + i, morphAttributes.normal[index]);

                } else {

                    if (material.morphTargets === true) geometry.removeAttribute('morphTarget' + i);
                    if (material.morphNormals === true) geometry.removeAttribute('morphNormal' + i);

                }

            }

            for (var i = activeInfluences.length, il = morphInfluences.length; i < il; i++) {

                morphInfluences[i] = 0.0;

            }

            //program.getUniforms().setValue(
            //    _gl, 'morphTargetInfluences', morphInfluences);

            updateBuffers = true;

        }
        */
        //

        var index = geometry.index;
        var position = geometry.attributes.position;
        var rangeFactor = 1;

        if (material.wireframe === true) {

            //index = objects.getWireframeAttribute(geometry);
            rangeFactor = 2;

        }

        var renderer;

        if (index !== null) {

            //renderer = indexedBufferRenderer;
            //renderer.setIndex(index);

        } else {

            // renderer = bufferRenderer;

        }

        //if (updateBuffers) {

        //    setupVertexAttributes(material, program, geometry);

        //    if (index !== null) {

        //        _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, objects.getAttributeBuffer(index));

        //    }

        //}

        //

        var dataCount = 0;

        if (index !== null) {

            dataCount = index.count;

        } else if (position !== undefined) {

            dataCount = position.count;
            //index=new Int32Array(dataCount);
            //for (var i = 0; i < length; i++) {
            //    index[i] = i;
            //}
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
        var drawCommand = this.createDrawCommand(cesiumGeometry, material, frameState);
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
    /**
     *
     *@param {THREE.Scene}scene
     *@private
     */
    _render: function (scene, frameState) {

        var opaqueObjectsLastIndex = 0;
        var transparentObjects = [];
        var opaqueObjects = [];
        var opaqueObjectsLastIndex = -1;
        var transparentObjectsLastIndex = -1;

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
                    var geometry;
                    if (object.geometry && object.geometry instanceof THREE.BufferGeometry) {
                        geometry = object.geometry;
                    } else {
                        geometry = new THREE.BufferGeometry().setFromObject(object)
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


        var that = this;
        function rotate(geometry, object) {
            if (object.rotation && object.rotation.order) {
                var rotate1 = "rotate" + object.rotation.order[0];
                var rotate2 = "rotate" + object.rotation.order[1];
                var rotate3 = "rotate" + object.rotation.order[2];

                var angle1 = object.rotation.order[0].toLocaleLowerCase();
                var angle2 = object.rotation.order[1].toLocaleLowerCase();
                var angle3 = object.rotation.order[1].toLocaleLowerCase();
                if (object.rotation[angle1] !== 0) {
                    geometry[rotate1](object.rotation[angle1]);
                }
                if (object.rotation[angle2] !== 0) {
                    geometry[rotate2](object.rotation[angle2]);
                }
                if (object.rotation[angle3] !== 0) {
                    geometry[rotate3](object.rotation[angle3]);
                }

            }

        }
        function renderObjects(renderList, scene, overrideMaterial, frameState) {

            for (var i = 0, l = renderList.length; i < l; i++) {

                var renderItem = renderList[i];

                var object = renderItem.object;
                var geometry = renderItem.geometry.clone();



                if (object.position.x !== 0
                    || object.position.y !== 0
                    || object.position.z !== 0) {
                    geometry.translate(object.position.x, object.position.y, object.position.z);
                }
                if (object.scale.x !== 1
                   || object.scale.y !== 1
                   || object.scale.z !== 1) {
                    geometry.scale(object.scale.x, object.scale.y, object.scale.z);
                }
                //geometry.rotateX(object.rotation.x);
                //geometry.rotateY(object.rotation.y);
                //geometry.rotateZ(object.rotation.z);
                rotate(geometry, object);

                geometry.rotateX(Math.PI / 2.0);

                var material = !overrideMaterial ? renderItem.material : overrideMaterial;
                var group = renderItem.group;

                //object.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
                //object.normalMatrix.getNormalMatrix(object.modelViewMatrix);

                //object.onBeforeRender(_this, scene, camera, geometry, material, group);

                if (object.isImmediateRenderObject) {

                    //setMaterial(material);

                    //var program = setProgram(camera, scene.fog, material, object);

                    //_currentGeometryProgram = '';

                    //object.render(function (object) {

                    //    _this.renderBufferImmediate(object, program, material);

                    //});

                } else {


                    that.renderBufferDirect(geometry, material, object, group, frameState);

                }

                //object.onAfterRender(_this, scene, camera, geometry, material, group);


            }

        }

        if (scene.overrideMaterial) {

            var overrideMaterial = scene.overrideMaterial;

            renderObjects(opaqueObjects, scene, overrideMaterial, frameState);
            renderObjects(transparentObjects, scene, overrideMaterial, frameState);

        } else {

            // opaque pass (front-to-back order)

            //state.setBlending(NoBlending);
            renderObjects(opaqueObjects, scene, null, frameState);

            // transparent pass (back-to-front order)

            renderObjects(transparentObjects, scene, null, frameState);

        }
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
    createRenderState: function (material, command, frameState) {
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
                enabled: false,
                frontFunction: StencilFunction.ALWAYS,
                backFunction: StencilFunction.ALWAYS,
                reference: 0,
                mask: ~0,
                frontOperation: {
                    fail: StencilOperation.KEEP,
                    zFail: StencilOperation.KEEP,
                    zPass: StencilOperation.KEEP
                },
                backOperation: {
                    fail: StencilOperation.KEEP,
                    zFail: StencilOperation.KEEP,
                    zPass: StencilOperation.KEEP
                }
            },
            sampleCoverage: {
                enabled: false,
                value: 1.0,
                invert: false
            }
        };

        command.renderState = RenderState.fromCache(defaults);
        var translucent = true;
        if (material.transparent ) {
            command.renderState.depthMask = false; 
            Object.assign(command.renderState.blending,BlendingState.ALPHA_BLEND)
        } else {
            command.renderState.depthMask = true;
        }
    },
    /**
    *
    *
    *@param {THREE.Material}material
    *@param {Cesium.DrawCommand}command
    *@param {Cesium.FrameState}frameState
    *@private
    */
    createUniformMap: function (material, command, frameState) {
        command.uniformMap = {};

        //base matrix
        command.uniformMap.u_normalMatrix = function () {
            return frameState.context.uniformState.normal;
        }
        command.uniformMap.u_projectionMatrix = function () {
            return frameState.context.uniformState.projection;
        }

        command.uniformMap.u_modelViewMatrix = function () {
            return frameState.context.uniformState.modelView;
        }
        //base matrix for threejs
        command.uniformMap.normalMatrix = function () {
            return frameState.context.uniformState.normal;
        }
        command.uniformMap.projectionMatrix = function () {
            return frameState.context.uniformState.projection;
        }

        command.uniformMap.modelViewMatrix = function () {
            return frameState.context.uniformState.modelView;
        }
        command.uniformMap.modelMatrix = function () {
            return frameState.context.uniformState.model;
        }
        command.uniformMap.u_modelMatrix = function () {
            return frameState.context.uniformState.model;
        }
        command.uniformMap.u_viewMatrix = function () {
            return frameState.context.uniformState.view;
        }
        command.uniformMap.viewMatrix = function () {
            return frameState.context.uniformState.view;
        }

        var that = this;
        if (material) {

            function getTextureCallback(texture3js) {
                return function () {

                    if (!that._textureCache[texture3js.uuid]) {
                        Cesium.when(texture3js.image, function (image) {

                            if (image instanceof HTMLImageElement
                                || image instanceof HTMLCanvasElement
                                || image instanceof HTMLVideoElement
                                ) {
                                var tex;
                                if (defined(image.internalFormat)) {
                                    tex = new Texture({
                                        context: frameState.context,
                                        pixelFormat: image.internalFormat,
                                        width: image.width,
                                        height: image.height,
                                        pixelFormat: PixelFormat.RGBA,
                                        pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
                                        source: {
                                            arrayBufferView: image.bufferView
                                        }
                                    });
                                } else {
                                    tex = new Texture({
                                        context: frameState.context,
                                        source: image,
                                        pixelFormat: PixelFormat.RGBA,
                                        pixelDatatype: PixelDatatype.UNSIGNED_BYTE
                                    });
                                }

                                //var tex = new Cesium.Texture({
                                //    context: frameState.context,
                                //    source: image
                                //});

                                //tex.flipY = texture3js.flipY;
                                //tex.preMultiplyAlpha = texture3js.premultiplyAlpha;
                                //tex.sampler._magnificationFilter = texture3js.magFilter;
                                //tex.sampler._minificationFilter = texture3js.minFilter;
                                //tex.sampler._wrapS = texture3js.wrapS;
                                //tex.sampler._wrapT = texture3js.wrapT;

                                that._textureCache[texture3js.uuid] = tex;

                            } else {
                                Cesium.loadImage(image).then(function (image) {

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
                                    //tex.flipY = texture3js.flipY;
                                    //tex.preMultiplyAlpha = texture3js.premultiplyAlpha;
                                    //tex.sampler._magnificationFilter = texture3js.magFilter;
                                    //tex.sampler._minificationFilter = texture3js.minFilter;
                                    //tex.sampler._wrapS = texture3js.wrapS;
                                    //tex.sampler._wrapT = texture3js.wrapT;


                                    that._textureCache[texture3js.uuid] = tex;

                                })
                            }

                        });

                        return frameState.context.defaultTexture;
                    } else {
                        return that._textureCache[texture3js.uuid];
                    }

                }
            }

            command.uniformMap["u_diffuse"] = function () {
                var color = Cesium.Color.SKYBLUE;
                if (material["color"]) {
                    color = new Cesium.Color(material["color"].r, material["color"].g, material["color"].b, material["color"].a);
                }
                return color;
            }
            if (material["map"] && material["map"].isTexture) {

                command.uniformMap["u_diffuseMap"] = getTextureCallback(material["map"]);

            }

            if (material.uniforms) {


                function setUniformCallbackFunc(name, item) {

                    if (item !== undefined && item !== null) {//item may be 0


                        if (item.value.isVector2) {

                            command.uniformMap[name] = function () {
                                return new Cesium.Cartesian2(item.value.x, item.value.y);
                            }
                        } else if (typeof item.value === 'number') {
                            command.uniformMap[name] = function () {
                                return item.value;
                            }
                        } else if (item.value.isVector3) {
                            command.uniformMap[name] = function () {
                                return new Cesium.Cartesian3(item.value.x, item.value.y, item.value.z);
                            }
                        } else if (item.value.isVector4) {
                            command.uniformMap[name] = function () {
                                return new Cesium.Cartesian4(item.value.x, item.value.y, item.value.z, item.value.w);
                            }
                        } else if (item.value.isCubeTexture) {
                            command.uniformMap[name] = function () {
                                if (!that._textureCache[item.value.uuid]) {
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
                                }
                                return that._textureCache[item.value.uuid];

                            }
                        } else if (item.value.isTexture) {
                            command.uniformMap[name] = getTextureCallback(item.value);
                        } else if (item.value.isMatrix4) {
                            command.uniformMap[name] = function () {
                                return Matrix4.fromArray(item.value.elements);

                            }
                        } else if (item.value.isColor) {
                            command.uniformMap[name] = function () {
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
        uniform mat3 u_normalMatrix;\n";

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
            "uniform mat4 viewMatrix"
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
            vs += "attribute vec4 color;\n\
                   varying vec4 v_color;\n";
        }
        vs += "\n\
                void main(void) \n\
                {\n\
                    vec4 pos = u_modelViewMatrix * vec4(position,1.0);\n\
                    v_position = pos.xyz;\n";
        if (geometry.attributes.color) {
            vs + "v_color=color;\n";
        }
        if (geometry.attributes.uv && material.map && material.map.isTexture) {
            vs += "v_uv=uv;\n";
        }
        vs += "v_normal = u_normalMatrix * normal;\n\
                    gl_Position = u_projectionMatrix * pos;\n\
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
        if (geometry.attributes.uv && material.map && material.map.isTexture) {

            fs += "uniform sampler2D u_diffuseMap;\n";
            fs += "varying vec2 v_uv;\n";

        }

        fs += "void main()\n\
                {\n\
                    vec3 positionToEyeEC = -v_position; \n\
                \n\
                    vec3 normalEC = normalize(v_normal);\n\
                 \n\
                    czm_material material;\n";

        fs += "material.specular = 0.0;\n\
                    material.shininess = 1.0;\n\
                    material.normal =  normalEC;\n\
                    material.emission =vec3(0.2,0.2,0.2);\n";

        if (geometry.attributes.uv && material.map && material.map.isTexture) {

            fs += "vec4 diffuse = texture2D(u_diffuseMap,v_uv);\n";
            fs += "material.diffuse = diffuse.rgb;\n";

        }
        else
            if (!material.color && geometry.attributes.color) {
                fs += "material.diffuse = v_color.rgb;\n\
                           material.alpha = v_color.a;\n";

            } else {
                fs += "material.diffuse = u_diffuse.rgb;\n\
                           material.alpha = u_diffuse.a;\n";
            }

        fs += "gl_FragColor = czm_phong(normalize(positionToEyeEC), material);\n\
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
        this.createRenderState(material, command, frameState);
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
        for (var attrName in geometry.attributes) {

            if (geometry.attributes.hasOwnProperty(attrName)) {
                var attr = geometry.getAttribute(attrName);
                attributes[attrName] = new Cesium.GeometryAttribute({
                    componentDatatype: this.getAttributeComponentType(attr.array),
                    componentsPerAttribute: attr.itemSize,
                    values: attr.array,
                    normalize: attr.normalized
                });


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
                indices[i] = index[i + drawStart];
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
    render: function (scene3js) {
        if (this.scene3js && this.scene3js !== scene3js) {
            this.scene3js.dispose();
        }
        if (this.isBuildingDrawCommand) {
            return;
        }
        this.scene3js = scene3js;
        this.scene3js.needUpdate = true;
        this.isBuildingDrawCommand = true;
    }

}