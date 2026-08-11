// config.js — All numeric constants for far-west (world, terrain, rivers, sky, biomes).
// Exports: WORLD, TERRAIN, RIVER, LOD, SKYCFG, BIOME, PLAYER, COLORS.
// To change gameplay/visual feel, edit numbers here — never inside game modules.

/** World dimensions and determinism */
export const WORLD = {
  SIZE: 2048,          // m — world edge length (square, centered on origin)
  HALF: 1024,          // m — half edge (coords span [-1024, 1024])
  CHUNK_COUNT: 8,      // 8x8 terrain chunks
  CHUNK_SIZE: 256,     // m — chunk edge length
  GRID_STEP: 2,        // m — heightfield sample spacing (high LOD = grid resolution)
  SEED: 1876,          // fixed seed — identical world every session (SPEC D-4)
};

/** Heightfield: fBm hills + ridged mountain mask + central gentle valley */
export const TERRAIN = {
  FBM_OCTAVES: 4,
  FBM_FREQ: 1 / 620,   // base hill frequency
  FBM_AMP: 26,         // m — base hill amplitude
  FBM_LACUNARITY: 2.0,
  FBM_GAIN: 0.5,
  MOUNTAIN_AMP: 215,   // m — ridged-noise amplitude inside the mountain mask
  MOUNTAIN_FREQ: 1 / 470,
  MOUNTAIN_OCTAVES: 4,
  MASK_START: 0.52,    // radial fraction of HALF where mountains begin
  MASK_END: 1.15,      // radial fraction where mask is full
  MASK_NORTH_BIAS: 0.30, // extra mask weight towards north (-Z) so peaks frame the horizon
  VALLEY_RADIUS: 300,  // m — central gentle-valley radius
  VALLEY_FLATTEN: 0.5, // height reduction factor at valley center
  SNOW_LINE: 118,      // m — above this, snow color
  ROCK_SLOPE: 0.62,    // gradient magnitude above which rock color dominates
};

/** Rivers: two channels descending from the mountains to one lake */
export const RIVER = {
  COUNT: 2,
  HALF_WIDTH: 9,       // m — carved channel half width (water surface width)
  BANK_WIDTH: 26,      // m — carve blend reach (banks)
  STEP: 16,            // m — polyline step
  MAX_STEPS: 160,      // safety cap on polyline length
  MEANDER: 0.6,        // rad — meander amplitude around the downhill direction
  MIN_DOWNGRADE: 0.05, // m — minimum bed drop per step (guarantees flow)
  FORD_DEPTH: 0.8,     // m — ford water depth (crossable on horseback)
  FORD_MAX: 1.2,       // m — gameplay: max crossable depth
  DEEP_DEPTH: 3.6,     // m — deep segment water depth (impassable)
  DEEP_THRESHOLD: 2.5, // m — gameplay: impassable above this
  FORD_EVERY: 230,     // m — ford pattern period along the river
  FORD_LEN: 90,        // m — ford stretch length within each period
  WATER_FILL: 0.75,    // water surface = bed + depth * this (below the banks)
  LAKE_RADIUS: 85,     // m
  LAKE_DEPTH: 4.5,     // m below lake water level
  STARTS: [            // mountain springs (inside the mountain mask by construction)
    { x: -350, z: -980 },
    { x: 950, z: -520 },
  ],
  LAKE: { x: 60, z: 80 }, // both rivers flow here
  BRIDGE_T: [0.5, 0.55],  // normalized position of the wooden bridges per river
  BRIDGE_WIDTH: 3.4,      // m — walkable deck width
  BRIDGE_EXTRA: 6,        // m — deck overhang beyond each bank
};

/** Chunk LOD swap distances */
export const LOD = {
  HIGH_DIST: 340,      // m — chunks closer than this to the camera use grid resolution
  LOW_STEP: 8,         // m — far chunk vertex spacing
};

/** Sky, fog, day/night cycle */
export const SKYCFG = {
  DAY_LENGTH: 600,     // s — full day/night cycle
  START_DAYTIME: 0.32, // 0=midnight, 0.5=noon — start mid-morning
  MAX_ELEV: 1.10,      // rad — sun elevation at noon
  FOG_DENSITY: 0.0011, // FogExp2 density
  SUN_DIST: 700,       // m — directional light distance from camera target
  SHADOW_RANGE: 170,   // m — ortho half-extent of the shadow camera
  TURBIDITY: 6,
  RAYLEIGH: 1.8,
  EXPOSURE: 0.75,
};

