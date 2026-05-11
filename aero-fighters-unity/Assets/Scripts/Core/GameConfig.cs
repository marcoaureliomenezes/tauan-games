// GameConfig.cs — All named constants for Aero Fighters Unity.
// Source of truth for tuning. Change a value here and it propagates everywhere.
// Ported from config.js in the Three.js reference implementation.

using UnityEngine;

public static class GameConfig
{
    // ── Flight physics ────────────────────────────────────────────────────────
    public const float PITCH_RATE       = 1.45f;   // rad/s
    public const float ROLL_RATE        = 2.30f;   // rad/s
    public const float YAW_RATE         = 0.80f;   // rad/s
    public const float RUDDER_FACTOR    = 0.65f;   // pure-yaw multiplier
    public const float GRAVITY          = 14f;     // m/s² downward pull
    public const float STALL_SPD        = 10f;     // m/s — below = stall
    public const float MIN_SPD          = 8f;      // m/s — throttle-0 target
    public const float MAX_SPD          = 80f;     // m/s — throttle-1 target
    public const float CONVERGE_RATE    = 1.6f;    // speed lerp per second
    public const float THROTTLE_UP_RATE = 1.3f;    // throttle units/s up
    public const float THROTTLE_DN_RATE = 0.9f;    // throttle units/s down
    public const float START_HEIGHT     = 80f;     // initial altitude
    public const float SEA_CRASH_Y      = 3f;      // sea collision threshold
    public const float MOUNTAIN_BUFFER  = 2.5f;    // terrain margin

    // ── Cannon ────────────────────────────────────────────────────────────────
    public const float CANNON_RATE      = 0.08f;   // seconds between shots
    public const float BULLET_SPD       = 110f;    // m/s
    public const float BULLET_LIFE      = 2.0f;    // seconds
    public const float WING_OFFSET      = 0.91f;   // wing spread from center
    public const float MUZZLE_OFFSET    = 3.08f;   // forward from nose

    // ── Light missile (X) ─────────────────────────────────────────────────────
    public const int   MISSILE_LIGHT_MAX           = 100;
    public const float MISSILE_LIGHT_INITIAL_SPD   = 80f;
    public const float MISSILE_LIGHT_TRACKING_SPD  = 130f;
    public const float MISSILE_LIGHT_TURN_RATE     = 0.30f;
    public const float MISSILE_LIGHT_CLOSE_RATE    = 0.55f;
    public const float MISSILE_LIGHT_LIFE          = 6.0f;
    public const int   MISSILE_LIGHT_DAMAGE        = 4;
    public const float MISSILE_LIGHT_SEARCH_RANGE  = 1200f;

    // ── Heavy missile (B) ─────────────────────────────────────────────────────
    public const int   MISSILE_HEAVY_MAX           = 10;
    public const float MISSILE_HEAVY_INITIAL_SPD   = 65f;
    public const float MISSILE_HEAVY_TRACKING_SPD  = 100f;
    public const float MISSILE_HEAVY_TURN_RATE     = 0.22f;
    public const float MISSILE_HEAVY_CLOSE_RATE    = 0.45f;
    public const float MISSILE_HEAVY_LIFE          = 8.0f;
    public const int   MISSILE_HEAVY_DAMAGE        = 20;
    public const float MISSILE_HEAVY_SEARCH_RANGE  = 1500f;

    // ── Nuclear missile (N) ───────────────────────────────────────────────────
    public const int   MISSILE_NUCLEAR_MAX         = 3;
    public const float MISSILE_NUCLEAR_INITIAL_SPD = 60f;
    public const float MISSILE_NUCLEAR_TRACKING_SPD = 85f;
    public const float MISSILE_NUCLEAR_TURN_RATE   = 0.18f;
    public const float MISSILE_NUCLEAR_CLOSE_RATE  = 0.38f;
    public const float MISSILE_NUCLEAR_LIFE        = 12.0f;
    public const int   MISSILE_NUCLEAR_DAMAGE      = 4000;
    public const float NUCLEAR_BLAST_RADIUS        = 180f;
    public const float NUCLEAR_PLAYER_KILL_RADIUS  = 80f;
    public const float NUCLEAR_PLAYER_DMG_RADIUS   = 200f;

    // ── Barrel roll ───────────────────────────────────────────────────────────
    public const float ROLL_DURATION   = 0.5f;
    public const float ROLL_COOLDOWN   = 1.5f;

    // ── Targets ───────────────────────────────────────────────────────────────
    public const int   BASE_HP         = 28;
    public const int   BASE_SCORE      = 800;
    public const float BASE_DROP       = 0.6f;

