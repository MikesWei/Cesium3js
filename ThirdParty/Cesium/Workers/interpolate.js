//插值线程
if (typeof self === 'undefined') {
    self = {}; //define self so that the Dojo build can evaluate this file without crashing.
}
if (typeof window === 'undefined') {
    window = self;
}
turf = {};
turf.point = function (xy) {
    return xy;
}

// http://en.wikipedia.org/wiki/Even%E2%80%93odd_rule
// modified from: https://github.com/substack/point-in-polygon/blob/master/index.js
// which was modified from http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

/**
 * Takes a {@link Point} and a {@link Polygon} or {@link MultiPolygon} and determines if the point resides inside the polygon. The polygon can
 * be convex or concave. The function accounts for holes.
 *
 * @name inside
 * @param {Feature<Point>} point input point
 * @param {Feature<(Polygon|MultiPolygon)>} polygon input polygon or multipolygon
 * @return {boolean} `true` if the Point is inside the Polygon; `false` if the Point is not inside the Polygon
 * @example
 * var pt = turf.point([-77, 44]);
 * var poly = turf.polygon([[
 *   [-81, 41],
 *   [-81, 47],
 *   [-72, 47],
 *   [-72, 41],
 *   [-81, 41]
 * ]]);
 *
 * var isInside = turf.inside(pt, poly);
 *
 * //=isInside
 */
turf.inside = function input(pt, polygon) {
    //var pt = invariant.getCoord(point);
    var polys = polygon.geometry.coordinates;
    // normalize to multipolygon
    if (polygon.geometry.type === 'Polygon') polys = [polys];

    for (var i = 0, insidePoly = false; i < polys.length && !insidePoly; i++) {
        // check if it is in the outer ring first
        if (inRing(pt, polys[i][0])) {
            var inHole = false;
            var k = 1;
            // check for the point in any of the holes
            while (k < polys[i].length && !inHole) {
                if (inRing(pt, polys[i][k], true)) {
                    inHole = true;
                }
                k++;
            }
            if (!inHole) insidePoly = true;
        }
    }
    return insidePoly;
};

