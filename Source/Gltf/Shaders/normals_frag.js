
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
    define(function () {
        return normals_frag;
    })