    public const int   FACTORY_HP      = 20;
    public const int   FACTORY_SCORE   = 600;
    public const float FACTORY_DROP    = 0.5f;

    public const int   BUILDING_HP     = 14;
    public const int   BUILDING_SCORE  = 450;
    public const float BUILDING_DROP   = 0.3f;

    public const int   CONVOY_HP       = 12;
    public const int   CONVOY_SCORE    = 380;
    public const float CONVOY_DROP     = 0.4f;

    public const int   AAGUN_HP        = 6;
    public const int   AAGUN_SCORE     = 250;
    public const float AAGUN_DROP      = 0.1f;

    public const int   WARSHIP_HP      = 35;
    public const int   WARSHIP_SCORE   = 1200;
    public const float WARSHIP_DROP    = 0.5f;

    // ── AA guns ───────────────────────────────────────────────────────────────
    public const float AA_RANGE        = 220f;
    public const float AA_BASE_INTERVAL = 1.7f;
    public const float AA_CYCLE_SPEEDUP = 0.15f;
    public const float AA_MAX_SPEEDUP  = 0.7f;
    public const float ENEMY_BULLET_SPD = 36f;

    // ── Missions ──────────────────────────────────────────────────────────────
    public static readonly int[] WAVE_SIZES = { 8, 12, 16 };
    public const int   HP_BONUS_PER_CYCLE  = 3;
    public const float COMPLETE_DELAY_SEC  = 2.4f;
    public const float NEXT_OVERLAY_SEC    = 2.2f;

    // ── Day/night cycle ───────────────────────────────────────────────────────
    public const float DAY_CYCLE_SPEED  = 0.003f; // full cycle ~5 min

    // ── World ─────────────────────────────────────────────────────────────────
    public const float OCEAN_SIZE      = 10000f;
    public const float FOG_NEAR        = 300f;
    public const float FOG_FAR         = 700f;
    public const int   CLOUD_COUNT     = 60;
    public const float SKY_DOME_RADIUS = 3800f;

    // ── Island definitions: cx, cz, radius, peakHeight (18 islands) ───────────
    // Exact port of ISLAND_DEFS from config.js
    public static readonly Vector4[] ISLAND_DEFS = new Vector4[]
    {
        new Vector4( 100f, -320f,  70f,  55f),
        new Vector4(-360f, -580f,  95f,  78f),
        new Vector4( 520f, -480f,  58f,  42f),
        new Vector4(-120f, -920f, 115f,  94f),
        new Vector4( 620f, -830f,  68f,  52f),
        new Vector4(-540f, -420f,  50f,  36f),
        new Vector4( 240f,-1180f, 105f,  88f),
        new Vector4( -70f,-1480f,  62f,  50f),
        new Vector4( 820f,-1080f,  82f,  66f),
        new Vector4(-700f, -980f,  78f,  62f),
        new Vector4( 350f, -650f,  55f,  40f),
        new Vector4(-430f,-1300f,  90f,  72f),
        new Vector4(-800f,  400f, 115f,  95f),
        new Vector4( 600f,-1500f, 120f, 108f),
        new Vector4( 950f,  200f,  65f,  45f),
        new Vector4(-200f,  800f,  55f,  38f),
        new Vector4( 400f,  650f,  38f,  22f),
        new Vector4(-700f, -900f,  42f,  18f),
    };

    // ── Target layout: [islandIndex, dx, dz, typeIndex] ──────────────────────
    // typeIndex: 0=base,1=aaGun,2=factory,3=building,4=convoy,5=warship
    // islandIndex=-1 means absolute world coords (dx=X, dz=Z)
    public static readonly int[,] TARGET_LAYOUT = new int[,]
    {
        { 3,   0,   0, 0 },  // base
        { 3,  30,  15, 1 },  // aaGun
        { 3, -30,  20, 1 },  // aaGun
        { 1,   0,   0, 2 },  // factory
        { 6,   0,   0, 0 },  // base
        {11,   0,   0, 3 },  // building
        { 2,   0,   0, 4 },  // convoy
        { 7,   0,   0, 4 },  // convoy
        { 0,   0,   0, 0 },  // base
        { 0,  22,  18, 1 },  // aaGun
        { 8,   0,   0, 2 },  // factory
        {10,   0,   0, 3 },  // building
        { 4,   0,   0, 2 },  // factory
        { 9,   0,   0, 3 },  // building
        { 6,  30,  10, 1 },  // aaGun
        {11,  22,  10, 1 },  // aaGun
        {-1,-500,-700, 5 },  // warship (absolute)
        {-1, 500,-900, 5 },  // warship (absolute)
        {-1,-300,-1400,5},   // warship (absolute)
    };
}