// pt is [x,y] and ring is [[x,y], [x,y],..]
function inRing(pt, ring, ignoreBoundary) {
    var isInside = false;
    if (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring = ring.slice(0, ring.length - 1);

    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var xi = ring[i][0], yi = ring[i][1];
        var xj = ring[j][0], yj = ring[j][1];
        var onBoundary = (pt[1] * (xi - xj) + yi * (xj - pt[0]) + yj * (pt[0] - xi) === 0) &&
            ((xi - pt[0]) * (xj - pt[0]) <= 0) && ((yi - pt[1]) * (yj - pt[1]) <= 0);
        if (onBoundary) return !ignoreBoundary;
        var intersect = ((yi > pt[1]) !== (yj > pt[1])) &&
        (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}


self.importScripts('../Cesium.js');

/**
*插值工具
*@constructor
*@static
*@memberof MeteoLib.Util
*/
function Interpolate() {

}


/**
*Create grid x/y coordinate arrays with x/y delt
*@param {Number}Xlb X of left-bottom
*@param {Number}Ylb Y of left-bottom
*@param {Number}Xrt X of right-top
*@param {Number}Yrt Y of right-top
*@param {Number}XDelt X delt
*@param {Number}YDelt Y delt
*@return {Array<Array<Number>>}gridXY 
*/
Interpolate.CreateGridXY_Delt = function (Xlb, Ylb, Xrt, Yrt, XDelt, YDelt) {
    /// <summary>
    /// Create grid x/y coordinate arrays with x/y delt
    /// </summary>
    /// <param name="Xlb">X of left-bottom</param>
    /// <param name="Ylb">Y of left-bottom</param>
    /// <param name="Xrt">X of right-top</param>
    /// <param name="Yrt">Y of right-top</param>
    /// <param name="XDelt">X delt</param>
    /// <param name="YDelt">Y delt</param> 

    var num = parseInt((Xrt - Xlb) / XDelt + 1.0);
    var num2 = parseInt((Yrt - Ylb) / YDelt + 1.0);
    var refX = new Float32Array(num);
    var refY = new Float32Array(num2);
    for (var i = 0; i < num; i++) {
        refX[i] = Xlb + i * XDelt;
    }
    for (var i = 0; i < num2; i++) {
        refY[i] = Ylb + i * YDelt;
    }
    return [refX, refY];
}
/**
*Create grid x/y coordinate arrays with x/y number
*@param {Number}Xlb X of left-bottom
*@param {Number}Ylb Y of left-bottom
*@param {Number}Xrt X of right-top
*@param {Number}Yrt Y of right-top
*@param {Number}Xnum X number
*@param {Number}Ynum Y number
*@return {Array<Array<Number>>}gridXY 
*/
Interpolate.CreateGridXY_Num = function (Xlb, Ylb, Xrt, Yrt, Xnum, Ynum) {
    /// <summary>
    /// Create grid x/y coordinate arrays with x/y number
    /// </summary>
    /// <param name="Xlb">X of left-bottom</param>
    /// <param name="Ylb">Y of left-bottom</param>
    /// <param name="Xrt">X of right-top</param>
    /// <param name="Yrt">Y of right-top</param>
    /// <param name="Xnum">X number</param>
    /// <param name="Ynum">Y number</param> 

    var refX = new Float32Array(Xnum);
    var refY = new Float32Array(Ynum);
    var num = (Xrt - Xlb) / parseFloat(Xnum);
    var num2 = (Yrt - Ylb) / parseFloat(Ynum);
    for (var i = 0; i < Xnum; i++) {
        refX[i] = Xlb + i * num;
    }
    for (var i = 0; i < Ynum; i++) {
        refY[i] = Ylb + i * num2;
    }
    return [refX, refY];
}

/**
*
*从离散点创建凹多边形，此凹多边形为可以将所有离散点包含在内的最小多边形
*@param {Array<Array<Number>>}SCoords 离散点经纬度
*@param {Array<Array<Number>>}[maxDisInConcave=1000] 多边形相邻点间的最大距离，默认为1000，单位为units所指定的单位
*@param {Array<Array<Number>>}[units='miles']指示maxDisInConcave所采用的单位，默认为'miles'（米）
*@return {turf.polygon}
*/
Interpolate.CreateConcaveFromSCoords = function (SCoords, maxDisInConcave, units) {
    var length = SCoords[0].length;
    var points = [];
    for (var i = 0; i < length; i++) {
        points.push(turf.point([SCoords[0][i], SCoords[1][i]]));
    }
    points = turf.featureCollection(points);
    var outPolygon = turf.concave(points, maxDisInConcave, 'miles');
    points = [];
    return outPolygon;
}

/**
 *Interpolation with IDW neighbor method
 *@param {Array<Array<Number>>}SCoords Discrete data array
 *@param {Array<Number>}X Grid X array
 *@param {Array<Number>}Y Grid Y array
 *@param {Number}NumberOfNearestNeighbors Number of nearest neighbors
 *@param {turf.polygon}[outPolygon=undefined] 
 *@return {Array<Array<Number>>}Interpolated grid Data
 */
Interpolate.Interpolation_IDW_Neighbor = function (SCoords, X, Y, NumberOfNearestNeighbors, outPolygon) {
    /// <summary>
    /// Interpolation with IDW neighbor method
    /// </summary>
    /// <param name="SCoords">Discrete data array</param>
    /// <param name="X">Grid X array</param>
    /// <param name="Y">Grid Y array</param>
    /// <param name="NumberOfNearestNeighbors">Number of nearest neighbors</param>
    /// <returns>Interpolated grid Data</returns>

    var num = X.length;
    var num2 = Y.length;
    var length = SCoords[0].length;
    var array = new Array(num2);//, num];
    for (var i = 0; i < num2; i++) {
        array[i] = new Float32Array(num);
    }
    var array2 = [new Float32Array(NumberOfNearestNeighbors), new Float32Array(NumberOfNearestNeighbors)];
    for (var i = 0; i < num2; i++) {
        for (var j = 0; j < num; j++) {
            array[i][j] = -999.0;
            var num3 = 0.0;
            var num4 = 0.0;
            for (var k = 0; k < NumberOfNearestNeighbors; k++) {
                if (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0) == 0.0) {
                    array[i][j] = SCoords[2][k];
                    break;
                }
                var num5 = 1.0 / (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0));
                array2[0][k] = num5;
                array2[1][k] = k;
            }
            if (array[i][j] == -999.0) {
                for (var k = NumberOfNearestNeighbors; k < length; k++) {
                    if (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0) == 0.0) {
                        array[i][j] = SCoords[2][k];
                        break;
                    }
                    var num5 = 1.0 / (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0));
                    var num6 = array2[0][0];
                    var num7 = 0;
                    for (var l = 1; l < NumberOfNearestNeighbors; l++) {
                        if (array2[0][l] < num6) {
                            num6 = array2[0][l];
                            num7 = l;
                        }
                    }
                    if (num5 > num6) {
                        array2[0][num7] = num5;
                        array2[1][num7] = k;
                    }
                }
                if (array[i][j] == -999.0) {
                    for (var k = 0; k < NumberOfNearestNeighbors; k++) {
                        num3 += array2[0][k] * SCoords[2][parseInt(array2[1][k])];
                        num4 += array2[0][k];
                    }
                    array[i][j] = num3 / num4;
                }
            }
        }
    }
    var num8 = 0.5;
    for (var i = 1; i < num2 - 1; i++) {
        for (var j = 1; j < num - 1; j++) {
            array[i][j] += num8 / 4.0 * (array[i + 1][j] + array[i - 1][j] + array[i][j + 1] + array[i][j - 1] - 4.0 * array[i][j]);
        }
    }

    //if (outPolygon) {//裁切
    //    for (var i = 0; i < num2 ; i++) {
    //        for (var j = 0; j < num  ; j++) {
    //            var pt = turf.point([X[j], Y[i]]);
    //            var isInside = turf.inside(pt, outPolygon);
    //            if (!isInside) {
    //                array[i][j] = -999.0;
    //            }
    //        }
    //    }
    //}

    //array.reverse();
    array2 = [];
    return array;
}


