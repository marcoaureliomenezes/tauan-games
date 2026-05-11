// SkyDome.shader — URP-compatible sky dome shader.
// Renders inside of a sphere (Cull Front) using the same Rayleigh + Mie
// approximation as the Three.js sky.js ShaderMaterial.
// Properties set via MaterialPropertyBlock from SkyController.cs.

Shader "TauanGames/SkyDome"
{
    Properties
    {
        _SunDirection   ("Sun Direction",   Vector)    = (0.5, 0.5, 0.3, 0)
        _TopColor       ("Top Color",       Color)     = (0.102, 0.439, 0.878, 1)
        _HorizonColor   ("Horizon Color",   Color)     = (0.565, 0.784, 0.941, 1)
        _SunColor       ("Sun Color",       Color)     = (1.0, 0.980, 0.667, 1)
        _SunVisible     ("Sun Visible",     Range(0,1)) = 1.0
    }

    SubShader
    {
        Tags
        {
            "RenderType"      = "Background"
            "Queue"           = "Background"
            "RenderPipeline"  = "UniversalPipeline"
        }

        LOD 100

        Pass
        {
            Name "SkyDome"

            Cull Front          // render inside of sphere
            ZWrite Off
            ZTest LEqual

            HLSLPROGRAM
            #pragma vertex   vert
            #pragma fragment frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            // Properties as uniform variables
            float4 _SunDirection;
            float4 _TopColor;
            float4 _HorizonColor;
            float4 _SunColor;
            float  _SunVisible;

            struct Attributes
            {
                float4 positionOS : POSITION;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionHCS : SV_POSITION;
                float3 localPos    : TEXCOORD0;
                UNITY_VERTEX_OUTPUT_STEREO
            };

            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                UNITY_SETUP_INSTANCE_ID(IN);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(OUT);

                // Pass model-space position to fragment shader unchanged
                // This ensures altitude = normalize(localPos).y is always
                // relative to dome center — same as vLocalPos in Three.js
                OUT.localPos    = IN.positionOS.xyz;
                OUT.positionHCS = TransformObjectToHClip(IN.positionOS.xyz);
                return OUT;
            }

            half4 frag(Varyings IN) : SV_Target
            {
                float3 dir      = normalize(IN.localPos);
                float  altitude = dir.y;  // -1 to +1

                // Horizon → zenith gradient (matches Three.js smoothstep)
                float  t        = smoothstep(-0.1, 0.4, altitude);
                float3 skyColor = lerp(_HorizonColor.rgb, _TopColor.rgb, t);

                // Sun halo (Mie-like forward scattering)
                float3 sunDir   = normalize(_SunDirection.xyz);
                float  sunDot   = dot(dir, sunDir);
                float  sunGlow  = pow(max(0.0, sunDot), 64.0);
                skyColor       += _SunColor.rgb * sunGlow * _SunVisible * 0.5;

                // Solar disc
                float  sunDisc  = smoothstep(0.9975, 0.9995, sunDot);
                skyColor        = lerp(skyColor,
                                       float3(1.0, 0.98, 0.92),
                                       sunDisc * _SunVisible);

                return half4(skyColor, 1.0);
            }
            ENDHLSL
        }
    }

    FallBack "Hidden/InternalErrorShader"
}
