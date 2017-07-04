(function () {
    
    var requirejs, require, define;
    (function (undef) {
        var main, req, makeMap, handlers,
            defined = {},
            waiting = {},
            config = {},
            defining = {},
            hasOwn = Object.prototype.hasOwnProperty,
            aps = [].slice,
            jsSuffixRegExp = /\.js$/;

        function hasProp(obj, prop) {
            return hasOwn.call(obj, prop);
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @returns {String} normalized name
         */
        function normalize(name, baseName) {
            var nameParts, nameSegment, mapValue, foundMap, lastIndex,
                foundI, foundStarMap, starI, i, j, part, normalizedBaseParts,
                baseParts = baseName && baseName.split("/"),
                map = config.map,
                starMap = (map && map['*']) || {};

            //Adjust any relative paths.
            if (name) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // If wanting node ID compatibility, strip .js from end
                // of IDs. Have to do this here, and not in nameToUrl
                // because node allows either .js or non .js to map
                // to same file.
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                // Starts with a '.' so need the baseName
                if (name[0].charAt(0) === '.' && baseParts) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = normalizedBaseParts.concat(name);
                }

                //start trimDots
                for (i = 0; i < name.length; i++) {
                    part = name[i];
                    if (part === '.') {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === '..') {
                        // If at the start, or previous value is still ..,
                        // keep them so that when converted to a path it may
                        // still work when converted to a path, even though
                        // as an ID it is less than ideal. In larger point
                        // releases, may be better to just kick out an error.
                        if (i === 0 || (i === 1 && name[2] === '..') || name[i - 1] === '..') {
                            continue;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join('/');
            }

            //Apply map config if available.
            if ((baseParts || starMap) && map) {
                nameParts = name.split('/');

                for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join("/");

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = map[baseParts.slice(0, j).join('/')];

                            //baseName segment has  config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = mapValue[nameSegment];
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break;
                                }
                            }
                        }
                    }

                    if (foundMap) {
                        break;
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && starMap[nameSegment]) {
                        foundStarMap = starMap[nameSegment];
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            return name;
        }

        function makeRequire(relName, forceSync) {
            return function () {
                //A version of a require function that passes a moduleName
                //value for items that may need to
                //look up paths relative to the moduleName
                var args = aps.call(arguments, 0);

                //If first arg is not require('string'), and there is only
                //one arg, it is the array form without a callback. Insert
                //a null so that the following concat is correct.
                if (typeof args[0] !== 'string' && args.length === 1) {
                    args.push(null);
                }
                return req.apply(undef, args.concat([relName, forceSync]));
            };
        }

        function makeNormalize(relName) {
            return function (name) {
                return normalize(name, relName);
            };
        }

        function makeLoad(depName) {
            return function (value) {
                defined[depName] = value;
            };
        }

        function callDep(name) {
            if (hasProp(waiting, name)) {
                var args = waiting[name];
                delete waiting[name];
                defining[name] = true;
                main.apply(undef, args);
            }

            if (!hasProp(defined, name) && !hasProp(defining, name)) {
                throw new Error('No ' + name);
            }
            return defined[name];
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        //Creates a parts array for a relName where first part is plugin ID,
        //second part is resource ID. Assumes relName has already been normalized.
        function makeRelParts(relName) {
            return relName ? splitPrefix(relName) : [];
        }

        /**
         * Makes a name map, normalizing the name, and using a plugin
         * for normalization if necessary. Grabs a ref to plugin
         * too, as an optimization.
         */
        makeMap = function (name, relParts) {
            var plugin,
                parts = splitPrefix(name),
                prefix = parts[0],
                relResourceName = relParts[1];

            name = parts[1];

            if (prefix) {
                prefix = normalize(prefix, relResourceName);
                plugin = callDep(prefix);
            }

            //Normalize according
            if (prefix) {
                if (plugin && plugin.normalize) {
                    name = plugin.normalize(name, makeNormalize(relResourceName));
                } else {
                    name = normalize(name, relResourceName);
                }
            } else {
                name = normalize(name, relResourceName);
                parts = splitPrefix(name);
                prefix = parts[0];
                name = parts[1];
                if (prefix) {
                    plugin = callDep(prefix);
                }
            }

            //Using ridiculous property names for space reasons
            return {
                f: prefix ? prefix + '!' + name : name, //fullName
                n: name,
                pr: prefix,
                p: plugin
            };
        };

        function makeConfig(name) {
            return function () {
                return (config && config.config && config.config[name]) || {};
            };
        }

        handlers = {
            require: function (name) {
                return makeRequire(name);
            },
            exports: function (name) {
                var e = defined[name];
                if (typeof e !== 'undefined') {
                    return e;
                } else {
                    return (defined[name] = {});
                }
            },
            module: function (name) {
                return {
                    id: name,
                    uri: '',
                    exports: defined[name],
                    config: makeConfig(name)
                };
            }
        };

        main = function (name, deps, callback, relName) {
            var cjsModule, depName, ret, map, i, relParts,
                args = [],
                callbackType = typeof callback,
                usingExports;

            //Use name if no relName
            relName = relName || name;
            relParts = makeRelParts(relName);

            //Call the callback to define the module, if necessary.
            if (callbackType === 'undefined' || callbackType === 'function') {
                //Pull out the defined dependencies and pass the ordered
                //values to the callback.
                //Default to [require, exports, module] if no deps
                deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
                for (i = 0; i < deps.length; i += 1) {
                    map = makeMap(deps[i], relParts);
                    depName = map.f;

                    //Fast path CommonJS standard dependencies.
                    if (depName === "require") {
                        args[i] = handlers.require(name);
                    } else if (depName === "exports") {
                        //CommonJS module spec 1.1
                        args[i] = handlers.exports(name);
                        usingExports = true;
                    } else if (depName === "module") {
                        //CommonJS module spec 1.1
                        cjsModule = args[i] = handlers.module(name);
                    } else if (hasProp(defined, depName) ||
                               hasProp(waiting, depName) ||
                               hasProp(defining, depName)) {
                        args[i] = callDep(depName);
                    } else if (map.p) {
                        map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                        args[i] = defined[depName];
                    } else {
                        throw new Error(name + ' missing ' + depName);
                    }
                }

                ret = callback ? callback.apply(defined[name], args) : undefined;

                if (name) {
                    //If setting exports via "module" is in play,
                    //favor that over return value and exports. After that,
                    //favor a non-undefined return value over exports use.
                    if (cjsModule && cjsModule.exports !== undef &&
                            cjsModule.exports !== defined[name]) {
                        defined[name] = cjsModule.exports;
                    } else if (ret !== undef || !usingExports) {
                        //Use the return value from the function.
                        defined[name] = ret;
                    }
                }
            } else if (name) {
                //May just be an object definition for the module. Only
                //worry about defining if have a module name.
                defined[name] = callback;
            }
        };

        requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
            if (typeof deps === "string") {
                if (handlers[deps]) {
                    //callback in this case is really relName
                    return handlers[deps](callback);
                }
                //Just return the module wanted. In this scenario, the
                //deps arg is the module name, and second arg (if passed)
                //is just the relName.
                //Normalize module name, if it contains . or ..
                return callDep(makeMap(deps, makeRelParts(callback)).f);
            } else if (!deps.splice) {
                //deps is a config object, not an array.
                config = deps;
                if (config.deps) {
                    req(config.deps, config.callback);
                }
                if (!callback) {
                    return;
                }

                if (callback.splice) {
                    //callback is an array, which means it is a dependency list.
                    //Adjust args if there are dependencies
                    deps = callback;
                    callback = relName;
                    relName = null;
                } else {
                    deps = undef;
                }
            }

            //Support require(['a'])
            callback = callback || function () { };

            //If relName is a function, it is an errback handler,
            //so remove it.
            if (typeof relName === 'function') {
                relName = forceSync;
                forceSync = alt;
            }

            //Simulate async callback;
            if (forceSync) {
                main(undef, deps, callback, relName);
            } else {
                //Using a non-zero value because of concern for what old browsers
                //do, and latest browsers "upgrade" to 4 if lower value is used:
                //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
                //If want a value immediately, use require('id') instead -- something
                //that works in almond on the global level, but not guaranteed and
                //unlikely to work in other AMD implementations.
                setTimeout(function () {
                    main(undef, deps, callback, relName);
                }, 4);
            }

            return req;
        };

        /**
         * Just drops the config on the floor, but returns req in case
         * the config return value is used.
         */
        req.config = function (cfg) {
            return req(cfg);
        };

        /**
         * Expose module registry for debugging and tooling
         */
        requirejs._defined = defined;

        define = function (name, deps, callback) {
            if (typeof name !== 'string') {
                throw new Error('See almond README: incorrect module build, no module name');
            }

            //This module may not have dependencies
            if (!deps.splice) {
                //deps is not an array, so probably means
                //an object literal or factory function for
                //the value. Adjust args.
                callback = deps;
                deps = [];
            }

            if (!hasProp(defined, name) && !hasProp(waiting, name)) {
                waiting[name] = [name, deps, callback];
            }
        };

        define.amd = {
            jQuery: true
        };
    }());
    /**
   * Cesium3js
   * @namespace Cesium3js
   */
    //----Cesium3js----
//define(function () {

/**
*@class
*@memberof MeteoLib.Util
*/
function Path() { }
/**
*
*获取文件扩展名（后缀）
*@param {String}fname 文件名
*/
Path.GetExtension = function (fname) {
    var start = fname.lastIndexOf(".");
    return fname.substring(start, fname.length);
}
 
/**
*
*获取文件扩展名（后缀）
*@param {String}fname 文件名
*/
Path.GetFileName = function (fname) {
    var start = fname.lastIndexOf("/");
    if (start < 0) {
        return fname;
    }
    return fname.substring(start + 1, fname.length);
}
/**
*
*获取文件夹
*@param {String}fname 文件名
*/
Path.GetDirectoryName = function (fname) {
    var start = fname.lastIndexOf("/");
    if (start < 0) {
        return "";
    }
    return fname.substring(0, start);
}
/**
*
*获取文件夹
*@param {String}fname 文件名
*/
Path.Combine = function (dir, fname) {
    return dir + fname;
}
Path.ChangeExtension = function (fname, newExt) {
    return fname.replace(Path.GetExtension(fname), newExt);
}
//    return Path;
//});

if (typeof module === "undefined") {
    this.Path = Path;
} else {
    module.exports = Path;
}
if (typeof define === "function") {
    define('Path',[],function () { return Path; });
};
//define(function () {

/**
*  
*@param {String}url
*@param {MeteoLib.Util~successCallback}successCallback
*@param {MeteoLib.Util~errorCallback}errorCallback
*@memberof MeteoLib.Util
*@static
*/
function loadArrayBuffer(url, successCallback, errorCallback) {
    loadWithXhr.load(url, "arraybuffer", "GET", null, null, { resolve: successCallback, reject: errorCallback });
}
/**
*@callback MeteoLib.Util~successCallback
*@param {ArrayBuffer}loadedArrayBuffer
*/

/**
*@callback MeteoLib.Util~errorCallback
*@param {Error}loadError
*/

function defined(value) {
    return value !== undefined && value !== null;
}
var loadWithXhr = {};
// This is broken out into a separate function so that it can be mocked for testing purposes.
loadWithXhr.load = function (url, responseType, method, data, headers, deferred, overrideMimeType) {
    var xhr = new XMLHttpRequest();

    if (defined(overrideMimeType) && defined(xhr.overrideMimeType)) {
        xhr.overrideMimeType(overrideMimeType);
    }

    xhr.open(method, url, true);

    if (defined(headers)) {
        for (var key in headers) {
            if (headers.hasOwnProperty(key)) {
                xhr.setRequestHeader(key, headers[key]);
            }
        }
    }

    if (defined(responseType)) {
        xhr.responseType = responseType;
    }

    xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) {
            deferred.reject(new RequestErrorEvent(xhr.status, xhr.response, xhr.getAllResponseHeaders()));
            return;
        }

        var response = xhr.response;
        var browserResponseType = xhr.responseType;

        //All modern browsers will go into either the first if block or last else block.
        //Other code paths support older browsers that either do not support the supplied responseType
        //or do not support the xhr.response property.
        if (defined(response) && (!defined(responseType) || (browserResponseType === responseType))) {
            deferred.resolve(response);
        } else if ((responseType === 'json') && typeof response === 'string') {
            try {
                deferred.resolve(JSON.parse(response));
            } catch (e) {
                deferred.reject(e);
            }
        } else if ((browserResponseType === '' || browserResponseType === 'document') && defined(xhr.responseXML) && xhr.responseXML.hasChildNodes()) {
            deferred.resolve(xhr.responseXML);
        } else if ((browserResponseType === '' || browserResponseType === 'text') && defined(xhr.responseText)) {
            deferred.resolve(xhr.responseText);
        } else {
            deferred.reject(new RuntimeError('Invalid XMLHttpRequest response type.'));
        }
    };

    xhr.onerror = function (e) {
        deferred.reject(new Error("请求出错" + e.data));
    };
    xhr.onreadystatechange = function () {
        if (this.status == 404) {
            deferred.reject(new Error("请求“" + url + "”出错:" + this.statusText));
        }
    }
    xhr.send(data);
};