/**
*Interpolation with IDW neighbor method
*@param {Array}SCoords SCoords Discrete data array
*@param {Array<Number>}X Grid X array
*@param {Array<Number>}Y Grid Y array
*@param {Number}NumberOfNearestNeighbors  Number of nearest neighbors
*@param {turf.polygon}[outPolygon=undefined] 
*@return {Array<Array<Array<Number>>>}
*/
Interpolate.Interpolation_IDW_Neighbor3D = function (SCoords, X, Y, NumberOfNearestNeighbors, outPolygon) {

    var num = X.length;
    var num2 = Y.length;
    var layerCount = SCoords[2].length;
    var length = SCoords[0].length;
    var array = new Array(layerCount);

    for (var l_i = 0; l_i < layerCount; l_i++) {
        array[l_i] = new Array(num2);
        for (var i = 0; i < num2; i++) {
            array[l_i][i] = new Float32Array(num);
        }
    }
    var array2 = [new Float32Array(NumberOfNearestNeighbors), new Float32Array(NumberOfNearestNeighbors)];
    for (var i = 0; i < num2; i++) {
        for (var j = 0; j < num; j++) {

            for (var l_i = 0; l_i < layerCount; l_i++) {
                array[l_i][i][j] = -999.0;
            }

            for (var k = 0; k < NumberOfNearestNeighbors; k++) {
                if (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0) == 0.0) {
                    for (var l_i = 0; l_i < layerCount; l_i++) {
                        array[l_i][i][j] = SCoords[2][l_i][k];
                    }
                    break;
                }
                var num5 = 1.0 / (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0));
                array2[0][k] = num5;
                array2[1][k] = k;
            }

            if (array[0][i][j] == -999.0) {
                for (var k = NumberOfNearestNeighbors; k < length; k++) {
                    if (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0) == 0.0) {
                        for (var l_i = 0; l_i < layerCount; l_i++) {
                            array[l_i][i][j] = SCoords[2][l_i][k];
                        }
                        break;
                    }
                    var num5 = 1.0 / (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0));
                    var num6 = array2[0][0];
                    var num7 = 0;
                    for (var l = 1; l < NumberOfNearestNeighbors; l++) {
                        if (array2[0][l] < num6) {
                            num6 = array2[0][l];
                            num7 = l;
                        }
                    }
                    if (num5 > num6) {
                        array2[0][num7] = num5;
                        array2[1][num7] = k;
                    }
                }
                for (var l_i = 0; l_i < layerCount; l_i++) {
                    if (array[l_i][i][j] == -999.0) {
                        var num3 = 0.0;
                        var num4 = 0.0;
                        for (var k = 0; k < NumberOfNearestNeighbors; k++) {
                            num3 += array2[0][k] * SCoords[2][l_i][parseInt(array2[1][k])];
                            num4 += array2[0][k];
                        }
                        array[l_i][i][j] = num3 / num4;
                    }
                }
            }
        }
    }

    var num8 = 0.5;
    for (var i = 1; i < num2 - 1; i++) {
        for (var j = 1; j < num - 1; j++) {
            for (var l_i = 0; l_i < layerCount; l_i++) {
                array[l_i][i][j] += num8 / 4.0 * (array[l_i][i + 1][j] + array[l_i][i - 1][j] + array[l_i][i][j + 1] + array[l_i][i][j - 1] - 4.0 * array[l_i][i][j]);
            }
        }
    }

    ////裁剪
    //if (outPolygon) {
    //    for (var i = 0; i < num2 ; i++) {
    //        for (var j = 0; j < num  ; j++) {
    //            var pt = turf.point([X[j], Y[i]]);
    //            var isInside = turf.inside(pt, outPolygon);
    //            if (!isInside) {
    //                for (var l_i = 0; l_i < layerCount; l_i++) {
    //                    array[l_i][i][j] = -999.0;
    //                }
    //            }
    //        }
    //    }
    //}
    //array2 = [];
    //for (var l_i = 0; l_i < layerCount; l_i++) {
    //    array[l_i].reverse();
    //}
    return array;
}

/**
 *
 *@param {Array<Array<Number>>}SCoords
 *@param {Array<Number>}X 
 *@param {Array<Number>}Y 
 *@param {Number}NumberOfNearestNeighbors 
 *@param {Number}unDefData 
 *@param {turf.polygon}[outPolygon=undefined]  
 *@return {Array<Array<Number>>}
 */
