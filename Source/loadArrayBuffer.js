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
    define(function () { return loadArrayBuffer; });
}