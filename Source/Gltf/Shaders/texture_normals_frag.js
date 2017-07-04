
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
    define(function () {
        return texture_normals_frag;
    })