Interpolate.Interpolation_IDW_Neighbor_UnDef = function (SCoords, X, Y, NumberOfNearestNeighbors, unDefData, outPolygon) {
    var num = X.length;
    var num2 = Y.length;
    var length = SCoords[0].length;
    var array = new Array(num2);// num];
    for (var i = 0; i < num2; i++) {
        array[i] = new Float32Array(num);
    }
    var array2 = new Float32Array(length);
    var array3 = [new Float32Array(NumberOfNearestNeighbors), new Float32Array(NumberOfNearestNeighbors)];
    for (var i = 0; i < num2; i++) {
        for (var j = 0; j < num; j++) {
            array[i][j] = unDefData;
            var num3 = 0.0;
            var num4 = 0.0;
            var num5 = 0;
            for (var k = 0; k < length; k++) {
                if (SCoords[2][k] == unDefData) {
                    array2[k] = -1.0;
                }
                else {
                    if (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0) == 0.0) {
                        array[i][j] = SCoords[2][k];
                        break;
                    }
                    var num6 = 1.0 / (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0));
                    array2[k] = num6;
                    if (num5 < NumberOfNearestNeighbors) {
                        array3[0][num5] = num6;
                        array3[1][num5] = k;
                    }
                    num5++;
                }
            }
            if (array[i][j] == unDefData) {
                for (var k = 0; k < length; k++) {
                    var num6 = array2[k];
                    if (num6 != -1.0) {
                        var num7 = array3[0][0];
                        var num8 = 0;
                        for (var l = 1; l < NumberOfNearestNeighbors; l++) {
                            if (array3[0][l] < num7) {
                                num7 = array3[0][l];
                                num8 = l;
                            }
                        }
                        if (num6 > num7) {
                            array3[0][num8] = num6;
                            array3[1][num8] = k;
                        }
                    }
                }
                for (var k = 0; k < NumberOfNearestNeighbors; k++) {
                    num3 += array3[0][k] * SCoords[2][parseInt(array3[1][k])];
                    num4 += array3[0][k];
                }
                array[i][j] = num3 / num4;
            }
        }
    }
    var num9 = 0.5;
    for (var i = 1; i < num2 - 1; i++) {
        for (var j = 1; j < num - 1; j++) {
            array[i][j] += num9 / 4.0 * (array[i + 1][j] + array[i - 1][j] + array[i][j + 1] + array[i][j - 1] - 4.0 * array[i][j]);
        }
    }
    //if (outPolygon) {//裁切
    //    outPolygon = JSON.parse(outPolygon);
    //    for (var i = 0; i < num2 ; i++) {
    //        for (var j = 0; j < num  ; j++) {
    //            var pt = turf.point([X[j], Y[i]]);
    //            var isInside = turf.inside(pt, outPolygon);
    //            if (!isInside) {
    //                array[i][j] = -999.0;
    //            }
    //        }
    //    }
    //}
    //array.reverse();
    array2 = [];
    array3 = [];
    return array;
}

/**
*
*@param {Array<Array<Number>>}SCoords
*@param {Array<Number>}X 
*@param {Array<Number>}Y 
*@param {Number}NeededPointNum 
*@param {Number}radius 
*@param {Number}unDefData 
*@param {turf.polygon}[outPolygon=undefined]  
*@return {Array<Array<Number>>}
*/
Interpolate.Interpolation_IDW_Radius = function (SCoords, X, Y, NeededPointNum, radius, unDefData, outPolygon) {
    var num = X.length;
    var num2 = Y.length;
    var length = SCoords[0].length;
    var array = new Array(num2);//, num];
    for (var i = 0; i < num2; i++) {
        array[i] = new Float32Array(num);
    }
    for (var i = 0; i < num2; i++) {
        for (var j = 0; j < num; j++) {
            array[i][j] = unDefData;
            var flag = false;
            var num3 = 0.0;
            var num4 = 0.0;
            var num5 = 0;
            for (var k = 0; k < length; k++) {
                if (SCoords[2][k] != unDefData && SCoords[0][k] >= X[j] - radius && SCoords[0][k] <= X[j] + radius && SCoords[1][k] >= Y[i] - radius && SCoords[1][k] <= Y[i] + radius) {
                    if (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0) == 0.0) {
                        array[i][j] = SCoords[2][k];
                        flag = true;
                        break;
                    }
                    if (Math.sqrt(Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0)) <= radius) {
                        var num6 = 1.0 / (Math.pow(X[j] - SCoords[0][k], 2.0) + Math.pow(Y[i] - SCoords[1][k], 2.0));
                        num4 += num6;
                        num3 += SCoords[2][k] * num6;
                        num5++;
                    }
                }
            }
            if (!flag && num5 >= NeededPointNum) {
                array[i][j] = num3 / num4;
            }
        }
    }
    var num7 = 0.5;
    for (var i = 1; i < num2 - 1; i++) {
        for (var j = 1; j < num - 2; j++) {
            if (array[i][j] != unDefData && array[i + 1][j] != unDefData && array[i - 1][j] != unDefData && array[i][j + 1] != unDefData && array[i][j - 1] != unDefData) {
                array[i][j] += num7 / 4.0 * (array[i + 1][j] + array[i - 1][j] + array[i][j + 1] + array[i][j - 1] - 4.0 * array[i][j]);
            }
        }
    }
    //if (outPolygon) {//裁切
    //    for (var i = 0; i < num2 ; i++) {
    //        for (var j = 0; j < num  ; j++) {
    //            var pt = turf.point([X[j], Y[i]]);
    //            var isInside = turf.inside(pt, outPolygon);
    //            if (!isInside) {
    //                array[i][j] = -999.0;
    //            }
    //        }
    //    }
    //}

    //array.reverse();
    return array;
}

