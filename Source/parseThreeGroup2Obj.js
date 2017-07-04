
/// <reference path="three.js" />

/**
*
*@param {THREE.Group}group
*/
function parseThreeGroup2Obj(group) {

    //console.log(group);

    var materialGroups = {};

    var currentIndexArray = [];
    var vertexArray = [];
    var materials = {};
    var images = {};

    var positionMin = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE];
    var positionMax = [-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE];


    var currVertCache = {};
    var vertCountUntilLastPrimitive = 0;
    var vertexCounter = 0;
    var hasNormals = true;
    var hasTexture = true;
    var normalTexHasChecked = false;

    var materialGroupsCount = 0;
    var primitiveTypes = {};
    // Switch to the material-specific index array, or create it if it doesn't exist
    function useMaterial(material, primitveType) {
        var mtlName = material.name;
        if (typeof mtlName !== 'undefined') {
            if (mtlName.replace(/\s\t/g, "").length == 0) {
                mtlName = "material_unknown";
            }
        }

        primitiveTypes[mtlName] = primitveType;

        if (!materials[mtlName]) {

            var mtl = Material.createMaterial();
            if (material.color) {
                mtl.diffuseColor = [material.color.r, material.color.g, material.color.b, 1.0]
            } else {
                mtl.diffuseColor = [0, 0, 0, 1.0];
            }

            if (material.specular) {
                mtl.specularColor = [material.specular.r, material.specular.g, material.specular.b, 1.0]
            }
            if (material.emissive) {
                mtl.emissionColor = [material.emissive.r, material.emissive.g, material.emissive.b, 1.0]
            } if (material.ambient) {

                mtl.ambientColor = [material.ambient.r, material.ambient.g, material.ambient.b, 1.0]
            }

            if (material.map && material.map.isTexture) {


                var uri = material.map.image;
                if (uri && uri.src) {
                    uri = uri.src;
                }
                var transparent = false;
                //if (uri.indexOf("data:image/png") >= 0) {
                //    transparent = true;
                //} else if (uri.endsWith(".png")) {
                //    transparent = true;
                //}
                var name = uri;
                if (uri instanceof HTMLCanvasElement) {
                    uri = uri.toDataURL();
                    transparent = false;
                    name = "canvas_mtl_" + uri.id;
                }

                if (!images[name]) {
                    images[name] = {
                        uri: uri,
                        transparent: transparent,
                        channels: transparent ? 4 : 3
                    }
                }
                mtl.diffuseColorMap = name;

            } else if (material.gradientMap && material.gradientMap.isTexture) {

                var uri = material.gradientMap.image;
                var name = uri;
                if (uri && uri.src) {
                    uri = uri.src;
                }
                else if (uri instanceof ImageData) {
                    var cv = document.createElement("canvas");
                    cv.width = uri.width;
                    cv.height = uri.height;
                    var ctx = cv.getContext("2d");
                    var imgData = ctx.getImageData(0, 0, cv.width, cv.height);
                    for (var i = 0; i < imgData.data.length; i++) {
                        imgData.data[i] = uri.data[i];
                    }
                    ctx.putImageData(imgData, 0, 0);
                    uri = cv.toDataURL();
                    name = material.gradientMap.uuid;
                }

                if (!images[name]) {
                    images[name] = {
                        uri: uri,
                        transparent: true,
                        channels: 4
                    }
                }
                mtl.alphaMap = name;

            }

            materials[mtlName] = mtl;
        }

        if (!materials[mtlName]) {
            useDefaultMaterial();
            materialGroupsCount++;
        } else {
            currentIndexArray = materialGroups[mtlName];
            if (!currentIndexArray) {
                currentIndexArray = [];
                materialGroups[mtlName] = currentIndexArray;
                materialGroupsCount++;
            }
        }
    }

    function useDefaultMaterial() {
        var defaultMaterial = 'czmDefaultMat';
        if (!materials[defaultMaterial]) {

            materials[defaultMaterial] = Material.getDefault();
        }
        useMaterial(defaultMaterial);
    }

    var normal = new Cesium.Cartesian3();
    function addVertex(index, vt, uv, vn) {
        if (typeof currVertCache[index] !== 'undefined') {
            return currVertCache[index];
        }

        vertexArray.push(vt.x, vt.y, vt.z); //vt

        positionMin[0] = Math.min(vt.x, positionMin[0]);
        positionMin[1] = Math.min(vt.y, positionMin[1]);
        positionMin[2] = Math.min(vt.z, positionMin[2]);
        positionMax[0] = Math.max(vt.x, positionMax[0]);
        positionMax[1] = Math.max(vt.y, positionMax[1]);
        positionMax[2] = Math.max(vt.z, positionMax[2]);

        if (hasNormals) {
            if (!vn) {
                vertexArray.push(0.0, 0.0, 0.0); //vn
            } else {
                if (vn.x < 0.0001 && vn.y < 0.0001 && vn.z < 0.0001) {
                    normal = Cesium.Cartesian3.normalize(new Cesium.Cartesian3(vn.x + 0.0001, vn.y + 0.0001, vn.z + 0.0001), new Cesium.Cartesian3());
                } else {
                    try {
                        normal = Cesium.Cartesian3.normalize(new Cesium.Cartesian3(vn.x, vn.y, vn.z), new Cesium.Cartesian3());
                    } catch (e) {
                        normal = new Cesium.Cartesian3();
                    }

                }
                vertexArray.push(normal.x, normal.y, normal.z); //vn
            }
        }

        if (hasTexture) {
            if (!uv) {
                vertexArray.push(0, 0); //uv
            } else {
                vertexArray.push(uv.x, 1.0 - uv.y); //uv,flipY
            }
        }

        currVertCache[index] = vertexCounter;
        vertexCounter++;
        return currVertCache[index];
    }

    function addGeometryFace(vertices, face, faceVertexUv, meshUseMaterials) {

        var uvs = faceVertexUv;
        var vns = face.vertexNormals;
        if (!normalTexHasChecked) {
            hasNormals = typeof vns != undefined && vns != null;
            hasTexture = typeof uvs != undefined && uvs != null;
            normalTexHasChecked = true;
        }

        if (!uvs) {
            uvs = [];
        }
        if (!vns) {
            vns = [];
        }

        var material = meshUseMaterials;

        if (meshUseMaterials) {
            if (meshUseMaterials.length > 0) {
                material = meshUseMaterials[face.materialIndex];
            }
            else if (meshUseMaterials.isMultiMaterial) {
                material = meshUseMaterials.materials[face.materialIndex];
            }
        }

        useMaterial(material, Cesium.WebGLConstants.TRIANGLES);



        var index1 = addVertex(face.a, vertices[face.a], uvs[0], vns[0]);
        var index2 = addVertex(face.b, vertices[face.b], uvs[1], vns[1]);
        var index3 = addVertex(face.c, vertices[face.c], uvs[2], vns[2]);

        currentIndexArray.push(index1);
        currentIndexArray.push(index2);
        currentIndexArray.push(index3);

        if (face instanceof THREE.Face4) {

            var index4 = addVertex(face.d, vertices[face.d], faceVertexUv[3], face.vertexNormals[3]);
            currentIndexArray.push(index1);
            currentIndexArray.push(index3);
            currentIndexArray.push(index4);
        }

    }

    function parseGeometry(mesh) {


        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeFaceNormals();

        var geometry = mesh.geometry.clone();
        geometry.translate(mesh.position.x, mesh.position.y, mesh.position.z);

        var faceVertexUvs = geometry.faceVertexUvs;
        var faces = geometry.faces;
        var vertices = geometry.vertices;


        if (faceVertexUvs && faceVertexUvs.length != faces.length) {
            faceVertexUvs = faceVertexUvs[0];
        }
        else if (!faceVertexUvs) {
            faceVertexUvs = [];
        }

        for (var i = 0; i < faces.length; i++) {

            addGeometryFace(vertices, faces[i], faceVertexUvs[i], mesh.material);

        }
    }


    function parseBufferGeometry(mesh) {

        var geo = mesh.geometry.clone();
        geo.translate(mesh.position.x, mesh.position.y, mesh.position.z);
        // geo.scale(mesh.scale.x, mesh.scale.y, mesh.scale.z);
        // geo.rotate(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z, rotation.order);
        //var order = rotation.order;

        var attributes = geo.attributes;
        if (!normalTexHasChecked) {
            hasNormals = typeof attributes.normal != undefined && attributes.normal != null;
            hasTexture = typeof attributes.uv != undefined && attributes.uv != null;
            normalTexHasChecked = true;
        }
        var normals = attributes.normal ? attributes.normal.array : undefined;
        var positions = attributes.position.array;
        var uvs = attributes.uv ? attributes.uv.array : undefined;
        var indices = geo.index ? geo.index.array : null;
        var count = (positions.length / 3);
        if (!indices) {
            indices = [];
            for (var i = 0; i < count; i++) {
                indices.push(i);
            }
        }

        var material = mesh.material;
        var materialGroups = [];
        if (!material || !material.isMultiMaterial) {
            useMaterial(material, mesh.type == "Points" ? Cesium.WebGLConstants.POINTS : Cesium.WebGLConstants.TRIANGLES);
            materialGroups.push({
                count: indices.length,
                materialIndex: 0,
                start: 0
            });
        } else {
            materialGroups = geo.groups;
        }


        materialGroups.forEach(function (materialGroup) {
            var mtl = material.materials ? material.materials[materialGroup.materialIndex] : material;
            if (mtl.name.replace(/\s\t/g, "").length == 0) {
                mtl.name = "material_" + materialGroup.materialIndex;
            }
            useMaterial(mtl, mesh.type == "Points" ? Cesium.WebGLConstants.POINTS : Cesium.WebGLConstants.TRIANGLES);

            for (var i = materialGroup.start; i < materialGroup.start + materialGroup.count; i++) {
                var index = indices[i];
                var vt = {
                    x: positions[index * 3 + 0],
                    y: positions[index * 3 + 1],
                    z: positions[index * 3 + 2]
                }

                var vn = null;
                if (normals) {
                    vn = {
                        x: normals[index * 3 + 0],
                        y: normals[index * 3 + 1],
                        z: normals[index * 3 + 2]
                    }
                }

                var uv = null;
                if (uvs) {
                    uv = {
                        x: uvs[index * 2 + 0],
                        y: uvs[index * 2 + 1]
                    }
                }


                index = addVertex(index, vt, uv, vn);
                currentIndexArray.push(index);
            }

        })

    }



    var scene = group.scene ? group.scene : group;
    function processCompressTexture() {
        var promises = [];
        scene.traverse(function (mesh) {
            if ((mesh.type == "Mesh"
                    || mesh.type == 'SkinnedMesh'
                    || mesh.type == "MorphBlendMesh") && mesh.material) {


                if (mesh.material.isMultiMaterial) {
                    mesh.material.materials.forEach(function (material) {
                        if (material.map && material.map.isCompressedTexture) {
                            var promise = new Promise(function (resolve, reject) {
                                material.map.update = function () {
                                    resolve(material);
                                }
                            });
                            promises.push(promise);
                        }
                    })
                } else {
                    var material = mesh.material;
                    if (material.map && material.map.isCompressedTexture) {
                        var promise = new Promise(function (resolve, reject) {
                            material.map.update = function () {
                                resolve(material);
                            }
                        });
                        promises.push(promise);
                    }
                }
            }

        });
        if (promises.length > 0) {
            return Promise(function (resolve, reject) {
                Promise.all(promises, function (rs) {
                    resolve.resolve(rs);
                }, function (err) {
                    reject(err);
                })
            })
        } else {
            return null;
        }
    }

    function processScene(scene) {
        scene.traverse(function (group) {
            processGroup(group);
        })
    }

    function processSkins(skins) {
        if (skins && skins.length) {
            skins.forEach(function (group) {
                group.traverse(function (group) {
                    processGroup(group);
                })
            })
        }
    }

    function processAnimation(animations) {
        animations.forEach(function (animation) {
            processGroup(animation);
        })
    }
    function processGroup(group) {
        if (group.children && group.children.length > 0) {
            group.children.forEach(function (mesh) {

                mesh.traverse(function (mesh) {
                    if (mesh.type == "Mesh"
                        || mesh.type == 'SkinnedMesh'
                        || mesh.type == "MorphBlendMesh") {
                        currVertCache = {};

                        if (mesh.geometry instanceof THREE.BufferGeometry) {
                            parseBufferGeometry(mesh);
                        } else {
                            parseGeometry(mesh);
                        }
                    }
                });
            });

        }
        if (group.geometry) {

            if (group.type == "Mesh"
                       || group.type == 'SkinnedMesh'
                       || group.type == "MorphBlendMesh") {

                currVertCache = {};

                if (group.geometry instanceof THREE.BufferGeometry) {
                    parseBufferGeometry(group);
                } else {
                    parseGeometry(group);
                }
            }
        }
    }

    if (group.scene) {
        processScene(group.scene);
    }
    if (group.skins) {
        processSkins(group.skins);
    }
    if (group.animations) {
        processAnimation(group.animations);
    }
    if (!group.scene && !group.skins) {
        if (group.traverse) {
            group.traverse(function (group) {
                processGroup(group);
            });
        } else {
            processGroup(group);
        }
    }
    var obj = {
        vertexArray: vertexArray,
        vertexCount: vertexCounter,
        materialGroups: materialGroups,
        materials: materials,
        hasNormals: hasNormals,
        hasUVs: hasTexture,
        images: images,
        positionMin: positionMin,
        positionMax: positionMax,
        primitiveTypes: primitiveTypes
    }
    var imageUriPromises = [];
    var imageNames = [];
    for (var i in images) {
        if (images.hasOwnProperty(i)) {


            if (!images[i].uri || images[i].uri.startsWith("data:")) {
                if (!images[i].uri) {
                    images[i] = undefined;
                }
                continue;
            }
            imageUriPromises.push(loadTextureImage(images[i].uri));
            imageNames.push(i);
        }
    }
    //console.log(obj);
    // var promiseTex = null;//processCompressTexture()

    return new Promise(function (resolve, reject) {
        if (imageUriPromises.length > 0) {
            Cesium.when.all(imageUriPromises, function (result) {
                for (var i = 0; i < result.length; i++) {
                    obj.images[imageNames[i]] = result[i];
                }
                currentIndexArray = [];
                vertexCache = null;

                if (vertexArray.length == 0) {
                    resolve(null);
                } else {
                    resolve(obj);
                }

            }, function (err) {
                // reject(err);  
                console.log(err);
                obj.images = {};
                for (var i in obj.materials) {
                    if (obj.materials.hasOwnProperty(i)) {
                        obj.materials[i].diffuseColorMap = undefined;
                        obj.materials[i].specularColorMap = undefined;

                    }
                }
                if (vertexArray.length == 0) {
                    resolve(null);
                } else {
                    resolve(obj);
                }
            })

        } else {
            currentIndexArray = [];
            vertexCache = null;
            if (vertexArray.length == 0) {
                resolve(null);
            }
            else {
                resolve(obj);
            }

        }
    })

}
if (typeof define === "function") {
    define([
    //'ThirdParty/three',
     'Gltf/loadTextureImage',
     'Gltf/Material'
    ], function (
    //THREE,
      loadTextureImage,
      Material
     ) {
        "use strict";
        var scope = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};
        //scope.THREE = THREE;
        scope.loadTextureImage = loadTextureImage;
        return parseThreeGroup2Obj;

    })
}