//    return loadArrayBuffer;
//})
if (typeof module === "undefined") {
    this.loadArrayBuffer = loadArrayBuffer;
} else {
    module.exports = loadArrayBuffer;
}
if (typeof define === "function") {
    define('loadArrayBuffer',[],function () { return loadArrayBuffer; });
};
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */



function TIFFParser() {
	this.tiffDataView = undefined;
	this.littleEndian = undefined;
	this.fileDirectories = [];
};

TIFFParser.prototype = {
	isLittleEndian: function () {
		// Get byte order mark.
		var BOM = this.getBytes(2, 0);

		// Find out the endianness.
		if (BOM === 0x4949) {
			this.littleEndian = true;
		} else if (BOM === 0x4D4D) {
			this.littleEndian = false;
		} else {
			console.log( BOM );
			throw TypeError("Invalid byte order value.");
		}

		return this.littleEndian;
	},

	hasTowel: function () {
		// Check for towel.
		if (this.getBytes(2, 2) !== 42) {
			throw RangeError("You forgot your towel!");
			return false;
		}

		return true;
	},

	getFieldTagName: function (fieldTag) {
		// See: http://www.digitizationguidelines.gov/guidelines/TIFF_Metadata_Final.pdf
		// See: http://www.digitalpreservation.gov/formats/content/tiff_tags.shtml
		var fieldTagNames = {
			// TIFF Baseline
			0x013B: 'Artist',
			0x0102: 'BitsPerSample',
			0x0109: 'CellLength',
			0x0108: 'CellWidth',
			0x0140: 'ColorMap',
			0x0103: 'Compression',
			0x8298: 'Copyright',
			0x0132: 'DateTime',
			0x0152: 'ExtraSamples',
			0x010A: 'FillOrder',
			0x0121: 'FreeByteCounts',
			0x0120: 'FreeOffsets',
			0x0123: 'GrayResponseCurve',
			0x0122: 'GrayResponseUnit',
			0x013C: 'HostComputer',
			0x010E: 'ImageDescription',
			0x0101: 'ImageLength',
			0x0100: 'ImageWidth',
			0x010F: 'Make',
			0x0119: 'MaxSampleValue',
			0x0118: 'MinSampleValue',
			0x0110: 'Model',
			0x00FE: 'NewSubfileType',
			0x0112: 'Orientation',
			0x0106: 'PhotometricInterpretation',
			0x011C: 'PlanarConfiguration',
			0x0128: 'ResolutionUnit',
			0x0116: 'RowsPerStrip',
			0x0115: 'SamplesPerPixel',
			0x0131: 'Software',
			0x0117: 'StripByteCounts',
			0x0111: 'StripOffsets',
			0x00FF: 'SubfileType',
			0x0107: 'Threshholding',
			0x011A: 'XResolution',
			0x011B: 'YResolution',

			// TIFF Extended
			0x0146: 'BadFaxLines',
			0x0147: 'CleanFaxData',
			0x0157: 'ClipPath',
			0x0148: 'ConsecutiveBadFaxLines',
			0x01B1: 'Decode',
			0x01B2: 'DefaultImageColor',
			0x010D: 'DocumentName',
			0x0150: 'DotRange',
			0x0141: 'HalftoneHints',
			0x015A: 'Indexed',
			0x015B: 'JPEGTables',
			0x011D: 'PageName',
			0x0129: 'PageNumber',
			0x013D: 'Predictor',
			0x013F: 'PrimaryChromaticities',
			0x0214: 'ReferenceBlackWhite',
			0x0153: 'SampleFormat',
			0x022F: 'StripRowCounts',
			0x014A: 'SubIFDs',
			0x0124: 'T4Options',
			0x0125: 'T6Options',
			0x0145: 'TileByteCounts',
			0x0143: 'TileLength',
			0x0144: 'TileOffsets',
			0x0142: 'TileWidth',
			0x012D: 'TransferFunction',
			0x013E: 'WhitePoint',
			0x0158: 'XClipPathUnits',
			0x011E: 'XPosition',
			0x0211: 'YCbCrCoefficients',
			0x0213: 'YCbCrPositioning',
			0x0212: 'YCbCrSubSampling',
			0x0159: 'YClipPathUnits',
			0x011F: 'YPosition',

			// EXIF
			0x9202: 'ApertureValue',
			0xA001: 'ColorSpace',
			0x9004: 'DateTimeDigitized',
			0x9003: 'DateTimeOriginal',
			0x8769: 'Exif IFD',
			0x9000: 'ExifVersion',
			0x829A: 'ExposureTime',
			0xA300: 'FileSource',
			0x9209: 'Flash',
			0xA000: 'FlashpixVersion',
			0x829D: 'FNumber',
			0xA420: 'ImageUniqueID',
			0x9208: 'LightSource',
			0x927C: 'MakerNote',
			0x9201: 'ShutterSpeedValue',
			0x9286: 'UserComment',

			// IPTC
			0x83BB: 'IPTC',

			// ICC
			0x8773: 'ICC Profile',

			// XMP
			0x02BC: 'XMP',

			// GDAL
			0xA480: 'GDAL_METADATA',
			0xA481: 'GDAL_NODATA',

			// Photoshop
			0x8649: 'Photoshop',
		};

		var fieldTagName;

		if (fieldTag in fieldTagNames) {
			fieldTagName = fieldTagNames[fieldTag];
		} else {
			console.log( "Unknown Field Tag:", fieldTag);
			fieldTagName = "Tag" + fieldTag;
		}

		return fieldTagName;
	},

	getFieldTypeName: function (fieldType) {
		var fieldTypeNames = {
			0x0001: 'BYTE',
			0x0002: 'ASCII',
			0x0003: 'SHORT',
			0x0004: 'LONG',
			0x0005: 'RATIONAL',
			0x0006: 'SBYTE',
			0x0007: 'UNDEFINED',
			0x0008: 'SSHORT',
			0x0009: 'SLONG',
			0x000A: 'SRATIONAL',
			0x000B: 'FLOAT',
			0x000C: 'DOUBLE',
		};

		var fieldTypeName;

		if (fieldType in fieldTypeNames) {
			fieldTypeName = fieldTypeNames[fieldType];
		}

		return fieldTypeName;
	},

	getFieldTypeLength: function (fieldTypeName) {
		var fieldTypeLength;

		if (['BYTE', 'ASCII', 'SBYTE', 'UNDEFINED'].indexOf(fieldTypeName) !== -1) {
			fieldTypeLength = 1;
		} else if (['SHORT', 'SSHORT'].indexOf(fieldTypeName) !== -1) {
			fieldTypeLength = 2;
		} else if (['LONG', 'SLONG', 'FLOAT'].indexOf(fieldTypeName) !== -1) {
			fieldTypeLength = 4;
		} else if (['RATIONAL', 'SRATIONAL', 'DOUBLE'].indexOf(fieldTypeName) !== -1) {
			fieldTypeLength = 8;
		}

		return fieldTypeLength;
	},

	getBits: function (numBits, byteOffset, bitOffset) {
		bitOffset = bitOffset || 0;
		var extraBytes = Math.floor(bitOffset / 8);
		var newByteOffset = byteOffset + extraBytes;
		var totalBits = bitOffset + numBits;
		var shiftRight = 32 - numBits;

		if (totalBits <= 0) {
			console.log( numBits, byteOffset, bitOffset );
			throw RangeError("No bits requested");
		} else if (totalBits <= 8) {
			var shiftLeft = 24 + bitOffset;
			var rawBits = this.tiffDataView.getUint8(newByteOffset, this.littleEndian);
		} else if (totalBits <= 16) {
			var shiftLeft = 16 + bitOffset;
			var rawBits = this.tiffDataView.getUint16(newByteOffset, this.littleEndian);
		} else if (totalBits <= 32) {
			var shiftLeft = bitOffset;
			var rawBits = this.tiffDataView.getUint32(newByteOffset, this.littleEndian);
		} else {
			console.log( numBits, byteOffset, bitOffset );
			throw RangeError("Too many bits requested");
		}

		var chunkInfo = {
			'bits': ((rawBits << shiftLeft) >>> shiftRight),
			'byteOffset': newByteOffset + Math.floor(totalBits / 8),
			'bitOffset': totalBits % 8,
		};

		return chunkInfo;
	},

	getBytes: function (numBytes, offset) {
		if (numBytes <= 0) {
			console.log( numBytes, offset );
			throw RangeError("No bytes requested");
		} else if (numBytes <= 1) {
			return this.tiffDataView.getUint8(offset, this.littleEndian);
		} else if (numBytes <= 2) {
			return this.tiffDataView.getUint16(offset, this.littleEndian);
		} else if (numBytes <= 3) {
			return this.tiffDataView.getUint32(offset, this.littleEndian) >>> 8;
		} else if (numBytes <= 4) {
			return this.tiffDataView.getUint32(offset, this.littleEndian);
		} else {
			console.log( numBytes, offset );
			throw RangeError("Too many bytes requested");
		}
	},

	getFieldValues: function (fieldTagName, fieldTypeName, typeCount, valueOffset) {
		var fieldValues = [];

		var fieldTypeLength = this.getFieldTypeLength(fieldTypeName);
		var fieldValueSize = fieldTypeLength * typeCount;

		if (fieldValueSize <= 4) {
			// The value is stored at the big end of the valueOffset.
			if (this.littleEndian === false) {
				var value = valueOffset >>> ((4 - fieldTypeLength) * 8);
			} else {
				var value = valueOffset;
			}

			fieldValues.push(value);
		} else {
			for (var i = 0; i < typeCount; i++) {
				var indexOffset = fieldTypeLength * i;

				if (fieldTypeLength >= 8) {
					if (['RATIONAL', 'SRATIONAL'].indexOf(fieldTypeName) !== -1) {
						// Numerator
						fieldValues.push(this.getBytes(4, valueOffset + indexOffset));
						// Denominator
						fieldValues.push(this.getBytes(4, valueOffset + indexOffset + 4));
//					} else if (['DOUBLE'].indexOf(fieldTypeName) !== -1) {
//						fieldValues.push(this.getBytes(4, valueOffset + indexOffset) + this.getBytes(4, valueOffset + indexOffset + 4));
					} else {
						console.log( fieldTypeName, typeCount, fieldValueSize );
						throw TypeError("Can't handle this field type or size");
					}
				} else {
					fieldValues.push(this.getBytes(fieldTypeLength, valueOffset + indexOffset));
				}
			}
		}

		if (fieldTypeName === 'ASCII') {
			fieldValues.forEach(function(e, i, a) { a[i] = String.fromCharCode(e); });
		}

		return fieldValues;
	},

	clampColorSample: function(colorSample, bitsPerSample) {
		var multiplier = Math.pow(2, 8 - bitsPerSample);

		return Math.floor((colorSample * multiplier) + (multiplier - 1));
	},

	makeRGBAFillValue: function(r, g, b, a) {
		if(typeof a === 'undefined') {
			a = 1.0;
		}
		return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
	},

	parseFileDirectory: function (byteOffset) {
		var numDirEntries = this.getBytes(2, byteOffset);

		var tiffFields = [];

		for (var i = byteOffset + 2, entryCount = 0; entryCount < numDirEntries; i += 12, entryCount++) {
			var fieldTag = this.getBytes(2, i);
			var fieldType = this.getBytes(2, i + 2);
			var typeCount = this.getBytes(4, i + 4);
			var valueOffset = this.getBytes(4, i + 8);

			var fieldTagName = this.getFieldTagName( fieldTag );
			var fieldTypeName = this.getFieldTypeName( fieldType );

			var fieldValues = this.getFieldValues(fieldTagName, fieldTypeName, typeCount, valueOffset);

			tiffFields[fieldTagName] = { 'type': fieldTypeName, 'values': fieldValues };
		}

		this.fileDirectories.push( tiffFields );

		var nextIFDByteOffset = this.getBytes(4, i);

		if (nextIFDByteOffset === 0x00000000) {
			return this.fileDirectories;
		} else {
			return this.parseFileDirectory(nextIFDByteOffset);
		}
	},

	parseTIFF: function (tiffArrayBuffer, canvas) {
		canvas = canvas || document.createElement('canvas');

		this.tiffDataView = new DataView(tiffArrayBuffer);
		this.canvas = canvas;

		this.littleEndian = this.isLittleEndian(this.tiffDataView);

		if (!this.hasTowel(this.tiffDataView, this.littleEndian)) {
			return;
		}

		var firstIFDByteOffset = this.getBytes(4, 4);

		this.fileDirectories = this.parseFileDirectory(firstIFDByteOffset);

		var fileDirectory = this.fileDirectories[0];

		console.log( fileDirectory );

		var imageWidth = fileDirectory.ImageWidth.values[0];
		var imageLength = fileDirectory.ImageLength.values[0];

		this.canvas.width = imageWidth;
		this.canvas.height = imageLength;

		var strips = [];

		var compression = (fileDirectory.Compression) ? fileDirectory.Compression.values[0] : 1;

		var samplesPerPixel = fileDirectory.SamplesPerPixel.values[0];

		var sampleProperties = [];

		var bitsPerPixel = 0;
		var hasBytesPerPixel = false;

		fileDirectory.BitsPerSample.values.forEach(function(bitsPerSample, i, bitsPerSampleValues) {
			sampleProperties[i] = {
				'bitsPerSample': bitsPerSample,
				'hasBytesPerSample': false,
				'bytesPerSample': undefined,
			};

			if ((bitsPerSample % 8) === 0) {
				sampleProperties[i].hasBytesPerSample = true;
				sampleProperties[i].bytesPerSample = bitsPerSample / 8;
			}

			bitsPerPixel += bitsPerSample;
		}, this);

		if ((bitsPerPixel % 8) === 0) {
			hasBytesPerPixel = true;
			var bytesPerPixel = bitsPerPixel / 8;
		}

		var stripOffsetValues = fileDirectory.StripOffsets.values;
		var numStripOffsetValues = stripOffsetValues.length;

		// StripByteCounts is supposed to be required, but see if we can recover anyway.
		if (fileDirectory.StripByteCounts) {
			var stripByteCountValues = fileDirectory.StripByteCounts.values;
		} else {
			console.log("Missing StripByteCounts!");

			// Infer StripByteCounts, if possible.
			if (numStripOffsetValues === 1) {
				var stripByteCountValues = [Math.ceil((imageWidth * imageLength * bitsPerPixel) / 8)];
			} else {
				throw Error("Cannot recover from missing StripByteCounts");
			}
		}

		// Loop through strips and decompress as necessary.
		for (var i = 0; i < numStripOffsetValues; i++) {
			var stripOffset = stripOffsetValues[i];
			strips[i] = [];

			var stripByteCount = stripByteCountValues[i];

			// Loop through pixels.
			for (var byteOffset = 0, bitOffset = 0, jIncrement = 1, getHeader = true, pixel = [], numBytes = 0, sample = 0, currentSample = 0; byteOffset < stripByteCount; byteOffset += jIncrement) {
				// Decompress strip.
				switch (compression) {
					// Uncompressed
					case 1:
						// Loop through samples (sub-pixels).
						for (var m = 0, pixel = []; m < samplesPerPixel; m++) {
							if (sampleProperties[m].hasBytesPerSample) {
								// XXX: This is wrong!
								var sampleOffset = sampleProperties[m].bytesPerSample * m;

								pixel.push(this.getBytes(sampleProperties[m].bytesPerSample, stripOffset + byteOffset + sampleOffset));
							} else {
								var sampleInfo = this.getBits(sampleProperties[m].bitsPerSample, stripOffset + byteOffset, bitOffset);

								pixel.push(sampleInfo.bits);

								byteOffset = sampleInfo.byteOffset - stripOffset;
								bitOffset = sampleInfo.bitOffset;

								throw RangeError("Cannot handle sub-byte bits per sample");
							}
						}

						strips[i].push(pixel);

						if (hasBytesPerPixel) {
							jIncrement = bytesPerPixel;
						} else {
							jIncrement = 0;

							throw RangeError("Cannot handle sub-byte bits per pixel");
						}
					break;

					// CITT Group 3 1-Dimensional Modified Huffman run-length encoding
					case 2:
						// XXX: Use PDF.js code?
					break;

					// Group 3 Fax
					case 3:
						// XXX: Use PDF.js code?
					break;

					// Group 4 Fax
					case 4:
						// XXX: Use PDF.js code?
					break;

					// LZW
					case 5:
						// XXX: Use PDF.js code?
					break;

					// Old-style JPEG (TIFF 6.0)
					case 6:
						// XXX: Use PDF.js code?
					break;

					// New-style JPEG (TIFF Specification Supplement 2)
					case 7:
						// XXX: Use PDF.js code?
					break;

					// PackBits
					case 32773:
						// Are we ready for a new block?
						if (getHeader) {
							getHeader = false;

							var blockLength = 1;
							var iterations = 1;

							// The header byte is signed.
							var header = this.tiffDataView.getInt8(stripOffset + byteOffset, this.littleEndian);

							if ((header >= 0) && (header <= 127)) { // Normal pixels.
								blockLength = header + 1;
							} else if ((header >= -127) && (header <= -1)) { // Collapsed pixels.
								iterations = -header + 1;
							} else /*if (header === -128)*/ { // Placeholder byte?
								getHeader = true;
							}
						} else {
							var currentByte = this.getBytes(1, stripOffset + byteOffset);

							// Duplicate bytes, if necessary.
							for (var m = 0; m < iterations; m++) {
								if (sampleProperties[sample].hasBytesPerSample) {
									// We're reading one byte at a time, so we need to handle multi-byte samples.
									currentSample = (currentSample << (8 * numBytes)) | currentByte;
									numBytes++;

									// Is our sample complete?
									if (numBytes === sampleProperties[sample].bytesPerSample) {
										pixel.push(currentSample);
										currentSample = numBytes = 0;
										sample++;
									}
								} else {
									throw RangeError("Cannot handle sub-byte bits per sample");
								}

								// Is our pixel complete?
								if (sample === samplesPerPixel)
								{
									strips[i].push(pixel);

									pixel = [];
									sample = 0;
								}
							}

							blockLength--;

							// Is our block complete?
							if (blockLength === 0) {
								getHeader = true;
							}
						}

						jIncrement = 1;
					break;

					// Unknown compression algorithm
					default:
						// Do not attempt to parse the image data.
					break;
				}
			}

//			console.log( strips[i] );
		}

//		console.log( strips );

		if (canvas.getContext) {
			var ctx = this.canvas.getContext("2d");

			// Set a default fill style.
			ctx.fillStyle = this.makeRGBAFillValue(255, 255, 255, 0);

			// If RowsPerStrip is missing, the whole image is in one strip.
			if (fileDirectory.RowsPerStrip) {
				var rowsPerStrip = fileDirectory.RowsPerStrip.values[0];
			} else {
				var rowsPerStrip = imageLength;
			}

			var numStrips = strips.length;

			var imageLengthModRowsPerStrip = imageLength % rowsPerStrip;
			var rowsInLastStrip = (imageLengthModRowsPerStrip === 0) ? rowsPerStrip : imageLengthModRowsPerStrip;

			var numRowsInStrip = rowsPerStrip;
			var numRowsInPreviousStrip = 0;

			var photometricInterpretation = fileDirectory.PhotometricInterpretation.values[0];

			var extraSamplesValues = [];
			var numExtraSamples = 0;

			if (fileDirectory.ExtraSamples) {
				extraSamplesValues = fileDirectory.ExtraSamples.values;
				numExtraSamples = extraSamplesValues.length;
			}

			if (fileDirectory.ColorMap) {
				var colorMapValues = fileDirectory.ColorMap.values;
				var colorMapSampleSize = Math.pow(2, sampleProperties[0].bitsPerSample);
			}

			// Loop through the strips in the image.
			for (var i = 0; i < numStrips; i++) {
				// The last strip may be short.
				if ((i + 1) === numStrips) {
					numRowsInStrip = rowsInLastStrip;
				}

				var numPixels = strips[i].length;
				var yPadding = numRowsInPreviousStrip * i;

				// Loop through the rows in the strip.
				for (var y = 0, j = 0; y < numRowsInStrip, j < numPixels; y++) {
					// Loop through the pixels in the row.
					for (var x = 0; x < imageWidth; x++, j++) {
						var pixelSamples = strips[i][j];

						var red = 0;
						var green = 0;
						var blue = 0;
						var opacity = 1.0;

						if (numExtraSamples > 0) {
							for (var k = 0; k < numExtraSamples; k++) {
								if (extraSamplesValues[k] === 1 || extraSamplesValues[k] === 2) {
									// Clamp opacity to the range [0,1].
									opacity = pixelSamples[3 + k] / 256;

									break;
								}
							}
						}

						switch (photometricInterpretation) {
							// Bilevel or Grayscale
							// WhiteIsZero
							case 0:
								if (sampleProperties[0].hasBytesPerSample) {
									var invertValue = Math.pow(0x10, sampleProperties[0].bytesPerSample * 2);
								}

								// Invert samples.
								pixelSamples.forEach(function(sample, index, samples) { samples[index] = invertValue - sample; });

							// Bilevel or Grayscale
							// BlackIsZero
							case 1:
								red = green = blue = this.clampColorSample(pixelSamples[0], sampleProperties[0].bitsPerSample);
							break;

							// RGB Full Color
							case 2:
								red = this.clampColorSample(pixelSamples[0], sampleProperties[0].bitsPerSample);
								green = this.clampColorSample(pixelSamples[1], sampleProperties[1].bitsPerSample);
								blue = this.clampColorSample(pixelSamples[2], sampleProperties[2].bitsPerSample);
							break;

							// RGB Color Palette
							case 3:
								if (colorMapValues === undefined) {
									throw Error("Palette image missing color map");
								}

								var colorMapIndex = pixelSamples[0];

								red = this.clampColorSample(colorMapValues[colorMapIndex], 16);
								green = this.clampColorSample(colorMapValues[colorMapSampleSize + colorMapIndex], 16);
								blue = this.clampColorSample(colorMapValues[(2 * colorMapSampleSize) + colorMapIndex], 16);
							break;

							// Transparency mask
							case 4:
								throw RangeError( 'Not Yet Implemented: Transparency mask' );
							break;

							// CMYK
							case 5:
								throw RangeError( 'Not Yet Implemented: CMYK' );
							break;

							// YCbCr
							case 6:
								throw RangeError( 'Not Yet Implemented: YCbCr' );
							break;

							// CIELab
							case 8:
								throw RangeError( 'Not Yet Implemented: CIELab' );
							break;

							// Unknown Photometric Interpretation
							default:
								throw RangeError( 'Unknown Photometric Interpretation:', photometricInterpretation );
							break;
						}

						ctx.fillStyle = this.makeRGBAFillValue(red, green, blue, opacity);
						ctx.fillRect(x, yPadding + y, 1, 1);
					}
				}

				numRowsInPreviousStrip = numRowsInStrip;
			}
		}

/*		for (var i = 0, numFileDirectories = this.fileDirectories.length; i < numFileDirectories; i++) {
			// Stuff
		}*/

		return this.canvas;
	},
}
if (typeof module === "undefined") {
    this.TIFFParser = TIFFParser;
} else {
    module.exports = TIFFParser;
}
if (typeof define === "function") {
    define('ThirdParty/tiff-js/tiff',[],function () { return TIFFParser; });
}
;
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
        else {//����tif��png����
            loadArrayBuffer(imagePath, function (imageArrayBuffer) {

                if (extension == 'tif') {//����tif����
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
    define('Gltf/loadTextureImage',[
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
};
Material = function () { };
Material.createMaterial = function createMaterial() {
    return {
        ambientColor: undefined,               // Ka
        emissionColor: undefined,              // Ke
        diffuseColor: undefined,               // Kd
        specularColor: undefined,              // Ks
        specularShininess: undefined,          // Ns
        alpha: undefined,                      // d / Tr
        ambientColorMap: undefined,            // map_Ka
        emissionColorMap: undefined,           // map_Ke
        diffuseColorMap: undefined,            // map_Kd
        specularColorMap: undefined,           // map_Ks
        specularShininessMap: undefined,       // map_Ns
        normalMap: undefined,                  // map_Bump
        alphaMap: undefined                    // map_d
    };
}

/**
* 
*@return {Object}
*@private
*/
Material.getDefault = function getDefault() {
    var material = createMaterial();
    material.diffuseColor = [0.5, 0.5, 0.5, 1.0];
    return material;
}
if (typeof define === "function") {
    define('Gltf/Material',[], function () {
        return Material;
    });
};

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
    define('parseThreeGroup2Obj',[
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
};


    window. none_frag = "\n\
#ifdef GL_ES\n\
    precision highp float;\n\
#endif\n\
\n\
varying vec3 v_position;\n\
\n\
uniform vec4 u_ambient;\n\
uniform vec4 u_diffuse;\n\
uniform vec4 u_specular;\n\
uniform float u_shininess;\n\
\n\
void main(void) \n\
{\n\
    vec4 color = vec4(0.0, 0.0, 0.0, 0.0);\n\
    vec4 ambient = u_ambient;\n\
    vec4 diffuse = u_diffuse;\n\
    vec4 specular = u_specular;\n\
    color.xyz += ambient.xyz;\n\
    color.xyz += diffuse.xyz;\n\
    color.xyz += specular.xyz;\n\
    color = vec4(color.rgb * diffuse.a, diffuse.a);\n\
    gl_FragColor = color;\n\
}";
    if (typeof define === "function")
    define('Gltf/Shaders/none_frag',[],function () {
    return none_frag;

});

    window.none_vert = "\n\
#ifdef GL_ES\n\
    precision highp float;\n\
#endif\n\
\n\
attribute vec3 a_position;\n\
\n\
uniform mat4 u_modelViewMatrix;\n\
uniform mat4 u_projectionMatrix;\n\
\n\
varying vec3 v_position;\n\
\n\
void main(void) \n\
{\n\
    vec4 pos = u_modelViewMatrix * vec4(a_position,1.0);\n\
    v_position = pos.xyz;\n\
    gl_Position = u_projectionMatrix * pos;\n\
}";
    if (typeof define === "function")  
        define('Gltf/Shaders/none_vert',[],function () {
            return none_vert;
        })
     ;

window.normals_frag = "\n\
\n\
varying vec3 v_position;\n\
varying vec3 v_normal;\n\
\n\
uniform vec4 u_ambient;\n\
uniform vec4 u_diffuse;\n\
uniform vec4 u_specular;\n\
uniform float u_shininess;\n\
uniform float u_transparency;\n\
\n\
void main()\n\
{\n\
    vec3 positionToEyeEC = -v_position; \n\
\n\
    vec3 normalEC = normalize(v_normal);\n\
#ifdef FACE_FORWARD\n\
    normalEC = faceforward(normalEC, vec3(0.0, 0.0, 1.0), -normalEC);\n\
#endif\n\
\n\
    czm_material material;\n\
    material.diffuse = u_diffuse.rgb+u_specular.rgb+u_ambient.rgb;\n\
    material.specular = u_specular.a;\n\
    material.shininess = 1.0;\n\
    material.normal =  normalEC;\n\
    material.emission =u_ambient.xyz;\n\
    material.alpha = u_transparency;\n\
    \n\
#ifdef FLAT    \n\
    gl_FragColor = vec4(material.diffuse + material.emission, material.alpha);\n\
#else\n\
    gl_FragColor = czm_phong(normalize(positionToEyeEC), material);\n\
#endif\n\
}\n\
";

if (typeof define === "function")
    define('Gltf/Shaders/normals_frag',[],function () {
        return normals_frag;
    });

    window.normals_vert = "\n\
#ifdef GL_ES\n\
    precision highp float;\n\
#endif\n\
\n\
attribute vec3 a_position;\n\
attribute vec3 a_normal;\n\
\n\
uniform mat3 u_normalMatrix;\n\
uniform mat4 u_modelViewMatrix;\n\
uniform mat4 u_projectionMatrix;\n\
\n\
varying vec3 v_position;\n\
varying vec3 v_normal;\n\
\n\
varying vec3 v_light0Direction;\n\
\n\
void main(void) \n\
{\n\
    vec4 pos = u_modelViewMatrix * vec4(a_position,1.0);\n\
    v_normal = u_normalMatrix * a_normal;\n\
    v_position = pos.xyz;\n\
    v_light0Direction = mat3(u_modelViewMatrix) * vec3(1.0,1.0,1.0);\n\
    gl_Position = u_projectionMatrix * pos;\n\
}";
    if (typeof define === "function")
    define('Gltf/Shaders/normals_vert',[],function () {
    return normals_vert;
});

    window.texture_frag = "\n\
#ifdef GL_ES\n\
    precision highp float;\n\
#endif\n\
\n\
varying vec3 v_position;\n\
varying vec2 v_texcoord0;\n\
\n\
uniform vec4 u_ambient;\n\
uniform sampler2D u_diffuse;\n\
uniform vec4 u_specular;\n\
uniform float u_shininess;\n\
\n\
uniform float u_transparency;\n\
\n\
void main(void) \n\
{\n\
    vec4 color = vec4(0.0, 0.0, 0.0, 0.0);\n\
    vec3 diffuseLight = vec3(0.0, 0.0, 0.0);\n\
    vec3 lightColor = vec3(1.0,1.0,1.0);\n\
    vec4 ambient = u_ambient;\n\
    vec4 diffuse = texture2D(u_diffuse, v_texcoord0);\n\
    vec4 specular = u_specular;\n\
    color.xyz += ambient.xyz;\n\
    color.xyz += diffuse.xyz;\n\
    color.xyz += specular.xyz;\n\
    color = vec4(diffuse.rgb * diffuse.a, diffuse.a*u_transparency);\n\
    gl_FragColor = color;\n\
}";
    if (typeof define === "function")
    define('Gltf/Shaders/texture_frag',[],function () {
    return texture_frag;
})
;

window.texture_vert = "\n\
#ifdef GL_ES\n\
    precision highp float;\n\
#endif\n\
\n\
attribute vec3 a_position;\n\
attribute vec2 a_texcoord0;\n\
\n\
uniform mat4 u_modelViewMatrix;\n\
uniform mat4 u_projectionMatrix;\n\
\n\
varying vec3 v_position;\n\
varying vec2 v_texcoord0;\n\
\n\
void main(void) \n\
{\n\
    vec4 pos = u_modelViewMatrix * vec4(a_position,1.0);\n\
    v_texcoord0 = a_texcoord0;\n\
    v_position = pos.xyz;\n\
    gl_Position = u_projectionMatrix * pos;\n\
}";
if (typeof define === "function")
define('Gltf/Shaders/texture_vert',[],function () {
    return texture_vert;
});

window.texture_normals_frag = "\n\
#ifdef GL_ES\n\
    precision highp float;\n\
#endif\n\
\n\
varying vec3 v_position;\n\
varying vec2 v_texcoord0;\n\
varying vec3 v_normal;\n\
\n\
uniform vec4 u_ambient;\n\
uniform vec4 u_specular;\n\
uniform float u_shininess;\n\
\n\
uniform sampler2D u_diffuse;\n\
\n\
varying vec3 v_light0Direction;\n\
\n\
void main(void) \n\
{\n\
    vec3 normal = normalize(v_normal);\n\
    vec4 color = vec4(0.0, 0.0, 0.0, 0.0);\n\
    vec3 diffuseLight = vec3(0.0, 0.0, 0.0);\n\
    vec3 lightColor = vec3(1.0,1.0,1.0);\n\
    vec4 ambient = u_ambient;\n\
    vec4 diffuse = texture2D(u_diffuse, v_texcoord0);\n\
    vec4 specular = u_specular;\n\
\n\
    vec3 specularLight = vec3(0.0, 0.0, 0.0);\n\
    {\n\
        float specularIntensity = 0.0;\n\
        float attenuation = 1.0;\n\
        vec3 l = normalize(v_light0Direction);\n\
        vec3 viewDir = -normalize(v_position);\n\
        vec3 h = normalize(l+viewDir);\n\
        specularIntensity = max(0.0, pow(max(dot(normal,h), 0.0) , u_shininess)) * attenuation;\n\
        specularLight += lightColor * specularIntensity;\n\
        diffuseLight += lightColor * max(dot(normal,l), 0.0) * attenuation;\n\
    }\n\
    //specular.xyz *= specularLight;\n\
     // diffuse.xyz *= diffuseLight;\n\
    color.xyz += ambient.xyz;\n\
    color.xyz += diffuse.xyz;\n\
    color.xyz += specular.xyz;\n\
    color = vec4(diffuse.rgb * diffuse.a, diffuse.a);\n\
    gl_FragColor = color;\n\
}";

window.texture_normals_frag = "\n\
#ifdef GL_ES\n\
    precision highp float;\n\
#endif\n\
\n\
varying vec3 v_position;\n\
varying vec2 v_texcoord0;\n\
varying vec3 v_normal;\n\
\n\
uniform vec4 u_ambient;\n\
uniform vec4 u_specular;\n\
uniform float u_shininess;\n\
\n\
uniform sampler2D u_diffuse;\n\
\n\
varying vec3 v_light0Direction;\n\
\n\
void main()\n\
{\n\
    vec3 positionToEyeEC = -v_position; \n\
\n\
    vec3 normalEC = normalize(v_normal);\n\
#ifdef FACE_FORWARD\n\
    normalEC = faceforward(normalEC, vec3(0.0, 0.0, 1.0), -normalEC);\n\
#endif\n\
\n\
    vec4 diffuse = texture2D(u_diffuse, v_texcoord0);\n\
\n\
    czm_material material;\n\
    material.diffuse = diffuse.rgb;\n\
    material.specular = u_specular.r;\n\
    material.shininess = u_shininess;\n\
    material.normal =  normalEC;\n\
    material.emission =u_ambient.xyz;\n\
    material.alpha = diffuse.a;\n\
    \n\
#ifdef FLAT    \n\
    gl_FragColor = vec4(material.diffuse + material.emission, material.alpha);\n\
#else\n\
    gl_FragColor = czm_phong(normalize(positionToEyeEC), material);\n\
#endif\n\
}\n\
";

if (typeof define === "function")
    define('Gltf/Shaders/texture_normals_frag',[],function () {
        return texture_normals_frag;
    });

    window.texture_normals_vert = "\n\
#ifdef GL_ES\n\
    precision highp float;\n\
#endif\n\
\n\
attribute vec3 a_position;\n\
attribute vec2 a_texcoord0;\n\
attribute vec3 a_normal;\n\
\n\
uniform mat3 u_normalMatrix;\n\
uniform mat4 u_modelViewMatrix;\n\
uniform mat4 u_projectionMatrix;\n\
\n\
varying vec3 v_position;\n\
varying vec2 v_texcoord0;\n\
varying vec3 v_normal;\n\
\n\
varying vec3 v_light0Direction;\n\
\n\
void main(void) \n\
{\n\
    vec4 pos = u_modelViewMatrix * vec4(a_position,1.0);\n\
    v_normal = u_normalMatrix * a_normal;\n\
    v_texcoord0 = a_texcoord0;\n\
    v_position = pos.xyz;\n\
    v_light0Direction = mat3(u_modelViewMatrix) * vec3(1.0,1.0,1.0);\n\
    gl_Position = u_projectionMatrix * pos;\n\
}";
    if (typeof define === "function")
    define('Gltf/Shaders/texture_normals_vert',[],function () {
    return texture_normals_vert;
});

/*
    * Javascript base64encode() base64加密函数
      用于生成字符串对应的base64加密字符串
    * 吴先成  www.51-n.com ohcc@163.com QQ:229256237
    * @param string input 原始字符串
    * @return string 加密后的base64字符串
   */
function base64Encode(input) {
    var rv;
    rv = encodeURIComponent(input);
    rv = unescape(rv);
    rv = window.btoa(rv);
    return rv;
}

/*
 * Javascript base64Decode() base64解密函数
   用于解密base64加密的字符串
 * 吴先成  www.51-n.com ohcc@163.com QQ:229256237
 * @param string input base64加密字符串
 * @return string 解密后的字符串
*/
function base64Decode(input) {
    rv = window.atob(input);
    rv = escape(rv);
    rv = decodeURIComponent(rv);
    return rv;
}


var WebGLConstants = Cesium.WebGLConstants;
/**
 * A class for managing the {@link Technique}s that may be required for
 * rendering data that is contained in an OBJ file. It allows obtaining
 * the {@link Technique}s for elements with and without textures and
 * normals, and adds the required {@link Program}s and {@link Shader}s
 * to a {@link GlTF} when the IDs of the corresponding {@link Technique}s
 * are requested 
 * 

   * Create a new technique handler
   * @param gltf The {@link GlTF} that will receive the {@link Technique}s, 
   * {@link Program}s and {@link Shader}s that are created by this instance
   * upon request 
   */
function TechniqueHandler(gltf) {
    this.gltf = gltf;
}
/**
 * The ID of the {@link Technique} that has a texture and normals
 */
TechniqueHandler.TECHNIQUE_TEXTURE_NORMALS_ID =
        "techniqueTextureNormals";

/**
* The ID of the {@link Technique} that has a png texture   and normals 
*/
TechniqueHandler.TECHNIQUE_TEXTURE_NORMALS_ID_TRANSPARENT =
        "techniqueTextureNormalsTransparent";

/**
 * The ID of the {@link Technique} that has a png texture
 */
TechniqueHandler.TECHNIQUE_TEXTURE_ID_TRANSPARENT =
        "techniqueTextureTransparent";

/**
* The ID of the {@link Technique} that has a texture
*/
TechniqueHandler.TECHNIQUE_TEXTURE_ID =
        "techniqueTexture";

/**
 * The ID of the {@link Technique} that has normals
 */
TechniqueHandler.TECHNIQUE_NORMALS_ID =
        "techniqueNormals";

/**
 * The ID of the {@link Technique} that has neither a texture nor normals
 */
TechniqueHandler.TECHNIQUE_NONE_ID =
        "techniqueNone";

/**
 * The name for the <code>"ambient"</code> 
 * {@link Technique#getParameters() technique parameter}
 */
TechniqueHandler.AMBIENT_NAME = "ambient";

/**
 * The name for the <code>"diffuse"</code> 
 * {@link Technique#getParameters() technique parameter}
 */
TechniqueHandler.DIFFUSE_NAME = "diffuse";

/**
 * The name for the <code>"specular"</code> 
 * {@link Technique#getParameters() technique parameter}
 */
TechniqueHandler.SPECULAR_NAME = "specular";

/**
 * The name for the <code>"shininess"</code> 
 * {@link Technique#getParameters() technique parameter}
 */
TechniqueHandler.SHININESS_NAME = "shininess";

TechniqueHandler.TRANAPARENCY_NAME = "transparency";





/**
 * Returns the ID of the {@link Technique} with the given properties.
 * If the corresponding {@link Technique} was not created yet, it will
 * be created, and will be added to the {@link GlTF} that was given
 * in the constructor, together with the {@link Program} and 
 * {@link Shader} instances
 * 
 * @param withTexture Whether the {@link Technique} should support a texture
 * @param withNormals Whether the {@link Technique} should support normals
 * @return The {@link Technique} ID
 */
TechniqueHandler.prototype.getTechniqueId = function (withTexture, withNormals, transparent) {
    if (withTexture && withNormals) {
        var techniqueId = transparent ? TechniqueHandler.TECHNIQUE_TEXTURE_NORMALS_ID_TRANSPARENT : TechniqueHandler.TECHNIQUE_TEXTURE_NORMALS_ID;
        var vertexShaderUri = texture_normals_vert;// "texture_normals.vert"; 
        var fragmentShaderUri = texture_normals_frag;  //"texture_normals.frag";
        this.createTechnique(techniqueId,
             withTexture, withNormals,
             vertexShaderUri, fragmentShaderUri, transparent);
        return techniqueId;

    }
    if (withTexture && !withNormals) {
        var techniqueId = transparent ? TechniqueHandler.TECHNIQUE_TEXTURE_ID_TRANSPARENT : TechniqueHandler.TECHNIQUE_TEXTURE_ID;
        var vertexShaderUri = texture_vert;//"texture.vert";
        var fragmentShaderUri = texture_frag;// "texture.frag";
        this.createTechnique(techniqueId,
            withTexture, withNormals,
            vertexShaderUri, fragmentShaderUri, transparent);
        return techniqueId;
    }
    if (!withTexture && withNormals) {
        var techniqueId = TechniqueHandler.TECHNIQUE_NORMALS_ID;
        var vertexShaderUri = normals_vert;// "normals.vert";
        var fragmentShaderUri = normals_frag;//"normals.frag";
        this.createTechnique(techniqueId,
            withTexture, withNormals,
            vertexShaderUri, fragmentShaderUri, false);
        return techniqueId;
    }
    else {
        var techniqueId = TechniqueHandler.TECHNIQUE_NONE_ID;
        var vertexShaderUri = none_vert;// "none.vert";
        var fragmentShaderUri = none_frag;// "none.frag";
        this.createTechnique(techniqueId,
            withTexture, withNormals,
            vertexShaderUri, fragmentShaderUri, false);
        return techniqueId;
    }

}

function generateId(prefix, map) {
    var set = [];
    var counter = 0;
    if (map != null) {
        for (var i in map) {

            if (map.hasOwnProperty(i)) {
                set.push(i);
                counter++;
            }
        }
    }

    while (true) {
        var id = prefix + counter;
        if (set.indexOf(id) < 0) {
            return id;
        }
        counter++;
    }
}

/**
 * Create the specified {@link Technique}, if it does not exist
 * yet, and add it to the the {@link GlTF} that was given in 
 * the constructor, together with its {@link Program} and 
 * {@link Shader}s  
 * 
 * @param techniqueId The {@link Technique} ID
 * @param withTexture Whether the {@link Technique} should support a texture
 * @param withNormals Whether the {@link Technique} should support normals
 * @param vertexShaderUri The {@link Shader#getUri() vertex shader URI}
 * @param fragmentShaderUri The {@link Shader#getUri() fragment shader URI}
 */
TechniqueHandler.prototype.createTechnique = function (techniqueId,
    withTexture, withNormals,
    vertexShaderUri, fragmentShaderUri, transparent) {
    if (!this.gltf.techniques) {
        this.gltf.techniques = {};
    }
    var techniques = this.gltf.techniques;
    var technique = null;
    if (techniques != null) {
        if (techniques.hasOwnProperty(techniqueId)) {
            technique = techniques[techniqueId];
            return;
        }
    } else {
        this.gltf.techniques = {};
    }
    if (!this.gltf.programs) {
        this.gltf.programs = {};
    }
    var programId = generateId("program", this.gltf.programs);

    if (!this.gltf.shaders) {
        this.gltf.shaders = {};
    }
    var vertexShaderId = generateId(
       "vertexShader_for_" + programId, this.gltf.shaders);
    var vertexShader = {
        uri: vertexShaderUri,
        type: WebGLConstants.VERTEX_SHADER,
        name: vertexShaderId
    };

    this.gltf.shaders[vertexShaderId] = vertexShader;

    var fragmentShaderId = generateId(
        "fragmentShader_for_" + programId, this.gltf.shaders);
    var fragmentShader = {
        uri: fragmentShaderUri,
        type: WebGLConstants.FRAGMENT_SHADER,
        name: fragmentShaderId
    };
    this.gltf.shaders[fragmentShaderId] = fragmentShader;

    var program = {
        attributes: [],
        fragmentShader: fragmentShaderId,
        vertexShader: vertexShaderId
    };

    var programAttributes = [];
    programAttributes.push("a_position");
    if (withTexture) {
        programAttributes.push("a_texcoord0");
    }
    if (withNormals) {
        programAttributes.push("a_normal");
    }
    program.attributes = programAttributes;
    this.gltf.programs[programId] = program;


    technique = {
        parameters: null,
        attributes: null,
        program: null,
        uniforms: null,
        states: null,
    };
    technique.program = programId;

    var techniqueAttributes = {};
    techniqueAttributes["a_position"] = "position";
    if (withTexture) {
        techniqueAttributes["a_texcoord0"] = "texcoord0";
    }
    if (withNormals) {
        techniqueAttributes["a_normal"] = "normal";
    }
    technique.attributes = techniqueAttributes;


    var techniqueParameters = {};

    techniqueParameters["position"] =
        createTechniqueParameters(
        WebGLConstants.FLOAT_VEC3, "POSITION");

    if (withTexture) {
        techniqueParameters["texcoord0"] =
            createTechniqueParameters(
                WebGLConstants.FLOAT_VEC2, "TEXCOORD_0");
    }
    if (withNormals) {
        techniqueParameters["normal"] =
            createTechniqueParameters(
                WebGLConstants.FLOAT_VEC3, "NORMAL");
    }

    techniqueParameters["modelViewMatrix"] =
        createTechniqueParameters(
            WebGLConstants.FLOAT_MAT4,
            Semantic.MODELVIEW);
    if (withNormals) {
        techniqueParameters["normalMatrix"] =
            createTechniqueParameters(
                WebGLConstants.FLOAT_MAT3,
                Semantic.MODELVIEWINVERSETRANSPOSE);
    }
    techniqueParameters["projectionMatrix"] =
        createTechniqueParameters(
            WebGLConstants.FLOAT_MAT4,
            Semantic.PROJECTION);

    techniqueParameters[TechniqueHandler.AMBIENT_NAME] =
        createTechniqueParameters(
            WebGLConstants.FLOAT_VEC4);
    if (withTexture) {
        techniqueParameters[TechniqueHandler.DIFFUSE_NAME] =
            createTechniqueParameters(
                WebGLConstants.SAMPLER_2D);
    }
    else {
        techniqueParameters[TechniqueHandler.DIFFUSE_NAME] =
        createTechniqueParameters(
            WebGLConstants.FLOAT_VEC4);
    }
    techniqueParameters[TechniqueHandler.SPECULAR_NAME] =
        createTechniqueParameters(
            WebGLConstants.FLOAT_VEC4);

    techniqueParameters[TechniqueHandler.SHININESS_NAME] =
        createTechniqueParameters(
            WebGLConstants.FLOAT);

    techniqueParameters[TechniqueHandler.TRANAPARENCY_NAME] =
         createTechniqueParameters(
             WebGLConstants.FLOAT);

    technique.parameters = techniqueParameters;

    var techniqueUniforms = {};
    techniqueUniforms["u_ambient"] = TechniqueHandler.AMBIENT_NAME;
    techniqueUniforms["u_diffuse"] = TechniqueHandler.DIFFUSE_NAME;
    techniqueUniforms["u_specular"] = TechniqueHandler.SPECULAR_NAME;
    techniqueUniforms["u_shininess"] = TechniqueHandler.SHININESS_NAME;
    techniqueUniforms["u_transparency"] = TechniqueHandler.TRANAPARENCY_NAME;
    techniqueUniforms["u_modelViewMatrix"] = "modelViewMatrix";
    if (withNormals) {
        techniqueUniforms["u_normalMatrix"] = "normalMatrix";
    }
    techniqueUniforms["u_projectionMatrix"] = "projectionMatrix";
    technique.uniforms = techniqueUniforms;

    var states = {
        enable: [],
        functions: {}
    };
    states.enable.push(WebGLConstants.DEPTH_TEST);//深度测试
    states.enable.push(WebGLConstants.CULL_FACE); //剔除遮挡
    if (transparent) {
        states.enable.push(WebGLConstants.BLEND);//混合
    }

    technique.states = states;

    this.gltf.techniques[techniqueId] = technique;
}

/**
 * Create a {@link TechniqueParameters} object that has the given 
 * {@link TechniqueParameters#getType() type} and
 * {@link TechniqueParameters#getSemantic() semantic}
 * 
 * @param type The type
 * @param semantic The semantic
 * @return The {@link TechniqueParameters}
 */
function createTechniqueParameters(type, semantic) {
    if (arguments.length == 1) {
        return { type: type };
    }
    else {
        return {
            type: type,
            semantic: semantic
        };
    }
}

function Semantic()
{ }
/**
 * The LOCAL semantic
 */
Semantic.LOCAL = "LOCAL";

/**
 * The MODEL semantic
 */
Semantic.MODEL = "MODEL";

/**
 * The VIEW semantic
 */
Semantic.VIEW = "VIEW";

/**
 * The PROJECTION semantic
 */
Semantic.PROJECTION = "PROJECTION";

/**
 * The MODELVIEW semantic
 */
Semantic.MODELVIEW = "MODELVIEW";

/**
 * The MODELVIEWPROJECTION semantic
 */
Semantic.MODELVIEWPROJECTION = "MODELVIEWPROJECTION";

/**
 * The MODELINVERSE semantic
 */
Semantic.MODELINVERSE = "MODELINVERSE";

/**
 * The VIEWINVERSE semantic
 */
Semantic.VIEWINVERSE = "VIEWINVERSE";

/**
 * The MODELVIEWINVERSE semantic
 */
Semantic.MODELVIEWINVERSE = "MODELVIEWINVERSE";

/**
 * The PROJECTIONINVERSE semantic
 */
Semantic.PROJECTIONINVERSE = "PROJECTIONINVERSE";

/**
 * The MODELVIEWPROJECTIONINVERSE semantic
 */
Semantic.MODELVIEWPROJECTIONINVERSE = "MODELVIEWPROJECTIONINVERSE";

/**
 * The MODELINVERSETRANSPOSE semantic
 */
Semantic.MODELINVERSETRANSPOSE = "MODELINVERSETRANSPOSE";

/**
 * The MODELVIEWINVERSETRANSPOSE semantic
 */
Semantic.MODELVIEWINVERSETRANSPOSE = "MODELVIEWINVERSETRANSPOSE";

/**
 * The VIEWPORT semantic
 */
Semantic.VIEWPORT = "VIEWPORT";

/**
 * The JOINTMATRIX semantic
 */
Semantic.JOINTMATRIX = "JOINTMATRIX";


/**
 * Returns whether the given string is a valid semantic name, and may be
 * passed to <code>Semantic.valueOf</code> without causing an exception.
 * 
 * @param s The string
 * @return Whether the given string is a valid semantic
 */
Semantic.contains = function (s) {
    switch (s) {
        case Semantic.JOINTMATRIX:
        case Semantic.LOCAL:
        case Semantic.MODEL:
        case Semantic.MODELINVERSE:
        case Semantic.MODELINVERSETRANSPOSE:
        case Semantic.MODELVIEW:
        case Semantic.MODELVIEWINVERSE:
        case Semantic.MODELVIEWINVERSETRANSPOSE:
        case Semantic.MODELVIEWPROJECTION:
        case Semantic.MODELVIEWPROJECTIONINVERSE:
        case Semantic.PROJECTION:
        case Semantic.PROJECTIONINVERSE:
        case Semantic.VIEW:
        case Semantic.VIEWINVERSE:
        case Semantic.VIEWPORT:
            return true;
    }

    return false;
}
if (typeof module === "undefined") {
    this.TechniqueHandler = TechniqueHandler;
} else {
    module.exports = TechniqueHandler;
}
if (typeof define === "function") {
    define('Gltf/TechniqueHandler',[
        "Gltf/Shaders/none_frag",
        "Gltf/Shaders/none_vert",
        "Gltf/Shaders/normals_frag",
        "Gltf/Shaders/normals_vert",
        "Gltf/Shaders/texture_frag",
        "Gltf/Shaders/texture_vert",
        "Gltf/Shaders/texture_normals_frag",
        "Gltf/Shaders/texture_normals_vert"
    ], function (
        none_frag,
        none_vert,
        normals_frag,
        normals_vert,
        texture_frag,
        texture_vert,
        texture_normals_frag,
        texture_normals_vert
        ) {

        var pref = "data:text/plain;base64,"
        none_frag = pref + base64Encode(none_frag);// pref + window.at(none_frag);
        none_vert = pref + base64Encode(none_vert);//pref + window.btoa(none_vert),
        normals_frag = pref + window.btoa(normals_frag),
        normals_vert = pref + window.btoa(normals_vert),
        texture_frag = pref + window.btoa(texture_frag),
        texture_vert = pref + window.btoa(texture_vert),
        texture_normals_frag = pref + base64Encode(texture_normals_frag);//pref + window.btoa(texture_normals_frag),
        texture_normals_vert = pref + base64Encode(texture_normals_vert);//pref + window.btoa(texture_normals_vert);


        var scope = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};
        scope.none_frag = none_frag,
        scope.none_vert = none_vert,
        scope.normals_frag = normals_frag,
        scope.normals_vert = normals_vert,
        scope.texture_frag = texture_frag,
        scope.texture_vert = texture_vert,
        scope.texture_normals_frag = texture_normals_frag,
        scope.texture_normals_vert = texture_normals_vert;
        return TechniqueHandler;

    })
};
function GltfPipeline() {

}
GltfPipeline.processGltf = function (gltf) {
    var th = new TechniqueHandler(gltf);

    for (var meshId in gltf.meshes) {
        var primitives = gltf.meshes[meshId].primitives;
        primitives.forEach(function (primitive) {
            var withNormals = typeof primitive.attributes.NORMAL !== 'undefined';
            var withTexture = false;
            var transparent = false;

            var mtl = gltf.materials[primitive.material];
            if (mtl.values) {
                for (var mtlVal in mtl.values) {
                    if (typeof mtl.values[mtlVal] === 'string') {
                        withTexture = true;
                        transparent = gltf.textures[mtl.values[mtlVal]].format == Cesium.WebGLConstants.RGBA;
                    }
                }
            }
            var techniqueId = th.getTechniqueId(withTexture, withNormals, transparent)
            mtl.technique = techniqueId;
            mtl.values["transparency"] = 1.0;
        })
    }
    th = null;
    return gltf;
}

if (typeof module === "undefined") {
    this.GltfPipeline = GltfPipeline;
} else {
    module.exports = GltfPipeline;
}
if (typeof define === "function") {
    define('Gltf/GltfPipeline',['Gltf/TechniqueHandler'], function (TechniqueHandler) {
        var scope = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};

        scope.TechniqueHandler = TechniqueHandler;

        return GltfPipeline;
    });
};
/**
 * Client-side NodeJS's Buffer implementation
 *
 * @author 2012, Phoenix Kayo <kayo@ilumium.org>
 * @license GNU LGPLv3 http://www.gnu.org/licenses/lgpl-3.0.html
 *
 * @see Original Buffer Documentation http://nodejs.org/api/buffer.html
 */
;(function(){
  var M = Math,
  pow = M.pow,
  ArraySlice = Array.prototype.slice,
  root = window,
  c2c = String.fromCharCode,
  non_enc = /[^0-9a-z]/g,
  pass = function(a){return a;},
  encodings = {
    ascii:[pass, pass],
    binary:[pass, pass],
    utf8:[u8e, u8d],
    ucs2:[u2e, u2d],
    hex:[hxe, hxd],
    base64:[atob, btoa]
  },
  non_hex = /[^0-9A-Fa-f]/g;

  function mix(dst, src){
    for(var i in src){
      dst[i] = src[i];
    }
    i = 'toString';
    if(dst[i] !== src[i]){ /* Fuck IE */
      dst[i] = src[i];
    }
    return dst;
  }

  /* string to utf8 encode */
  function u8e(str){
    return unescape(encodeURIComponent(str));
  }

  /* utf8 to string decode */
  function u8d(str){
    return decodeURIComponent(escape(str));
  }

  /* string to ucs2 encode */
  function u2e(str){
    var ret = '',
    i = 0,
    val;
    for(; i < str.length; ){
      val = str.charCodeAt(i++);
      ret += c2c(val % 256) + c2c(val >>> 8);
    }
    return ret;
  }

  /* ucs2 to string decode */
  function u2d(str){
    var ret = '',
    i = 0;
    for(; i < str.length; ){
      ret += c2c(str.charCodeAt(i++) + (str.charCodeAt(i++) << 8));
    }
    return ret;
  }

  /* hex to binary encode */
  function hxe(str){
    var ret = '',
    i = 0;
    for(; i < str.length; i++){
      ret += c2c(parseInt(str.substr(i++, 2), 16));
    }
    return ret;
  }

  /* binary to hex decode */
  function hxd(str){
    var ret = '',
    i = 0,
    c;
    for(; i < str.length; ){
      c = (str.charCodeAt(i++) & 0xff).toString(16);
      for(; c.length < 2; c = '0' + c);
      ret += c;
    }
    return ret;
  }

  /* Generalized Constructor */
  function Buffer(data, encoding){
    if(!(this instanceof Buffer)){
      return new Buffer(data, encoding);
    }
    var len = buffer_len(data, encoding),
    buf = wrap(this, 0, len);
    buffer_write(buf, data, encoding);
    return buf;
  }

  /* Feature Detecting/Configuring */
  mix(Buffer, {
    useArrayBuffer: root.ArrayBuffer && {}.__proto__,
    useTypedArrays: !!root.Int8Array,
    useDataView: !!root.DataView
  });

  if(typeof root.Buffer == 'object'){
    mix(Buffer, root.Buffer);
  }
  root.Buffer = Buffer;

  /* Assertion Helper */
  function ast(val, msg){
    if(!val){
      throw new Error(msg);
    }
  }

  /* Encoding Assertion Helper */
  function enc_ast(encoding){
    encoding = (encoding || 'utf8').toLowerCase().replace(non_enc, '');
    ast(encoding in encodings, 'Unknown encoding');
    return encoding;
  }

  /* Hex String Assertion Helper */
  function hex_ast(val){
    ast(!(val.length % 2) && val.search(non_hex) < 0, 'Invalid hex string');
  }

  /* Initial Buffer Length Helper */
  function buffer_len(data, encoding){
    encoding = enc_ast(encoding);
    if(typeof data == 'number'){
      return data > 0 ? data : 0;
    }else if(typeof data == 'string'){
      return Buffer.byteLength(data, encoding);
    }else if(data instanceof Array){
      return data.length;
    }
    return 0;
  }

  function buffer_write(self, data, encoding){
    if(typeof data == 'string'){
      self.write(data, 0, self.length, encoding);
    }else if(data instanceof Array){
      for(var i = 0; i < data.length; i++){
        //self['write' + (data[i] < 0 ? '' : 'U') + 'Int8'](data[i], i);
        self.writeUInt8(data[i], i, true);
      }
    }
  }

  function notnil(value){
    return value !== undefined && value !== null;
  }

  /* Get Assertion Helper */
  function get_ast(self, offset, noAssert, bytes){
    if (!noAssert) {
      ast(notnil(offset), 'missing offset');
      ast(offset >= 0, 'trying to read at negative offset');
      ast(offset + bytes <= self.length, 'Trying to read beyond buffer length');
    }
  }

  /* Set Assertion Helper */
  function set_ast(self, value, offset, noAssert, bytes, max, min, fract){
    if (!noAssert) {
      min = min || 0x0;
      ast(notnil(offset), 'missing offset');
      ast(notnil(value), 'missing value');
      ast(offset >= 0, 'trying to write at negative offset');
      ast(offset + bytes <= self.length, 'trying to write beyond buffer length');
      /* value */
      ast(typeof value == 'number', 'cannot write a non-number as a number');
      ast(value >= min, min == 0 ? 'specified a negative value for writing an unsigned value'
          : 'value smaller than minimum allowed value');
      ast(value <= max, 'value is larger than maximum' + min == 0 ? 'value for type' : 'allowed value');
      ast(fract || M.floor(value) === value, 'value has a fractional component');
    }
  }

  /* Cooking Assertion with specified arguments */
  function cook_ast(bytes, max, min, fract){
    return max ? function(self, value, offset, noAssert){ /* write_ast */
      set_ast(self, value, offset, noAssert, bytes, max, min, fract);
    } : function(self, offset, noAssert){ /* read_ast */
      get_ast(self, offset, noAssert, bytes);
    };
  }

  var /* Read Asserts */
  read8_ast = cook_ast(1),
  read16_ast = cook_ast(2),
  read32_ast = cook_ast(4),
  read64_ast = cook_ast(8),
  /* Write Asserts */
  write8u_ast = cook_ast(1, 0xff),
  write16u_ast = cook_ast(2, 0xffff),
  write32u_ast = cook_ast(4, 0xffffffff),
  write8s_ast = cook_ast(1, 0x7f, -0x80),
  write16s_ast = cook_ast(2, 0x7fff, -0x8000),
  write32s_ast = cook_ast(4, 0x7fffffff, -0x80000000),
  write32_ast = cook_ast(4, 3.4028234663852886e+38, -3.4028234663852886e+38, true),
  write64_ast = cook_ast(8, 1.7976931348623157E+308, -1.7976931348623157E+308, true);

  if(Buffer.useArrayBuffer &&
     (Buffer.useDataView || Buffer.useTypedArrays)){

    var ArrayBuf = ArrayBuffer,
    DataProxy,
    wrap = function(self, start, length){
      if(!length){
        return self;
      }

      var buffer = self.buffer || new ArrayBuf(length); // (sic!) potentially this may have problem
      if(self.offset){
        start += self.offset;
      }
      // Wrong but ideologically more correct:
      // DataView.call(this, buf)

      var proxy = new DataProxy(buffer, start, length);
      proxy.__proto__ = Buffer.prototype;
      // Firefox disallow to set __proto__ field of Typed Arrays
      if(proxy.__proto__ === Buffer.prototype){
        self = proxy;
      }else{
        self = Buffer();
      }

      self.buffer = buffer;
      self.offset = start;
      self.length = length;
      return self;
    };

    if(Buffer.useDataView){
      Buffer.backend = 'DataView';
      DataProxy = DataView;

      var cook_val = function(type, write){
        return DataProxy.prototype[(write ? 'set' : 'get') + type];
      };
    }else{
      Buffer.backend = 'TypedArrays';
      DataProxy = Uint8Array;

      var nativeLE = function(){ /* check is native Little Endian */
        var buffer = new ArrayBuf();
        new Uint16Array(buffer)[0] = 1;
        return !new DataProxy(buffer)[0];
      }(),
      fix_order = function(buffer, offset, count, isLE, cons, value){
        var write = arguments.length > 5,
        typed;
        if(count < 2 || nativeLE == isLE){
          typed = new cons(buffer, offset, 1);
          if(write){
            typed[0] = value;
          }else{
            return typed[0];
          }
        }else{
          var reversed = new ArrayBuf(count),
          bytes = new DataProxy(buffer, offset, count),
          rbytes = new DataProxy(reversed),
          up = count - 1,
          i = 0;
          typed = new cons(reversed);
          if(write){
            typed[0] = value;
            for(; i < count; bytes[up - i] = rbytes[i++]);
          }else{
            for(; i < count; rbytes[up - i] = bytes[i++]);
            return typed[0];
          }
        }
      },
      cook_val = function(type, write){
        var cons = root[type + 'Array'],
        count = parseInt(type.replace(/^\D+/, ''), 10) >>> 3;
        return write ? function(offset, value, isLE){
          fix_order(this.buffer, offset + this.offset, count, isLE, cons, value);
        } : function(offset, isLE){
          return fix_order(this.buffer, offset + this.offset, count, isLE, cons);
        };
      };
    }

    var
    readUInt8 = cook_val('Uint8'),
    readUInt16 = cook_val('Uint16'),
    readUInt32 = cook_val('Uint32'),

    readInt8 = cook_val('Int8'),
    readInt16 = cook_val('Int16'),
    readInt32 = cook_val('Int32'),

    readFloat = cook_val('Float32'),
    readDouble = cook_val('Float64'),

    writeUInt8 = cook_val('Uint8', 1),
    writeUInt16 = cook_val('Uint16', 1),
    writeUInt32 = cook_val('Uint32', 1),

    writeInt8 = cook_val('Int8', 1),
    writeInt16 = cook_val('Int16', 1),
    writeInt32 = cook_val('Int32', 1),

    writeFloat = cook_val('Float32', 1),
    writeDouble = cook_val('Float64', 1);

    // Already not necessary in this
    /* BufferProxy = function(){};
     BufferProxy.prototype = DataProxy.prototype;
     Buffer.prototype = new BufferProxy(); */

  }else{
    Buffer.backend = 'Array';

    /**
     * Function readIEEE754 and writeIEEE754 forked from
     * ysangkok's buffer-browserify
     *
     * git://github.com/toots/buffer-browserify.git
     */

    function readIEEE754(buffer, offset, isLE, mLen, nBytes) {
      var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

      i += d;

      e = s & ((1 << (-nBits)) - 1);
      s >>= (-nBits);
      nBits += eLen;
      for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

      m = e & ((1 << (-nBits)) - 1);
      e >>= (-nBits);
      nBits += mLen;
      for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

      if (e === 0) {
        e = 1 - eBias;
      } else if (e === eMax) {
        return m ? NaN : ((s ? -1 : 1) * Infinity);
      } else {
        m = m + pow(2, mLen);
        e = e - eBias;
      }
      return (s ? -1 : 1) * m * pow(2, e - mLen);
    }

    function writeIEEE754(buffer, offset, value, isLE, mLen, nBytes) {
      var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? pow(2, -24) - pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

      value = M.abs(value);

      if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0;
        e = eMax;
      } else {
        e = M.floor(M.log(value) / M.LN2);
        if (value * (c = pow(2, -e)) < 1) {
          e--;
          c *= 2;
        }
        if (e + eBias >= 1) {
          value += rt / c;
        } else {
          value += rt * pow(2, 1 - eBias);
        }
        if (value * c >= 2) {
          e++;
          c /= 2;
        }

        if (e + eBias >= eMax) {
          m = 0;
          e = eMax;
        } else if (e + eBias >= 1) {
          m = (value * c - 1) * pow(2, mLen);
          e = e + eBias;
        } else {
          m = value * pow(2, eBias - 1) * pow(2, mLen);
          e = 0;
        }
      }

      for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

      e = (e << mLen) | m;
      eLen += mLen;
      for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

      buffer[offset + i - d] |= s * 128;
    }

    var wrap = function(self, start, length){
      var buffer = self.buffer || length > 0 && new Array(length),
      i = 0;
      if(self.offset){
        start += self.offset;
      }
      if(!self.buffer){ /* init */
        if(buffer){
          /* touch */
          for(; i < length; buffer[start + i++] = 0);
        }
      }else{
        self = Buffer();
      }
      self.buffer = buffer;
      self.offset = start;
      self.length = length;
      return self;
    },

    /* readOps */
    readUInt8 = function(offset){
      return this.buffer[this.offset + offset];
    },
    readUInt16 = function(offset, isLE){
      return readUInt8.call(this, offset + (isLE ? 1 : 0)) << 8
        | readUInt8.call(this, offset + (isLE ? 0 : 1));
    },
    readUInt32 = function(offset, isLE){
      //return (readUInt16.call(this, offset + (isLE ? 2 : 0), isLE) << 16) | // it's wrong!
      return (readUInt16.call(this, offset + (isLE ? 2 : 0), isLE) << 15) * 2 // we use this instead
        + readUInt16.call(this, offset + (isLE ? 0 : 2), isLE);
    },

    readInt8 = function(offset){
      offset = readUInt8.call(this, offset);
      return offset & 0x80 ? offset - 0x100 : offset;
    },
    readInt16 = function(offset, isLE){
      offset = readUInt16.call(this, offset, isLE);
      return offset & 0x8000 ? offset - 0x10000 : offset;
    },
    readInt32 = function(offset, isLE){
      offset = readUInt32.call(this, offset, isLE);
      return offset & 0x80000000 ? offset - 0x100000000 : offset;
    },

    readFloat = function(offset, isLE){
      return readIEEE754(this.buffer, this.offset + offset, isLE, 23, 4);
    },
    readDouble = function(offset, isLE){
      return readIEEE754(this.buffer, this.offset + offset, isLE, 52, 8);
    },

    /* writeOps */
    writeUInt8 = function(offset, value){
      this.buffer[this.offset + offset] = value;// & 0xff;
    },
    writeUInt16 = function(offset, value, isLE){
      //value &= 0xffff;
      writeUInt8.call(this, offset + (isLE ? 1 : 0), value >>> 8);
      writeUInt8.call(this, offset + (isLE ? 0 : 1), value & 0xff);
    },
    writeUInt32 = function(offset, value, isLE){
      //value &= 0xffffffff;
      writeUInt16.call(this, offset + (isLE ? 2 : 0), value >>> 16, isLE);
      writeUInt16.call(this, offset + (isLE ? 0 : 2), value & 0xffff, isLE);
    },

    writeInt8 = function(offset, value){
      writeUInt8.call(this, offset, value < 0 ? value + 0x100 : value);
    },
    writeInt16 = function(offset, value, isLE){
      writeUInt16.call(this, offset, value < 0 ? value + 0x10000 : value, isLE);
    },
    writeInt32 = function(offset, value, isLE){
      writeUInt32.call(this, offset, value < 0 ? value + 0x100000000 : value, isLE);
    },

    writeFloat = function(offset, value, isLE){
      return writeIEEE754(this.buffer, this.offset + offset, value, isLE, 23, 4);
    },
    writeDouble = function(offset, value, isLE){
      return writeIEEE754(this.buffer, this.offset + offset, value, isLE, 52, 8);
    };
  }

  mix(Buffer, {
    isBuffer: function(obj){
      return obj instanceof Buffer;
    },
    byteLength: function(string, encoding){
      encoding = enc_ast(encoding);
      ast(typeof string == 'string', 'Argument must be a string');
      switch(encoding){
      case 'ascii':
      case 'binary':
        return string.length;
      case 'hex':
        //hex_ast(string); /* NodeJS don't checks it here, so we also keep this feature */
        return string.length >>> 1;
        //return M.ceil(string.length / 2);
      case 'base64':
        var e = string.search(/=/);
        return (string.length * 3 >>> 2) - (e < 0 ? 0 : (string.length - e));
      case 'ucs2':
        return string.length * 2;
      case 'utf8':
      default:
        return u8e(string).length;
        // function u8l(string){
        /*var t,
        c = 0,
        i = 0;
        for(; i < string.length; ){
          t = string.charCodeAt(i++);
          for(c++; t >>>= 8; c++);
        }
        return c;*/
        // }
      }
    },
    concat: function(list/*, totalLength*/) {
      var args = ArraySlice.call(arguments),
      totalLength = typeof args[args.length-1] == 'number' ? args.pop() : -1,
      length = 0,
      i = 0,
      bufs = [],
      buf,
      ret,
      skip = 0;

      if (!(list instanceof Array)) {
        list = args;
      }

      for(; i < list.length; ){
        buf = list[i++];
        if(buf){
          if(!Buffer.isBuffer(buf)){
            buf = new Buffer(buf);
          }
          length += buf.length;
          bufs.push(buf);
        }
      }

      ret = new Buffer(length = totalLength < 0 ? length : totalLength);
      for(; bufs.length && skip < length; ){
        buf = bufs.shift();
        buf.copy(ret, skip, 0, M.min(buf.length, length - skip));
        skip += buf.length;
      }

      return ret;
    }
  });

  mix(Buffer.prototype, {
    /* Buffer value access */
    /* readUInts */
    readUInt8: function(offset, noAssert){
      read8_ast(this, offset, noAssert);
      return readUInt8.call(this, offset);
    },
    readUInt16LE: function(offset, noAssert){
      read16_ast(this, offset, noAssert);
      return readUInt16.call(this, offset, true);
    },
    readUInt16BE: function(offset, noAssert){
      read16_ast(this, offset, noAssert);
      return readUInt16.call(this, offset, false);
    },
    readUInt32LE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readUInt32.call(this, offset, true);
    },
    readUInt32BE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readUInt32.call(this, offset, false);
    },
    /* readInts */
    readInt8: function(offset, noAssert){
      read8_ast(this, offset, noAssert);
      return readInt8.call(this, offset);
    },
    readInt16LE: function(offset, noAssert){
      read16_ast(this, offset, noAssert);
      return readInt16.call(this, offset, true);
    },
    readInt16BE: function(offset, noAssert){
      read16_ast(this, offset, noAssert);
      return readInt16.call(this, offset, false);
    },
    readInt32LE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readInt32.call(this, offset, true);
    },
    readInt32BE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readInt32.call(this, offset, false);
    },
    /* readFloats */
    readFloatLE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readFloat.call(this, offset, true);
    },
    readFloatBE: function(offset, noAssert){
      read32_ast(this, offset, noAssert);
      return readFloat.call(this, offset, false);
    },
    readDoubleLE: function(offset, noAssert){
      read64_ast(this, offset, noAssert);
      return readDouble.call(this, offset, true);
    },
    readDoubleBE: function(offset, noAssert){
      read64_ast(this, offset, noAssert);
      return readDouble.call(this, offset, false);
    },
    /* writeUInts */
    writeUInt8: function(value, offset, noAssert){
      write8u_ast(this, value, offset, noAssert);
      return writeUInt8.call(this, offset, value);
    },
    writeUInt16LE: function(value, offset, noAssert){
      write16u_ast(this, value, offset, noAssert);
      return writeUInt16.call(this, offset, value, true);
    },
    writeUInt16BE: function(value, offset, noAssert){
      write16u_ast(this, value, offset, noAssert);
      return writeUInt16.call(this, offset, value, false);
    },
    writeUInt32LE: function(value, offset, noAssert){
      write32u_ast(this, value, offset, noAssert);
      return writeUInt32.call(this, offset, value, true);
    },
    writeUInt32BE: function(value, offset, noAssert){
      write32u_ast(this, value, offset, noAssert);
      return writeUInt32.call(this, offset, value, false);
    },
    /* writeInts */
    writeInt8: function(value, offset, noAssert){
      write8s_ast(this, value, offset, noAssert);
      return writeInt8.call(this, offset, value);
    },
    writeInt16LE: function(value, offset, noAssert){
      write16s_ast(this, value, offset, noAssert);
      return writeInt16.call(this, offset, value, true);
    },
    writeInt16BE: function(value, offset, noAssert){
      write16s_ast(this, value, offset, noAssert);
      return writeInt16.call(this, offset, value, false);
    },
    writeInt32LE: function(value, offset, noAssert){
      write32s_ast(this, value, offset, noAssert);
      return writeInt32.call(this, offset, value, true);
    },
    writeInt32BE: function(value, offset, noAssert){
      write32s_ast(this, value, offset, noAssert);
      return writeInt32.call(this, offset, value, false);
    },
    /* writeFloats */
    writeFloatLE: function(value, offset, noAssert){
      write32_ast(this, value, offset, noAssert);
      return writeFloat.call(this, offset, value, true);
    },
    writeFloatBE: function(value, offset, noAssert){
      write32_ast(this, value, offset, noAssert);
      return writeFloat.call(this, offset, value, false);
    },
    writeDoubleLE: function(value, offset, noAssert){
      write64_ast(this, value, offset, noAssert);
      return writeDouble.call(this, offset, value, true);
    },
    writeDoubleBE: function(value, offset, noAssert){
      write64_ast(this, value, offset, noAssert);
      return writeDouble.call(this, offset, value, false);
    },
    /* Buffer operations */
    slice: function(start, end){
      var self = this;
      start = start || 0;
      end = end || self.length;
      /* Slice Assertion Helper */
      ast(start >= 0 && start < end && end <= self.length, 'oob');
      return wrap(self, start, end - start);
    },
    write: function(string, offset, length, encoding){
      var self = this,
      i = 0;
      offset = offset || 0;
      length = length || self.length - offset;
      /* Assertion */
      ast(typeof string == 'string', 'Argument must be a string');
      encoding = enc_ast(encoding);
      /* Decode source string with specified encoding to binary string */
      string = encodings[encoding][0].call(root, string);
      /* Write binary string to buffer */
      for(; i < length; self.writeUInt8(string.charCodeAt(i) & 0xff, offset + i++));
      return length;
    },
    copy: function(target, offset, start, end){
      offset = offset || 0;
      start = start || 0;
      var self = this,
      i = start;
      end = end || self.length;
      /* Assertion */
      ast(end >= start, 'sourceEnd < sourceStart');
      ast(offset >= 0 && offset < target.length, 'targetStart out of bounds');
      ast(start >= 0 && start < self.length, 'sourceStart out of bounds');
      ast(end >= 0 && end <= self.length, 'sourceEnd out of bounds');
      /* Copy */
      for(; i < end; target.writeUInt8(self.readUInt8(i), offset + i++ - start));
    },
    fill: function(value, offset, end){
      offset = offset || 0;
      var self = this,
      i = offset;
      end = end || self.length;
      if(typeof value == 'string'){
        value = value.charCodeAt(0); // (sic!) no ucs2 check
      }
      /* Assertion */
      ast(typeof value === 'number' && !isNaN(value), 'value is not a number');
      ast(end >= offset, 'end < start');
      ast(offset >= 0 && offset < self.length, 'start out of bounds');
      ast(end > 0 && end <= self.length, 'end out of bounds');
      /* Fill */
      value &= 0xff;
      for(; i < end; self.writeUInt8(value, i++));
    },
    INSPECT_MAX_BYTES: 50,
    inspect: function(length){
      var self = this,
      i = 0,
      bytes = '',
      h;
      length = M.min(self.INSPECT_MAX_BYTES, self.length, length || self.length);
      for(; i < length; ){
        h = self.readUInt8(i++).toString(16);
        bytes += ' ' + (h.length < 2 ? '0' : '') + h;
      }
      return '<Buffer' + bytes + (i < self.length ? ' ... ' : '') + '>';
    },
    toString: function(encoding, start, end){
      var self = this,
      i = start || 0,
      string = '';
      if(arguments.length < 1){
        return self.inspect();
      }
      start = i;
      end = end || self.length;
      /* Accertion */
      encoding = enc_ast(encoding);
      /* Produce binary string from buffer data */
      for(; i < end; string += c2c(self.readUInt8(i++)));
      /* Decode binary string to specified encoding */
      return encodings[encoding][1].call(root, string);
    }
  });
})();
 