/**
 *
 *@param {Array<Array<Number>>}GridData
 *@param {Array<Number>}X 
 *@param {Array<Number>}Y  
 *@param {Number}unDefData 
 *@param {Array<Number>}nX 
 *@param {Array<Number>}nY 
 *@return {Array<Array<Number>>}
 */
Interpolate.Interpolation_Grid = function (GridData, X, Y, unDefData, nX, nY) {
    var arg_03_0 = X.length;
    var arg_07_0 = Y.length;
    var num = X.length * 2 - 1;
    var num2 = Y.length * 2 - 1;
    nX = new Float32Array(num);
    nY = new Float32Array(num2);
    var array = new Array(num2);//, num];
    for (var i = 0; i < num2; i++) {
        array[i] = new Float32Array(num);
    }
    var list = [];
    for (var i = 0; i < num; i++) {
        if (i % 2 == 0) {
            nX[i] = X[i / 2];
        }
        else {
            nX[i] = (X[(i - 1) / 2] + X[(i - 1) / 2 + 1]) / 2.0;
        }
    }
    for (var i = 0; i < num2; i++) {
        if (i % 2 == 0) {
            nY[i] = Y[i / 2];
        }
        else {
            nY[i] = (Y[(i - 1) / 2] + Y[(i - 1) / 2 + 1]) / 2.0;
        }
        for (var j = 0; j < num; j++) {
            if (i % 2 == 0 && j % 2 == 0) {
                array[i][j] = GridData[i / 2][j / 2];
            }
            else if (i % 2 == 0 && j % 2 != 0) {
                var num3 = GridData[i / 2][(j - 1) / 2];
                var num4 = GridData[i / 2][(j - 1) / 2 + 1];
                list = [];
                if (num3 != unDefData) {
                    list.push(num3);
                }
                if (num4 != unDefData) {
                    list.push(num4);
                }
                if (list.length == 0) {
                    array[i][j] = unDefData;
                }
                else if (list.length == 1) {
                    array[i][j] = list[0];
                }
                else {
                    array[i][j] = (num3 + num4) / 2.0;
                }
            }
            else if (i % 2 != 0 && j % 2 == 0) {
                var num3 = GridData[(i - 1) / 2][j / 2];
                var num4 = GridData[(i - 1) / 2 + 1][j / 2];
                list = [];
                if (num3 != unDefData) {
                    list.push(num3);
                }
                if (num4 != unDefData) {
                    list.push(num4);
                }
                if (list.length == 0) {
                    array[i][j] = unDefData;
                }
                else if (list.length == 1) {
                    array[i][j] = list[0];
                }
                else {
                    array[i][j] = (num3 + num4) / 2.0;
                }
            }
            else {
                var num3 = GridData[(i - 1) / 2][(j - 1) / 2];
                var num4 = GridData[(i - 1) / 2][(j - 1) / 2 + 1];
                var num5 = GridData[(i - 1) / 2 + 1][(j - 1) / 2 + 1];
                var num6 = GridData[(i - 1) / 2 + 1][(j - 1) / 2];
                list = [];
                if (num3 != unDefData) {
                    list.push(num3);
                }
                if (num4 != unDefData) {
                    list.push(num4);
                }
                if (num5 != unDefData) {
                    list.push(num5);
                }
                if (num6 != unDefData) {
                    list.push(num6);
                }
                if (list.length == 0) {
                    array[i][j] = unDefData;
                }
                else if (list.length == 1) {
                    array[i][j] = list[0];
                }
                else {
                    var num7 = 0.0;
                    list.forEach(function (num8) {
                        num7 += num8;
                    })
                    //for (var num8 in list) {
                    //    num7 += num8;
                    //}
                    array[i][j] = num7 / list.length;
                }
            }
        }
    }
    return array;
}

/**
 *
 *@param {Array<Array<Number>>}stationData
 *@param {Array<Number>}X 
 *@param {Array<Number>}Y  
 *@param {Number}unDefData
 *@return {Array<Array<Number>>}
 */
Interpolate.Cressman = function (stationData, X, Y, unDefData) {
    var list = [];
    list.push(10.0,
                7.0,
                4.0,
                2.0,
                1.0);
    return Interpolate.Cressman_RadList(stationData, X, Y, unDefData, list);
}

/**
 *
 *@param {Array<Array<Number>>}stationData
 *@param {Array<Number>}X 
 *@param {Array<Number>}Y  
 *@param {Number}unDefData
 *@param {Array<Number>}radList  
 *@return {Array<Array<Number>>}
 */