/** Biome scatter: densities and placement rules (InstancedMesh) */
export const BIOME = {
  MOISTURE_FREQ: 1 / 300,
  PINE_MIN_H: 32,      // m — pines above this altitude
  LEAF_MAX_H: 42,      // m — broadleaf below this altitude
  TREE_MAX_SLOPE: 0.55,
  BUSH_MAX_SLOPE: 0.75,
  RIVER_EXCLUDE: 20,   // m — no vegetation inside this distance of a river
  PINES: 3200,
  LEAF_TREES: 2000,
  BUSHES: 1600,
  ROCKS: 650,
  MAX_TRIES: 20,       // placement attempts per instance
  PINE_HEIGHT: 7.0,    // m — target height for the pine geometry
  LEAF_HEIGHT: 5.5,    // m — target height for the broadleaf geometry
  SCATTER_MAX_TRIS: 1200, // max triangles per instanced geometry; GLBs above this
                          // budget fall back to procedural (hero GLBs are for spawn())
};

/** Player baseline stats (used by T-FW-04+; declared now per contract) */
export const PLAYER = {
  HEALTH: 100,
  STAMINA: 100,
  FOOD: 100,
  AMMO_CYLINDER: 6,
  AMMO_RESERVE: 36,
  SPAWN_CANDIDATES: [  // valley spots near the future camp site; first valid wins
    { x: -220, z: 420 },
    { x: -140, z: 330 },
    { x: 200, z: 380 },
  ],
};

/** Horse locomotion: gait speeds, acceleration, turn rates, stamina, terrain rules */
export const HORSE = {
  WALK_SPD: 2.2,       // m/s — gait threshold/reference
  TROT_SPD: 6.0,       // m/s — max without Shift
  GALLOP_SPD: 14.0,    // m/s — max with Shift held (uplift: real run)
  ACCEL: 6.5,          // m/s^2 towards target speed
  DECEL: 6.0,          // m/s^2 coasting down when no input
  BRAKE: 9.0,          // m/s^2 when S held
  TURN_STOP: 2.6,      // rad/s steering at standstill
  TURN_WALK: 2.0,      // rad/s at walk
  TURN_TROT: 1.3,      // rad/s at trot
  TURN_GALLOP: 0.9,    // rad/s at gallop (slower turn when fast)
  STAMINA_DRAIN: 22,   // stamina/s while galloping
  STAMINA_REGEN: 9,    // stamina/s otherwise
  GALLOP_RESUME: 25,   // stamina needed to gallop again after exhaustion
  SLOPE_FACTOR: 1.5,   // uphill grade (rise/run) speed penalty
  DOWNHILL_BONUS: 0.15,// extra speed fraction going downhill
  MIN_SLOPE_SPD: 0.3,  // fraction of speed kept on the worst climb
  WATER_SPD: 0.55,     // speed fraction wading through shallow water
  GAIT_WALK_MAX: 2.6,  // m/s — speed thresholds for the gait label
  GAIT_TROT_MAX: 6.5,
  MODEL_HEIGHT: 2.05,  // m — horse model normalized to this height
  RIDER_HEIGHT: 1.75,  // m — cowboy model normalized to this height
  // Seat point (rider hip joints) in horse-tilt-local meters. Measured against
  // the skinned horse mesh: spine at x=0, back top ~1.52 at z=-0.42 (seat +0.04
  // after the ~0.09 pelvis offset). The rider pivots around this point.
  SADDLE: { x: 0.0, y: 1.65, z: -0.42 },
  JUMP_HEIGHT: 1.6,    // m — ballistic jump apex (Space)
  GRAVITY: 9.8,        // m/s^2
  JUMP_STAMINA: 5,     // stamina cost per jump
  HOOF_DUST_EVERY: 0.09, // s between hoof dust puffs at gallop on dry ground
};

/** Riding pose: joint targets in rider-local meters (flat IK-style rig — legs are
 * posed per-bone, not hierarchically; see player.js applyRidePose). Numbers come
 * from skinned-mesh probes of the horse barrel: half-width ~0.27-0.30 at knee
 * height, belly bottom ~0.90, back top ~1.52. Rider origin sits HIP_DROP below
 * the SADDLE seat point, so KNEE (0.34,0.80,0.27) lands at tilt-local
 * (±0.34,1.50,-0.15) — thigh near-horizontal wrapping the barrel — and FOOT
 * (0.38,0.28,0.20) lands at (±0.38,0.98,-0.22) — in the stirrup beside the
 * belly, clear of the barrel at every height. */
