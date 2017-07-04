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
    define([], function () {
        return Material;
    });
}