Interpolate.Cressman_RadList = function (stationData, X, Y, unDefData, radList) {
    var num = X.length;
    var num2 = Y.length;
    var length = stationData[0].length;
    var array = new Array(num2);//, num];
    for (var i = 0; i < num2; i++) {
        array[i] = new Float32Array(num);
    }
    var count = radList.length;
    var num3 = X[0];
    var num4 = X[X.length - 1];
    var num5 = Y[0];
    var num6 = Y[Y.length - 1];
    var num7 = X[1] - X[0];
    var num8 = Y[1] - Y[0];
    var num9 = 0.0;
    var num10 = 0.0;
    var num11 = 0;
    for (var i = 0; i < length; i++) {
        var num12 = stationData[0][i];
        var num13 = stationData[1][i];
        stationData[0][i] = (num12 - num3) / num7;
        stationData[1][i] = (num13 - num5) / num8;
        if (stationData[2][i] != unDefData) {
            num10 += stationData[2][i];
            num11++;
        }
    }
    num10 /= num11;
    var num14 = -9.999E+20;
    var num15 = 9.999E+20;
    var array2 = new Array(num2);// new double[num2, num];
    var array3 = new Array(num2);// new double[num2, num];
    for (var i = 0; i < num2; i++) {
        array2[i] = new Float32Array(num);
        array3[i] = new Float32Array(num);
    }
    for (var i = 0; i < num2; i++) {
        for (var j = 0; j < num; j++) {
            array2[i][j] = num14;
            array3[i][j] = num15;
        }
    }
    var num16;
    if (radList.length > 0) {
        num16 = radList[0];
    }
    else {
        num16 = 4.0;
    }
    for (var i = 0; i < num2; i++) {
        var num13 = i;
        num5 = num13 - num16;
        num6 = num13 + num16;
        for (var j = 0; j < num; j++) {
            var num12 = j;
            num3 = num12 - num16;
            num4 = num12 + num16;
            num11 = 0;
            num9 = 0.0;
            for (var k = 0; k < length; k++) {
                var num17 = stationData[2][k];
                var num18 = stationData[0][k];
                var num19 = stationData[1][k];
                if (num18 >= 0.0 && num18 < (num - 1) && num19 >= 0.0 && num19 < (num2 - 1) && num17 != unDefData && num18 >= num3 && num18 <= num4 && num19 >= num5 && num19 <= num6) {
                    var num20 = Math.sqrt(Math.pow(num18 - num12, 2.0) + Math.pow(num19 - num13, 2.0));
                    if (num20 <= num16) {
                        num9 += num17;
                        num11++;
                        if (array2[i][j] < num17) {
                            array2[i][j] = num17;
                        }
                        if (array3[i][j] > num17) {
                            array3[i][j] = num17;
                        }
                    }
                }
            }
            if (num11 == 0) {
                array[i][j] = unDefData;
            }
            else {
                array[i][j] = num9 / num11;
            }
        }
    }
    for (var l = 0; l < count; l++) {
        num16 = radList[l];
        for (var i = 0; i < num2; i++) {
            var num13 = i;
            num5 = num13 - num16;
            num6 = num13 + num16;
            for (var j = 0; j < num; j++) {
                if (array[i][j] != unDefData) {
                    var num12 = j;
                    num3 = num12 - num16;
                    num4 = num12 + num16;
                    num9 = 0.0;
                    var num21 = 0.0;
                    for (var m = 0; m < length; m++) {
                        var num22 = stationData[2][m];
                        var num23 = stationData[0][m];
                        var num24 = stationData[1][m];
                        if (num23 >= 0.0 && num23 < (num - 1) && num24 >= 0.0 && num24 < (num2 - 1) && num22 != unDefData && num23 >= num3 && num23 <= num4 && num24 >= num5 && num24 <= num6) {
                            var num25 = Math.sqrt(Math.pow(num23 - num12, 2.0) + Math.pow(num24 - num13, 2.0));
                            if (num25 <= num16) {
                                var num26 = parseInt(num24);
                                var num27 = parseInt(num23);
                                var num28 = num26 + 1;
                                var num29 = num27 + 1;
                                var num30 = array[num26][num27];
                                var num31 = array[num26][num29];
                                var num32 = array[num28][num27];
                                var num33 = array[num28][num29];
                                var list = [];
                                if (num30 != unDefData) {
                                    list.push(num30);
                                }
                                if (num31 != unDefData) {
                                    list.push(num31);
                                }
                                if (num32 != unDefData) {
                                    list.push(num32);
                                }
                                if (num33 != unDefData) {
                                    list.push(num33);
                                }
                                if (list.length != 0) {
                                    var num34;
                                    if (list.length == 1) {
                                        num34 = list[0];
                                    }
                                    else if (list.length <= 3) {
                                        var num35 = 0.0;
                                        list.forEach(function myfunction(num36) {
                                            num35 += num36;
                                        });
                                        //    foreach (v num36 in list)
                                        //    {
                                        //        num35 += num36;
                                        //}
                                        num34 = num35 / list.length;
                                    }
                                    else {
                                        var num37 = num30 + (num32 - num30) * (num24 - num26);
                                        var num38 = num31 + (num33 - num31) * (num24 - num26);
                                        num34 = num37 + (num38 - num37) * (num23 - num27);
                                    }
                                    var num39 = num22 - num34;
                                    var num40 = (num16 * num16 - num25 * num25) / (num16 * num16 + num25 * num25);
                                    num9 += num39 * num40;
                                    num21 += num40;
                                }
                            }
                        }
                    }
                    if (num21 < 1E-06) {
                        array[i][j] = unDefData;
                    }
                    else {
                        var val = array[i][j] + num9 / num21;
                        array[i][j] = Math.max(array3[i][j], Math.min(array2[i][j], val));
                    }
                }
            }
        }
    }
    return array;
}

