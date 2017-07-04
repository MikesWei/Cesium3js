#ifdef GL_ES
    precision highp float;
#endif

varying vec3 v_position;
varying vec2 v_texcoord0;

uniform vec4 u_ambient;
uniform sampler2D u_diffuse;
uniform vec4 u_specular;
uniform float u_shininess;

uniform float u_transparency;

void main(void) 
{
    vec4 color = vec4(0.0, 0.0, 0.0, 0.0);
    vec3 diffuseLight = vec3(0.0, 0.0, 0.0);
    vec3 lightColor = vec3(1.0,1.0,1.0);
    vec4 ambient = u_ambient;
    vec4 diffuse = texture2D(u_diffuse, v_texcoord0);
    vec4 specular = u_specular;
    color.xyz += ambient.xyz;
    color.xyz += diffuse.xyz;
    color.xyz += specular.xyz;
    color = vec4(diffuse.rgb * diffuse.a, diffuse.a*u_transparency);
    gl_FragColor = color;
}
