

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
    define(function () {
    return none_frag;

})