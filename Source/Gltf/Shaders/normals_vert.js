
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
    define(function () {
    return normals_vert;
})