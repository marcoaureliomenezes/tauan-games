// FlightController.cs — F-35 flight physics for Unity 6.
// Delta-time driven; all constants named in GameConfig.
// Ported from player.js in the Three.js reference implementation.

using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class FlightController : MonoBehaviour
{
    // ── Pre-allocated quaternion axes ─────────────────────────────────────────
    private static readonly Vector3 AxisPitch  = Vector3.right;
    private static readonly Vector3 AxisRoll   = Vector3.forward;
    private static readonly Vector3 AxisYawW   = Vector3.up;     // world up for yaw

    // ── Components ────────────────────────────────────────────────────────────
    private Rigidbody _rb;

    // ── Shared rotation workspace (no per-frame allocation) ───────────────────
    private Quaternion _pitchQ = Quaternion.identity;
    private Quaternion _rollQ  = Quaternion.identity;
    private Quaternion _yawQ   = Quaternion.identity;

    private void Awake()
    {
        _rb           = GetComponent<Rigidbody>();
        _rb.useGravity   = false;
        _rb.isKinematic  = true;  // manual physics control
    }

    private void Start()
    {
        Respawn();
    }

    private void FixedUpdate()
    {
        var gs = GameState.Instance;
        if (!gs.Running || gs.Paused || gs.CrashFreezeTime > 0f) return;

        float dt = Time.fixedDeltaTime;

        UpdateThrottle(gs, dt);
        UpdateSpeed(gs, dt);
        UpdateRotation(gs, dt);
        MoveForward(gs, dt);
        AfterburnerFX(gs);
        WriteMirrorState(gs);
        CheckSeaCrash(gs);
    }

    // ── Throttle ─────────────────────────────────────────────────────────────
    private void UpdateThrottle(GameState gs, float dt)
    {
        if (Input.GetKey(KeyCode.W))
            gs.Throttle = Mathf.Min(1f, gs.Throttle + dt * GameConfig.THROTTLE_UP_RATE);
        if (Input.GetKey(KeyCode.S))
            gs.Throttle = Mathf.Max(0.05f, gs.Throttle - dt * GameConfig.THROTTLE_DN_RATE);
    }

    // ── Speed convergence (same formula as Three.js) ─────────────────────────
    private void UpdateSpeed(GameState gs, float dt)
    {
        float targetSpeed = GameConfig.MIN_SPD + gs.Throttle * (GameConfig.MAX_SPD - GameConfig.MIN_SPD);
        float delta       = (targetSpeed - gs.Speed) * Mathf.Min(1f, dt * GameConfig.CONVERGE_RATE);
        gs.Speed          = Mathf.Max(2f, gs.Speed + delta);
        gs.Stalled        = gs.Speed < GameConfig.STALL_SPD;
    }

    // ── Rotation (pitch / roll / yaw) ────────────────────────────────────────
    private void UpdateRotation(GameState gs, float dt)
    {
        // Pitch — inverted (simulator style): UpArrow pulls nose down, DownArrow pulls up
        if (Input.GetKey(KeyCode.UpArrow))
        {
            _pitchQ = Quaternion.AngleAxis(-GameConfig.PITCH_RATE * dt * Mathf.Rad2Deg, AxisPitch);
            transform.rotation = transform.rotation * _pitchQ;
        }
        if (Input.GetKey(KeyCode.DownArrow))
        {
            _pitchQ = Quaternion.AngleAxis(GameConfig.PITCH_RATE * dt * Mathf.Rad2Deg, AxisPitch);
            transform.rotation = transform.rotation * _pitchQ;
        }

        // Roll + coordinated yaw (banking)
        if (Input.GetKey(KeyCode.LeftArrow))
        {
            _rollQ = Quaternion.AngleAxis(GameConfig.ROLL_RATE * dt * Mathf.Rad2Deg, AxisRoll);
            transform.rotation = transform.rotation * _rollQ;
            _yawQ = Quaternion.AngleAxis(GameConfig.YAW_RATE * dt * Mathf.Rad2Deg, AxisYawW);
            transform.rotation = _yawQ * transform.rotation;
        }
        if (Input.GetKey(KeyCode.RightArrow))
        {
            _rollQ = Quaternion.AngleAxis(-GameConfig.ROLL_RATE * dt * Mathf.Rad2Deg, AxisRoll);
            transform.rotation = transform.rotation * _rollQ;
            _yawQ = Quaternion.AngleAxis(-GameConfig.YAW_RATE * dt * Mathf.Rad2Deg, AxisYawW);
            transform.rotation = _yawQ * transform.rotation;
        }

        // Rudder (pure yaw — Q/E)
        if (Input.GetKey(KeyCode.Q))
        {
            float rate = GameConfig.YAW_RATE * GameConfig.RUDDER_FACTOR;
            _yawQ = Quaternion.AngleAxis(rate * dt * Mathf.Rad2Deg, AxisYawW);
            transform.rotation = _yawQ * transform.rotation;
        }
        if (Input.GetKey(KeyCode.E))
        {
            float rate = GameConfig.YAW_RATE * GameConfig.RUDDER_FACTOR;
            _yawQ = Quaternion.AngleAxis(-rate * dt * Mathf.Rad2Deg, AxisYawW);
            transform.rotation = _yawQ * transform.rotation;
        }

        // Barrel roll override
        if (gs.RollTimer > 0f)
        {
            float rollSpeed = (Mathf.PI * 2f / GameConfig.ROLL_DURATION) * gs.RollDir;
            _rollQ = Quaternion.AngleAxis(rollSpeed * dt * Mathf.Rad2Deg, AxisRoll);
            transform.rotation = transform.rotation * _rollQ;
        }

        // Barrel roll trigger
        if (Input.GetKeyDown(KeyCode.LeftShift))
            gs.StartBarrelRoll();
    }

    // ── Forward movement + lift ───────────────────────────────────────────────
    private void MoveForward(GameState gs, float dt)
    {
        // In Unity local space: -Z is forward (same as Three.js convention)
        Vector3 forward = -transform.forward;
        transform.position += forward * gs.Speed * dt;

        // Gravity always pulls down
        transform.position += Vector3.down * GameConfig.GRAVITY * dt;

        // Lift counters gravity when not stalled
        if (!gs.Stalled)
        {
            float liftFactor = Mathf.Min(gs.Speed / (GameConfig.MIN_SPD * 2.5f), 1f);
            Vector3 localUp  = transform.up;
            transform.position += localUp * GameConfig.GRAVITY * liftFactor * dt;
        }
    }

    // ── Visual afterburner (scale the exhaust child named "Exhaust") ──────────
    private void AfterburnerFX(GameState gs)
    {
        Transform exhaust = transform.Find("Exhaust");
        if (exhaust == null) return;
        float burn = 0.55f + gs.Throttle * 1.05f;
        exhaust.localScale = new Vector3(burn, burn, burn);
    }

    // ── Mirror position into GameState so HUD and AI can read it ─────────────
    private void WriteMirrorState(GameState gs)
    {
        // Intentional ordering contract: speed/stalled written first (UpdateSpeed),
        // position written last — same contract as Three.js player.js
    }

    // ── Sea collision ─────────────────────────────────────────────────────────
    private void CheckSeaCrash(GameState gs)
    {
        if (transform.position.y < GameConfig.SEA_CRASH_Y)
        {
            gs.CrashFreezeTime = 2.5f;
            SpawnCrashExplosion();
            gameObject.SetActive(false);
            gs.TriggerCrash("IMPACTO NO MAR");
        }
    }

    private void SpawnCrashExplosion()
    {
        // The ExplosionSystem handles particle FX; invoke here if present
        var fx = FindFirstObjectByType<ExplosionSystem>();
        if (fx != null) fx.SpawnExplosion(transform.position, ExplosionSize.Large);
    }

    // ── World position accessor (for other systems) ───────────────────────────
    public Vector3 WorldPosition => transform.position;

    /// Returns the fire direction and fire origin for weapon spawning.
    public Vector3 GetFireDirection() => -transform.forward;

    public Vector3 GetMuzzlePosition(float wingSign)
    {
        Vector3 right   = transform.right * wingSign * GameConfig.WING_OFFSET;
        Vector3 forward = -transform.forward * GameConfig.MUZZLE_OFFSET;
        return transform.position + right + forward;
    }

    /// Respawn player at start position (called by MissionManager on crash+lives remain).
    public void Respawn()
    {
        transform.position = new Vector3(0f, GameConfig.START_HEIGHT, 0f);
        transform.rotation = Quaternion.identity;
        gameObject.SetActive(true);
        var gs         = GameState.Instance;
        gs.Speed       = 25f;
        gs.Throttle    = 0.5f;
        gs.Stalled     = false;
        gs.Dead        = false;
    }

    // ── Terrain collision callback (called by IslandGenerator) ───────────────
    public void OnTerrainCollision()
    {
        var gs = GameState.Instance;
        if (gs.IsInvincible) return;
        gs.CrashFreezeTime = 2.5f;
        SpawnCrashExplosion();
        gameObject.SetActive(false);
        gs.TriggerCrash("COLISAO COM TERRENO");
    }
}
