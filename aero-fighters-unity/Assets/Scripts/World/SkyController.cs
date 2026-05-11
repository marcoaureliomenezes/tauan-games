// SkyController.cs — Day/night cycle: drives DirectionalLight (sun), ambient light,
// fog, and sky dome uniforms. Full port of sky.js palettes and lighting model.

using UnityEngine;
using UnityEngine.Rendering;

public class SkyController : MonoBehaviour
{
    [Header("Scene References")]
    public Light SunLight;
    public MeshRenderer SkyDomeRenderer;  // SkyDome sphere with SkyDome.shader

    [Header("Sky Dome")]
    public bool SkyDomeFollowsCamera = true;
    private Camera _mainCamera;
    private MaterialPropertyBlock _skyBlock;

    // ── Color palette keys ─────────────────────────────────────────────────────
    private static readonly Color NightTop    = HexColor(0x060e1e);
    private static readonly Color NightHoriz  = HexColor(0x0a1628);
    private static readonly Color NightSun    = Color.black;

    private static readonly Color DawnTop     = HexColor(0x1a2a5e);
    private static readonly Color DawnHoriz   = HexColor(0xff6030);
    private static readonly Color DawnSun     = HexColor(0xffd080);

    private static readonly Color DayTop      = HexColor(0x1a70e0);
    private static readonly Color DayHoriz    = HexColor(0x90c8f0);
    private static readonly Color DaySun      = HexColor(0xfffaaa);

    private static readonly Color DuskTop     = HexColor(0x1a2060);
    private static readonly Color DuskHoriz   = HexColor(0xe04010);
    private static readonly Color DuskSun     = HexColor(0xff9040);

    private void Awake()
    {
        _mainCamera = Camera.main;
        _skyBlock   = new MaterialPropertyBlock();
    }

    private void Update()
    {
        if (!GameState.Instance.Running) return;

        float dt = Time.deltaTime;
        GameState.Instance.TimeOfDay =
            (GameState.Instance.TimeOfDay + dt * GameConfig.DAY_CYCLE_SPEED) % 1f;

        ApplyTimeOfDay(GameState.Instance.TimeOfDay);

        // Keep sky dome centered on camera (prevents edge artifacts)
        if (SkyDomeFollowsCamera && SkyDomeRenderer != null && _mainCamera != null)
            SkyDomeRenderer.transform.position = _mainCamera.transform.position;
    }

    private void ApplyTimeOfDay(float tod)
    {
        GetPalette(tod,
            out Color top, out Color horiz, out Color sun, out float sunVis,
            out float dirIntensity, out float ambIntensity);

        // Sun direction (same formula as sky.js)
        float angle = tod * Mathf.PI * 2f - Mathf.PI * 0.5f;
        Vector3 sunDir = new Vector3(Mathf.Cos(angle), Mathf.Sin(angle), 0.3f).normalized;

        // Directional light
        if (SunLight != null)
        {
            SunLight.transform.rotation = Quaternion.LookRotation(-sunDir, Vector3.up);
            SunLight.color              = sun;
            SunLight.intensity          = dirIntensity;
        }

        // Ambient
        RenderSettings.ambientMode  = AmbientMode.Flat;
        float nightFactor = NightFactor(tod);
        if (nightFactor > 0.01f)
            RenderSettings.ambientLight = new Color(0.04f, 0.055f, 0.10f) * ambIntensity;
        else
            RenderSettings.ambientLight = horiz * 0.6f * ambIntensity;

        // Fog (exponential squared matches Three.js linear approximation)
        RenderSettings.fog           = true;
        RenderSettings.fogMode       = FogMode.Linear;
        RenderSettings.fogStartDistance = GameConfig.FOG_NEAR;
        RenderSettings.fogEndDistance   = GameConfig.FOG_FAR;
        RenderSettings.fogColor      = horiz;

        // Sky dome shader properties
        if (SkyDomeRenderer != null)
        {
            SkyDomeRenderer.GetPropertyBlock(_skyBlock);
            _skyBlock.SetVector("_SunDirection", new Vector4(sunDir.x, sunDir.y, sunDir.z, 0f));
            _skyBlock.SetColor("_TopColor",      top);
            _skyBlock.SetColor("_HorizonColor",  horiz);
            _skyBlock.SetColor("_SunColor",      sun);
            _skyBlock.SetFloat("_SunVisible",    sunVis);
            SkyDomeRenderer.SetPropertyBlock(_skyBlock);
        }
    }