/**
*
*@param {Array<Array<Number>>}stationData
*@param {Array<Number>}GX 
*@param {Array<Number>}GY  
*@param {Number}unDefData
*@param {Array<Number>}radList  
*@return {Array<Array<Number>>}
*/
Interpolate.CressmanR = function (stationData, GX, GY, unDefData, radList) {
    var num = GY.length;
    var num2 = GX.length;
    var num3 = num;
    var num4 = num2;
    var array = new Array(num);//, num2];
    var array2 = new Array(num);//, num2];
    var array3 = new Array(num);// new double[num, num2];
    var array4 = new Array(num);// new double[num, num2];
    var array5 = new Array(num);// new double[num, num2];
    var array6 = new Array(num);// new double[num, num2];
    var array7 = new Array(num);// new double[num, num2];

    for (var i = 0; i < num; i++) {
        array[i] = new Float32Array(num2);
        array2[i] = new Int32Array(num2);
        array3[i] = new Float32Array(num2);
        array4[i] = new Float32Array(num2);
        array5[i] = new Float32Array(num2);
        array6[i] = new Float32Array(num2);
        array7[i] = new Float32Array(num2);
    }

    var length = stationData[0].length;
    var num5 = length;
    var array8 = new Float32Array(length);
    var array9 = new Float32Array(length);
    var array10 = new Float32Array(length);
    var num6 = GX[0];
    var arg_7F_0 = GX[GX.length - 1];
    var num7 = GY[0];
    var arg_8C_0 = GY[GY.length - 1];
    var num8 = GX[1] - GX[0];
    var num9 = GY[1] - GY[0];
    for (var i = 0; i < length; i++) {
        array8[i] = stationData[2][i];
        array9[i] = (stationData[0][i] - num6) / num8;
        array10[i] = (stationData[1][i] - num7) / num9;
    }
    var num10 = -9.999E+20;
    var num11 = 9.999E+20;
    var num12 = 0.0;
    var num13 = 0.0;
    for (var j = 0; j < num5; j++) {
        if (Math.abs(array8[j]) != unDefData) {
            num12 += array8[j];
            num13 += 1.0;
        }
    }
    if (num13 == 0.0) {
        return null;
    }
    num12 /= num13;
    for (var j = 0; j < num4; j++) {
        for (var i = 0; i < num3; i++) {
            array[i][j] = num12;
        }
    }
    for (var j = 0; j < num4; j++) {
        for (var i = 0; i < num3; i++) {
            array3[i][j] = num10;
            array4[i][j] = num11;
            array5[i][j] = 0.0;
            array2[i][j] = 0;
        }
    }
    var num14 = radList[0];
    var num15 = num14 - 1.0;
    for (var k = 0; k < num5; k++) {
        if (array8[k] != unDefData) {
            var num16 = parseInt(Math.max(1.0, array10[k] - num15));
            var num17 = parseInt(Math.min(num4, array10[k] + num14));
            var num18 = parseInt(Math.max(1.0, array9[k] - num15));
            var num19 = parseInt(Math.min(num3, array9[k] + num14));
            for (var j = num16 - 1; j < num17; j++) {
                for (var i = num18 - 1; i < num19; i++) {
                    if (array8[k] > array3[i][j]) {
                        array3[i][j] = array8[k];
                    }
                    if (array8[k] < array4[i][j]) {
                        array4[i][j] = array8[k];
                    }
                    array5[i][j] += array8[k];
                    array2[i][j]++;
                }
            }
        }
    }
    for (var j = 0; j < num4; j++) {
        for (var i = 0; i < num3; i++) {
            if (array2[i][j] > 0) {
                array5[i][j] /= array2[i][j];
            }
            else {
                array5[i][j] = num12;
            }
        }
    }
    var count = radList.length;
    for (var l = 0; l < count; l++) {
        num14 = radList[l];
        num15 = num14 - 1.0;
        var num20 = num14 * num14;
        for (var j = 0; j < num4; j++) {
            for (var i = 0; i < num3; i++) {
                array7[i][j] = 0.0;
                array6[i][j] = 0.0;
            }
        }
        for (var m = 0; m < num5; m++) {
            if (array8[m] != unDefData && array9[m] >= 0.0 && array9[m] < (num4 - 1) && array10[m] >= 0.0 && array10[m] < (num3 - 1)) {
                var num21 = array9[m];
                var num22 = array10[m];
                var num23 = parseInt(num21);
                var num24 = parseInt(num22);
                var num25 = num21 - num23;
                var num26 = num22 - num24;
                var num27 = array5[num23][num24] + (array5[num23 + 1][num24] - array5[num23][num24]) * num25 + (array5[num23][num24 + 1] - array5[num23][num24]) * num26 + (array5[num23][num24] - array5[num23 + 1][num24] - array5[num23][num24 + 1] + array5[num23 + 1][num24 + 1]) * num25 * num26;
                var num28 = array8[m] - num27;
                var num16 = parseInt(Math.max(1.0, num22 - num15));
                var num29 = num16;
                var num17 = parseInt(Math.min(num4, num22 + num14));
                var num18 = parseInt(Math.max(1.0, num21 - num15));
                var num30 = num18;
                var num19 = parseInt(Math.min(num3, num21 + num14));
                var num31 = num29 - num22 - 1.0;
                for (var j = num16 - 1; j < num17; j++) {
                    num31 += 1.0;
                    var num32 = num31 * num31;
                    var num33 = num30 - num21 - 1.0;
                    for (var i = num18 - 1; i < num19; i++) {
                        num33 += 1.0;
                        var num34 = num32 + num33 * num33;
                        if (num34 <= num20) {
                            var num35 = (num20 - num34) / (num20 + num34);
                            array6[i][j] += num35;
                            array7[i][j] += num35 * num28;
                        }
                    }
                }
            }
        }
        for (var j = 0; j < num4; j++) {
            for (var i = 0; i < num3; i++) {
                if (array6[i][j] >= 1E-05) {
                    var val = array5[i][j] + array7[i][j] / array6[i][j];
                    array5[i][j] = Math.max(array4[i][j], Math.min(array3[i][j], val));
                }
            }
        }
    }
    for (var j = 0; j < num4; j++) {
        for (var i = 0; i < num3; i++) {
            array5[i][j] = Math.min(num11, Math.max(num10, array5[i][j]));
            array[i][j] = array5[i][j];
        }
    }
    return array;
}