define("ThirdParty/Buffer.JS-0.2.1/buffer", function(){});

/// <reference path="../../ThirdParty/Buffer.JS-0.2.1/buffer.js" />
/// <reference path="../../Util/Path.js" />


var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;
var WebGLConstants = Cesium.WebGLConstants;

function Obj() {
    this.vertexCount = 0;
    this.vertexArray = [];
    this.positionMin = [];
    this.positionMax = [];
    this.hasUVs = true;
    this.hasNormals = false;
    this.materialGroups = {};
    this.materials = {};
    this.images = {};
}
/**
*
*@param {Obj|Object} data
*@param {String} inputPath
*@param {String} modelName
*@private
*/
function createGltf(data, inputPath, modelName) {
    var vertexCount = data.vertexCount;
    var vertexArray = data.vertexArray;
    var positionMin = data.positionMin;
    var positionMax = data.positionMax;
    var hasUVs = data.hasUVs;
    var hasNormals = data.hasNormals;
    var materialGroups = data.materialGroups;
    var primitiveTypes = data.primitiveTypes;

    var materials = data.materials;
    var images = data.images;

    var i, j, name;

    var sizeOfFloat32 = 4;
    var sizeOfUint32 = 4;
    var sizeOfUint16 = 2;

    var indexComponentType;
    var indexComponentSize;

    // Reserve the 65535 index for primitive restart
    if (vertexCount < 65535) {
        indexComponentType = WebGLConstants.UNSIGNED_SHORT;
        indexComponentSize = sizeOfUint16;
    } else {
        indexComponentType = WebGLConstants.UNSIGNED_INT;
        indexComponentSize = sizeOfUint32;
    }

    // Create primitives
    var primitives = [];
    var indexArrayLength = 0;
    var indexArray;
    var indexCount;
    for (name in materialGroups) {
        if (materialGroups.hasOwnProperty(name)) {
            indexArray = materialGroups[name];
            indexCount = indexArray.length;
            primitives.push({
                indexArray: indexArray,
                indexOffset: indexArrayLength,
                indexCount: indexCount,
                material: name,
                primitiveType: primitiveTypes ? primitiveTypes[name] : undefined
            });
            indexArrayLength += indexCount;
        }
    }

    // Create buffer to store vertex and index data
    var indexArrayByteLength = indexArrayLength * indexComponentSize;
    var vertexArrayLength = vertexArray.length; // In floats
    var vertexArrayByteLength = vertexArrayLength * sizeOfFloat32;
    var bufferByteLength = vertexArrayByteLength + indexArrayByteLength;
    var buffer = new Buffer(bufferByteLength);

    // Write vertex data
    var byteOffset = 0;
    for (i = 0; i < vertexArrayLength; ++i) {
        buffer.writeFloatLE(vertexArray[i], byteOffset);
        byteOffset += sizeOfFloat32;
    }

    // Write index data
    var primitivesLength = primitives.length;
    for (i = 0; i < primitivesLength; ++i) {
        indexArray = primitives[i].indexArray;
        indexCount = indexArray.length;
        for (j = 0; j < indexCount; ++j) {
            if (indexComponentSize === sizeOfUint16) {
                buffer.writeUInt16LE(indexArray[j], byteOffset);
            } else {
                buffer.writeUInt32LE(indexArray[j], byteOffset);
            }
            byteOffset += indexComponentSize;
        }
    }

    var positionByteOffset = 0;
    var normalByteOffset = 0;
    var uvByteOffset = 0;
    var vertexByteStride = 0;

    if (hasNormals && hasUVs) {
        normalByteOffset = sizeOfFloat32 * 3;
        uvByteOffset = sizeOfFloat32 * 6;
        vertexByteStride = sizeOfFloat32 * 8;
    } else if (hasNormals && !hasUVs) {
        normalByteOffset = sizeOfFloat32 * 3;
        vertexByteStride = sizeOfFloat32 * 6;
    } else if (!hasNormals && hasUVs) {
        uvByteOffset = sizeOfFloat32 * 3;
        vertexByteStride = sizeOfFloat32 * 5;
    } else if (!hasNormals && !hasUVs) {
        vertexByteStride = sizeOfFloat32 * 3;
    }

    var bufferId = modelName + '_buffer';
    var bufferViewVertexId = 'bufferView_vertex';
    var bufferViewIndexId = 'bufferView_index';
    var accessorPositionId = 'accessor_position';
    var accessorUVId = 'accessor_uv';
    var accessorNormalId = 'accessor_normal';
    var meshId = 'mesh_' + modelName;
    var sceneId = 'scene_' + modelName;
    var nodeId = 'node_' + modelName;
    var samplerId = 'sampler_0';

    function getAccessorIndexId(i) {
        return 'accessor_index_' + i;
    }

    function getMaterialId(material) {
        return 'material_' + material;
    }

    function getTextureId(image) {
        if (!defined(image)) {
            return undefined;
        }
        return 'texture_' + Path.GetFileName(image);//.substr(0, image.lastIndexOf('.'));
    }

    function getImageId(image) {
        return Path.GetFileName(image);//.substr(0, image.lastIndexOf('.'));//Path.GetFileName(image).replace(Path.GetExtension(image));
    }

    var gltf = {
        accessors: {},
        asset: {},
        buffers: {},
        bufferViews: {},
        images: {},
        materials: {},
        meshes: {},
        nodes: {},
        samplers: {},
        scene: sceneId,
        scenes: {},
        textures: {}
    };

    gltf.asset = {
        "generator": "ObjLoader",
        "premultipliedAlpha": true,
        "profile": {
            "api": "WebGL",
            "version": "1.0"
        },
        "version": 1
    };

    gltf.scenes[sceneId] = {
        nodes: [nodeId]
    };

    gltf.nodes[nodeId] = {
        children: [],
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        meshes: [meshId],
        name: modelName
    };

    gltf.samplers[samplerId] = {}; // Use default values

    var bufferSeparate = false;
    var bufferUri;
    if (buffer.length > 201326580) {
        // toString fails for buffers larger than ~192MB. Instead save the buffer to a .bin file.
        // Source: https://github.com/nodejs/node/issues/4266
        bufferSeparate = true;
        bufferUri = modelName + '.bin';
    } else {
        bufferUri = 'data:application/octet-stream;base64,' + buffer.toString('base64');
    }

    gltf.buffers[bufferId] = {
        byteLength: bufferByteLength,
        type: 'arraybuffer',
        uri: bufferUri
    };

    gltf.bufferViews[bufferViewVertexId] = {
        buffer: bufferId,
        byteLength: vertexArrayByteLength,
        byteOffset: 0,
        target: WebGLConstants.ARRAY_BUFFER
    };
    gltf.bufferViews[bufferViewIndexId] = {
        buffer: bufferId,
        byteLength: indexArrayByteLength,
        byteOffset: vertexArrayByteLength,
        target: WebGLConstants.ELEMENT_ARRAY_BUFFER
    };

    for (i = 0; i < primitivesLength; ++i) {
        var primitive = primitives[i];
        gltf.accessors[getAccessorIndexId(i)] = {
            bufferView: bufferViewIndexId,
            byteOffset: primitive.indexOffset * indexComponentSize,
            byteStride: 0,
            componentType: indexComponentType,
            count: primitive.indexCount,
            type: 'SCALAR'
        };
    }

    gltf.accessors[accessorPositionId] = {
        bufferView: bufferViewVertexId,
        byteOffset: positionByteOffset,
        byteStride: vertexByteStride,
        componentType: WebGLConstants.FLOAT,
        count: vertexCount,
        min: positionMin,
        max: positionMax,
        type: 'VEC3'
    };

    if (hasNormals) {
        gltf.accessors[accessorNormalId] = {
            bufferView: bufferViewVertexId,
            byteOffset: normalByteOffset,
            byteStride: vertexByteStride,
            componentType: WebGLConstants.FLOAT,
            count: vertexCount,
            type: 'VEC3'
        };
    }

    if (hasUVs) {
        gltf.accessors[accessorUVId] = {
            bufferView: bufferViewVertexId,
            byteOffset: uvByteOffset,
            byteStride: vertexByteStride,
            componentType: WebGLConstants.FLOAT,
            count: vertexCount,
            type: 'VEC2'
        };
    }

    var gltfPrimitives = [];
    gltf.meshes[meshId] = {
        name: modelName,
        primitives: gltfPrimitives
    };

    var gltfAttributes = {};
    gltfAttributes.POSITION = accessorPositionId;
    if (hasNormals) {
        gltfAttributes.NORMAL = accessorNormalId;
    }
    if (hasUVs) {
        gltfAttributes.TEXCOORD_0 = accessorUVId;
    }

    for (i = 0; i < primitivesLength; ++i) {
        gltfPrimitives.push({
            attributes: gltfAttributes,
            indices: getAccessorIndexId(i),
            material: getMaterialId(primitives[i].material),
            mode: defined(primitives[i].primitiveType) ? primitives[i].primitiveType : WebGLConstants.TRIANGLES
        });
    }

    for (name in materials) {
        if (materials.hasOwnProperty(name)) {
            var material = materials[name];
            var materialId = getMaterialId(name);
            var values = {
                ambient: defaultValue(defaultValue(getTextureId(material.ambientColorMap), material.ambientColor), [0, 0, 0, 1]),
                diffuse: defaultValue(defaultValue(getTextureId(material.diffuseColorMap), material.diffuseColor), [0, 0, 0, 1]),
                emission: defaultValue(defaultValue(getTextureId(material.emissionColorMap), material.emissionColor), [0, 0, 0, 1]),
                specular: defaultValue(defaultValue(getTextureId(material.specularColorMap), material.specularColor), [0, 0, 0, 1]),
                shininess: defaultValue(material.specularShininess, 0.0)
            };

            gltf.materials[materialId] = {
                name: name,
                values: values
            };
        }
    }

    var imgCount = 0;
    for (name in images) {
        if (images.hasOwnProperty(name)) {
            var image = images[name];
            var imageId = getImageId(name);
            var textureId = getTextureId(name);
            var format;
            var channels = image.channels;
            switch (channels) {
                case 1:
                    format = WebGLConstants.ALPHA;
                    break;
                case 2:
                    format = WebGLConstants.LUMINANCE_ALPHA;
                    break;
                case 3:
                    format = WebGLConstants.RGB;
                    break;
                case 4:
                    format = WebGLConstants.RGBA;
                    break;
            }

            gltf.images[imageId] = {
                uri: image.uri,
                name: imageId
            };
            gltf.textures[textureId] = {
                format: format,
                internalFormat: format,
                sampler: samplerId,
                source: imageId,
                target: WebGLConstants.TEXTURE_2D,
                type: WebGLConstants.UNSIGNED_BYTE
            };
            imgCount++;
        }
    }
    if (imgCount == 0) {
        delete gltf.textures;
        delete gltf.images;
    }

    //if (bufferSeparate) {
    //    var bufferPath = path.join(inputPath, modelName + '.bin');
    //    return fsWriteFile(bufferPath, buffer);
    //}
    return gltf;
}
if (typeof module === "undefined") {
    this.createGltf = createGltf;
} else {
    module.exports = createGltf;
}
if (typeof define === "function") {

    define('Gltf/createGltf',[
        "Path",
        "ThirdParty/Buffer.JS-0.2.1/buffer"
    ], function (
        Path,
        bufferjs
        ) {
        "use strict";
        var scope = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};
        scope.Path = Path;
        return createGltf;
    })
};



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

