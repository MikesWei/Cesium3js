
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
    define(function () {
    return texture_frag;
})
