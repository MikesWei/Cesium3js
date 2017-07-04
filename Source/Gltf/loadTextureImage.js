/// <reference path="../../Util/Path.js" />
/// <reference path="../../Util/loadArrayBuffer.js" />


function getChannels(colorType) {
    switch (colorType) {
        case 0: // greyscale
            return 1;
        case 2: // RGB
            return 3;
        case 4: // greyscale + alpha
            return 2;
        case 6: // RGB + alpha
            return 4;
        default:
            return 3;
    }
}

function getUriType(extension) {
    switch (extension) {
        case 'png':
            return 'data:image/png';
        case 'jpg':
            return 'data:image/jpeg';
        case 'jpeg':
            return 'data:image/jpeg';
        case 'gif':
            return 'data:image/gif';
        default:
            return 'data:image/' + extension;
    }
}

function TextureImage() {
    this.transparent = true;
    this.channels = 4;
    //data: data,
    this.uri = "";
}
/**
*
*@param {String} imagePath
*@return {Promise<TextureImage>}
*@private
*/
function loadTextureImage(imagePath) {

    return new Promise(function (resolve, reject) {
        var extension = Path.GetExtension(imagePath).slice(1);
        var uriType = getUriType(extension);

        if (extension !== "tif" && extension !== "png") {
            var info = {
                transparent: false,
                channels: 3,
                // data: data,
                uri: imagePath
            };
            resolve(info);
        }
        else {//处理tif和png纹理
            loadArrayBuffer(imagePath, function (imageArrayBuffer) {

                if (extension == 'tif') {//处理tif纹理
                    var tiffParser = new TIFFParser();
                    var tiffCanvas = tiffParser.parseTIFF(imageArrayBuffer);
                    var uri = tiffCanvas.toDataURL();
                    var info = {
                        transparent: true,
                        channels: 4,
                        //data: data,
                        uri: uri
                    };
                    resolve(info);
                }
                else if (extension === 'png') {
                    var data = new Uint8Array(imageArrayBuffer);
                    var blob = new Blob([data], { type: uriType.replace("data:", "") })
                    var fr = new FileReader();
                    fr.onload = function (e) {

                        var uri = e.target.result; //uriType + ';base64,' + b64encoded;//data.toString('base64');

                        var info = {
                            transparent: false,
                            channels: 3,
                            // data: data,
                            uri: uri
                        };


                        // Color type is encoded in the 25th bit of the png
                        var colorType = data[25];
                        var channels = getChannels(colorType);
                        info.channels = channels;
                        info.transparent = (channels === 4);

                        resolve(info);
                    }
                    fr.onerror = function (err) {
                        reject(err);
                    }
                    fr.readAsDataURL(blob);
                }
            }, function (err) {
                reject(err);
            })
        }
    });

}

if (typeof module === "undefined") {
    this.loadTextureImage = loadTextureImage;
} else {
    module.exports = loadTextureImage;
}
if (typeof define === "function") {
    define([
     'Path',
     'loadArrayBuffer',
     'ThirdParty/tiff-js/tiff'
    ], function (
     Path,
     loadArrayBuffer,
     TIFFParser
     ) {
        "use strict";

        var scope = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};
        scope.Path = Path,
        scope.loadArrayBuffer = loadArrayBuffer,
        scope.TIFFParser = TIFFParser;
        return loadTextureImage;

    })
}