define('ThreeScene',[
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
});
//用于合各模块的js文件。具体合并相关工具和说明，请看build目录。
define( 'Cesium3js',[
   'ThreeScene',
   'parseThreeGroup2Obj',
   'Gltf/TechniqueHandler',
   'Gltf/GltfPipeline'
], function (
    ThreeScene
) {

    /**
    * Cesium3js
    * @namespace Cesium3js
    */
    var Cesium3js = {
        version: "1.0.1"
    };
    Cesium3js.ThreeScene = ThreeScene;
    Cesium3js.parseThreeGroup2Obj = parseThreeGroup2Obj;
    Cesium3js.TechniqueHandler = TechniqueHandler;
    Cesium3js.GltfPipeline = GltfPipeline;
     
    return Cesium3js;
});
    require([
                'Cesium3js'
    ], function (
                Cesium3js) {
        'use strict';
        /*global self*/
        var scope = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};

        if (scope.Cesium) {
            scope.Cesium.Cesium3js = Cesium3js;
            scope.Cesium.ThreeScene = ThreeScene;
        }

        scope.Cesium3js = Cesium3js;
        if (scope.onLoad) {
            scope.onLoad(Cesium3js)
        }
    }, undefined, true);

})();
if (typeof define === "function") {
    define(function () {
        var newCesium3js = Cesium3js;
        Cesium3js = undefined;
        return newCesium3js;
    });
} else if (typeof module === "undefined") {
    window.Cesium3js = Cesium3js;
} else {
    module.exports = Cesium3js;
}