    // ── Palette interpolation (mirrors sky.js getSkyPalette) ─────────────────
    private static void GetPalette(float tod,
        out Color top, out Color horiz, out Color sun, out float sunVis,
        out float dirInt, out float ambInt)
    {
        // Phase boundaries match sky.js exactly
        if (tod < 0.15f)
        {
            top = NightTop; horiz = NightHoriz; sun = NightSun;
            sunVis = 0f; dirInt = 0f; ambInt = 0.18f;
        }
        else if (tod < 0.25f)
        {
            float k = Smoothstep((tod - 0.15f) / 0.10f);
            top = Color.Lerp(NightTop, DawnTop, k);
            horiz = Color.Lerp(NightHoriz, DawnHoriz, k);
            sun   = Color.Lerp(NightSun, DawnSun, k);
            sunVis = k; dirInt = k * 0.8f; ambInt = 0.18f + k * 0.37f;
        }
        else if (tod < 0.32f)
        {
            float k = Smoothstep((tod - 0.25f) / 0.07f);
            top = Color.Lerp(DawnTop, DayTop, k);
            horiz = Color.Lerp(DawnHoriz, DayHoriz, k);
            sun   = Color.Lerp(DawnSun, DaySun, k);
            sunVis = 1f; dirInt = 0.8f + k * 0.35f; ambInt = 0.55f;
        }
        else if (tod < 0.68f)
        {
            top = DayTop; horiz = DayHoriz; sun = DaySun;
            sunVis = 1f; dirInt = 1.15f; ambInt = 0.55f;
        }
        else if (tod < 0.75f)
        {
            float k = Smoothstep((tod - 0.68f) / 0.07f);
            top = Color.Lerp(DayTop, DuskTop, k);
            horiz = Color.Lerp(DayHoriz, DuskHoriz, k);
            sun   = Color.Lerp(DaySun, DuskSun, k);
            sunVis = 1f; dirInt = 1.15f - k * 0.35f; ambInt = 0.55f - k * 0.37f;
        }
        else if (tod < 0.85f)
        {
            top = DuskTop; horiz = DuskHoriz; sun = DuskSun;
            sunVis = 1f; dirInt = 0.8f; ambInt = 0.18f;
        }
        else if (tod < 0.92f)
        {
            float k = Smoothstep((tod - 0.85f) / 0.07f);
            top = Color.Lerp(DuskTop, NightTop, k);
            horiz = Color.Lerp(DuskHoriz, NightHoriz, k);
            sun   = Color.Lerp(DuskSun, NightSun, k);
            sunVis = 1f - k; dirInt = 0.8f - k * 0.8f; ambInt = 0.18f;
        }
        else
        {
            top = NightTop; horiz = NightHoriz; sun = NightSun;
            sunVis = 0f; dirInt = 0f; ambInt = 0.18f;
        }
    }

    private static float NightFactor(float tod)
    {
        if (tod < 0.10f) return 1f;
        if (tod < 0.20f) return 1f - Smoothstep((tod - 0.10f) / 0.10f);
        if (tod < 0.80f) return 0f;
        if (tod < 0.90f) return Smoothstep((tod - 0.80f) / 0.10f);
        return 1f;
    }

    private static float Smoothstep(float t)
    {
        t = Mathf.Clamp01(t);
        return t * t * (3f - 2f * t);
    }

    private static Color HexColor(int hex)
    {
        float r = ((hex >> 16) & 0xFF) / 255f;
        float g = ((hex >>  8) & 0xFF) / 255f;
        float b = ( hex        & 0xFF) / 255f;
        return new Color(r, g, b);
    }
}