export const RIDE = {
  HIP_DROP: 0.95,    // m — rider origin this far below the seat (hip) point
  KNEE: { x: 0.34, y: 0.80, z: 0.27 },  // out past the barrel, up, forward
  FOOT: { x: 0.38, y: 0.28, z: 0.20 },  // stirrup: below the knee, beside the belly
  LEAN_MAX: 0.30,    // rad — forward lean at full gallop (~17 deg)
  LEAN_JUMP: 0.15,   // rad — extra forward lean while airborne
};

/** First/third person camera */
export const CAMERA = {
  THIRD_BACK: 6.2,     // m behind the horse
  THIRD_UP: 3.0,       // m above the horse root
  LOOK_AHEAD: 4.0,     // m — look target ahead of the horse
  LERP: 6.5,           // 1/s — exponential follow rate
  FIRST_EYE_UP: 2.35,  // m — rider eye height above horse root
  FIRST_EYE_FWD: 0.55, // m — eye forward offset (horse head visible below)
  FOV: 70,             // degrees
  AIM_FOV: 46,         // degrees while aiming
  FOV_LERP: 8,         // 1/s
  MIN_ABOVE_TERRAIN: 0.5, // m — third-person cam never below heightAt + this
  MOUSE_SENS: 0.0024,  // rad per pixel (pointer lock)
  PITCH_MIN: -0.6,     // rad
  PITCH_MAX: 0.8,
  HEADING_EASE: 2.5,   // 1/s — horse eases toward camera yaw when not aiming
  GALLOP_FOV_KICK: 8,  // degrees added at full gallop
  GALLOP_SHAKE: 0.055, // m — camera shake amplitude at gallop
};

/** Revolver combat */
export const COMBAT = {
  RANGE: 220,          // m — hitscan range
  COOLDOWN: 0.35,      // s between shots
  SPREAD_HIP: 0.003,   // rad — hip-fire dispersion (kept near-zero: SPEC R-04
                       // demands the shot land where the crosshair points)
  SPREAD_AIM: 0,       // rad — ADS is exact: hit = crosshair point
  RELOAD_TIME: 2.4,    // s
  CYLINDER: 6,         // rounds
  TRACER_LIFE: 0.09,   // s
  MUZZLE_LIFE: 0.07,   // s
  IMPACT_LIFE: 0.5,    // s
  DAMAGE: 34,          // per hit (consumed by T-FW-06 entities)
};

/** Settlement site selection */
export const SETTLEMENTS = {
  TOWN_MIN_DIST: 400,    // m between the two towns
  VILLAGE_TOWN_DIST: 250,// m min from any town
  VILLAGE_MIN_DIST: 300, // m between the two villages
  CAMP_SPAWN_DIST: 90,   // m max from spawn
  MAX_SLOPE: 0.28,       // max slope for a building site
  WATER_EXCLUDE: 45,     // m min distance from rivers
  LAKE_EXCLUDE: 160,     // m min distance from the lake
  TOWN_RADIUS: 45,
  VILLAGE_RADIUS: 30,
  CAMP_RADIUS: 12,
};

/** Towns: main street, buildings, NPC walkers, wagons */
export const TOWN = {
  STREET_LEN: 60,        // m
  NPCS_PER_TOWN: 4,
  NPC_WALK_SPD: 1.2,     // m/s
  NPC_WAIT_MAX: 4,       // s pause at street ends
  WAGONS_PER_TOWN: 1,
  WAGON_SPD: 3.0,        // m/s
  WAGON_LOOP_R: 80,      // m — loop radius around the town
};

/** Native villages: teepees, archers, arrows */
export const VILLAGE = {
  TEEPEES: 5,
  ARCHERS: 8,            // per village (<= 10 per SPEC)
  AGGRO_R: 40,           // m — archers engage inside this
  DEAGGRO_R: 70,         // m — they stand down beyond this
  ARROW_RANGE: 55,       // m — max shot
  ARROW_INTERVAL: 2.5,   // s between shots per archer
  ARROW_SPEED: 28,       // m/s
  ARROW_GRAVITY: 9.8,
  ARROW_DAMAGE: 6,
  ARCHER_HP: 2,
  DEATH_DESPAWN: 10,     // s a dead archer stays visible
};

/** Rail loop + train */
export const TRAIN = {
  SPEED: 12,             // m/s
  WAYPOINTS: 10,
  RADIUS: 380,           // m — loop stays in the hills (mountains start ~530)
  RADIUS_JITTER: 45,
  RAIL_GAUGE: 1.5,
  SLEEPER_EVERY: 3,      // m
  RAIL_EVERY: 4,         // m — rail segment length
  WAGONS: 3,
  WAGON_GAP: 12,         // m between cars
  AVOID_LAKE: 200,       // m min from lake center
  AVOID_TOWN: 180,       // m min from town centers
};

