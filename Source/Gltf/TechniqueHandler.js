
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
    define([
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
}