/**
*Assign point value to grid value
*@param {Array<Array<Number>>}SCoords point value array
*@param {Array<Number>}X X coordinate
*@param {Array<Number>}Y Y coordinate
*@param {Number}unDefData  undefined value
*@return {Array<Array<Number>>} grid data
*/
Interpolate.AssignPointToGrid = function (SCoords, X, Y, unDefData) {
    /// <summary>
    /// Assign point value to grid value
    /// </summary>
    /// <param name="SCoords">point value array</param>
    /// <param name="X">X coordinate</param>
    /// <param name="Y">Y coordinate</param>
    /// <param name="unDefData">undefined value</param>
    /// <returns>grid data</returns>

    var rowNum, colNum, pNum;
    colNum = X.length;
    rowNum = Y.length;
    pNum = SCoords[0].length;
    var GCoords = new Array2d(rowNum, colNum, Float32Array);
    var dX = X[1] - X[0];
    var dY = Y[1] - Y[0];
    var pNums = new Array2d(rowNum, colNum, Int32Array);

    for (var i = 0; i < rowNum; i++) {
        for (var j = 0; j < colNum; j++) {
            pNums[i][j] = 0;
            GCoords[i][j] = 0.0;
        }
    }

    for (var p = 0; p < pNum; p++) {
        if (Interpolate.DoubleEquals(SCoords[2][p], unDefData))
            continue;

        var x = SCoords[0][p];
        var y = SCoords[1][p];
        if (x < X[0] || x > X[colNum - 1])
            continue;
        if (y < Y[0] || y > Y[rowNum - 1])
            continue;

        var j = parseInt((x - X[0]) / dX);
        var i = parseInt((y - Y[0]) / dY);
        pNums[i][j] += 1;
        GCoords[i][j] += SCoords[2][p];
    }

    for (var i = 0; i < rowNum; i++) {
        for (var j = 0; j < colNum; j++) {
            if (pNums[i][j] == 0)
                GCoords[i][j] = unDefData;
            else
                GCoords[i][j] = GCoords[i][j] / pNums[i][j];
        }
    }

    return GCoords;
}

/**
*
*@param {Number}a
*@param {Number}b
*@return {Boolean}
*/
Interpolate.DoubleEquals = function (a, b) {
    if (Math.abs(a / b - 1) < 0.00000000001)
        return true;
    else
        return false;
}

function interpolateFunc(packedParameters, transferableObjects) {
    var result = Interpolate[packedParameters.methodName].apply(this, packedParameters.args);
    return result;
}

interpolate = Cesium.createTaskProcessorWorker(interpolateFunc);
if (define) {
    define("Workers/interpolate", [], function () {
        return interpolate;
    });
}
 