/** Fauna */
export const ANIMALS = {
  HERDS: 3,
  HERD_MIN: 4,
  HERD_MAX: 6,
  DEER_FLEE_R: 30,       // m — flee trigger
  DEER_FLEE_DIST: 60,    // m — flee run length
  DEER_WALK_SPD: 1.4,
  DEER_FLEE_SPD: 8,
  PICKUP_DIST: 3,        // m — [E] carcass pickup
  SNAKES: 12,
  SNAKE_STRIKE_R: 2.5,
  SNAKE_POISON: 8,       // health per strike
  SNAKE_COOLDOWN: 2,     // s between strikes per snake
  EAGLES: 4,
  EAGLE_ALT: 45,         // m above terrain
  EAGLE_R: 60,           // m circle radius
  EAGLE_SPEED: 0.35,     // rad/s
};

/** Fugitive bandits */
export const BANDITS = {
  COUNT: 5,
  REGION_R: 60,          // m — wander radius around home
  REGION_MIN_SPREAD: 200,// m between home regions
  FLEE_R: 50,            // m — flee trigger
  FLEE_SPD: 8,
  FLEE_DIST: 80,
  WANDER_SPD: 1.3,
  CAPTURE_DIST: 4,       // m — [E] capture of a surrendered bandit
};

/** Camp rules + hunger */
export const CAMP = {
  REGEN_R: 6,            // m from the campfire
  HEALTH_REGEN: 5,       // per second at camp
  STAMINA_REGEN: 25,     // per second at camp
  AMMO_REFILL_EVERY: 2,  // s per reserve round
  DELIVER_R: 10,         // m — [E] to deliver a carried deer
  FOOD_PER_DEER: 40,
  HUNGER_RATE: 0.14,     // food per second (100 food ~ 12 min)
  STARVE_RATE: 1.0,      // health per second at food 0
};

/** Fullscreen map + minimap */
export const MAP = {
  RES: 512,              // px — offscreen prerender resolution (4 m/px)
  MARGIN: 24,            // px — fullscreen map margin
  LEGEND: true,
  MINI_RADIUS: 90,       // px — minimap circle radius (180 px canvas)
  MINI_RANGE: 150,       // m — world radius shown on the minimap
  BANDIT_COLOR: '#e03030',
};

/** Synthesized audio (WebAudio, no files) */
export const AUDIO = {
  MASTER: 0.5,
  HOOF_VOL: 0.25,
  HOOF_WALK: 0.5,        // s between hoof bursts at walk
  HOOF_TROT: 0.33,
  HOOF_GALLOP: 0.22,
  GUN_VOL: 0.6,
  WIND_VOL: 0.12,
  CAMPFIRE_R: 12,        // m — crackle audible inside this
  TRAIN_R: 150,          // m — chug/whistle audible inside this
  WHISTLE_EVERY: 9,      // s
  EAGLE_CRY_MIN: 18,     // s — min interval between cries
  EAGLE_CRY_SPAN: 25,    // s — random extra
  WHOOSH_R: 30,          // m — arrow whoosh audible inside this
};

/** Static world collision (rocks, trunks, buildings) */
export const COLLISION = {
  HORSE_RADIUS: 0.55,  // m — horse body radius
  CELL_SIZE: 64,       // m — spatial hash cell
  TRUNK_RADIUS: 0.3,   // × instance scale
  ROCK_RADIUS: 0.9,    // × instance scale
  ROCK_HEIGHT: 1.6,    // × instance scale — below this, jumping clears the rock
  BUILDING_RADIUS: 4.2,
  TEEPEE_RADIUS: 2.4,
  TENT_RADIUS: 2.0,
  PROP_RADIUS: 0.9,    // campfire/crates/totem
};

/** Visual palette */
export const COLORS = {
  grassLush: 0x4d7a35,
  grassDry: 0x8a8a4a,
  dirt: 0x7a5f3d,
  sand: 0xb8a06a,
  rock: 0x6f6a63,
  snow: 0xe8ecf0,
  water: 0x2e6f8e,
  lake: 0x2a6484,
  wood: 0x6b4a2a,
  pineGreen: 0x2e5527,
  leafGreen: 0x4f7d2e,
  trunk: 0x5a4028,
  fogDay: 0xbfd4e6,
  fogNight: 0x0a0e1a,
  fogSunset: 0xe8a86a,
};
