
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
        define(function () {
            return none_vert;
        })
     