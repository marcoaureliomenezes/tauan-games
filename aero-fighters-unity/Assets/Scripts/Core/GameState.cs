// GameState.cs — Singleton that holds all mutable game state.
// Other systems read/write through this. Never duplicate state in local MonoBehaviour fields.

using UnityEngine;

public class GameState : MonoBehaviour
{
    // ── Singleton ─────────────────────────────────────────────────────────────
    public static GameState Instance { get; private set; }

    // ── Game flow ─────────────────────────────────────────────────────────────
    public bool  Running          = false;
    public bool  Paused           = false;
    public float TimeOfDay        = 0.35f;  // 0–1, drives SkyController
    public float GameTime         = 0f;

    // ── Score & progress ──────────────────────────────────────────────────────
    public int Score              = 0;
    public int Kills              = 0;
    public int MissionCycle       = 1;
    public int TargetsDestroyed   = 0;
    public int TargetsTotal       = 0;

    // ── Player vitals ─────────────────────────────────────────────────────────
    public int   Lives            = 3;
    public float Speed            = 25f;
    public float Throttle         = 0.5f;
    public bool  Stalled          = false;
    public bool  Dead             = false;
    public int   LightMissiles    = GameConfig.MISSILE_LIGHT_MAX;
    public int   HeavyMissiles    = GameConfig.MISSILE_HEAVY_MAX;
    public int   NuclearMissiles  = GameConfig.MISSILE_NUCLEAR_MAX;

    // ── Flags ─────────────────────────────────────────────────────────────────
    public float InvincibilityTimer   = 0f;
    public float RollTimer            = 0f;
    public float RollCooldown         = 0f;
    public int   RollDir              = 1;
    public bool  MissionFailed        = false;
    public bool  MissionCompleteShown = false;
    public float CrashFreezeTime      = 0f;
    public float ShakeTime            = 0f;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    private void Update()
    {
        float dt = Time.deltaTime;
        if (Running && !Paused)
        {
            GameTime      += dt;
            InvincibilityTimer = Mathf.Max(0f, InvincibilityTimer - dt);
            RollTimer          = Mathf.Max(0f, RollTimer - dt);
            RollCooldown       = Mathf.Max(0f, RollCooldown - dt);
            ShakeTime          = Mathf.Max(0f, ShakeTime - dt);
            CrashFreezeTime    = Mathf.Max(0f, CrashFreezeTime - dt);
        }

        // Pause toggle
        if (Input.GetKeyDown(KeyCode.Escape) || Input.GetKeyDown(KeyCode.P))
        {
            if (Running) Paused = !Paused;
        }
    }

    public void OnTargetKilled(TargetBase target)
    {
        Score           += target.ScoreValue;
        Kills           += 1;
        TargetsDestroyed += 1;
        MissionManager.Instance?.OnTargetKilled();
    }

    public void TriggerCrash(string reason)
    {
        if (MissionFailed) return;
        Lives--;
        if (Lives <= 0)
        {
            MissionManager.Instance?.GameOver("AERONAVE DESTRUIDA\n" + reason);
        }
        else
        {
            MissionManager.Instance?.RestartRound();
        }
    }

    public void StartBarrelRoll()
    {
        if (RollTimer > 0f || RollCooldown > 0f) return;
        RollTimer    = GameConfig.ROLL_DURATION;
        RollCooldown = GameConfig.ROLL_COOLDOWN;
        RollDir      *= -1;
    }

    public bool IsInvincible => InvincibilityTimer > 0f || RollTimer > 0f;

    /// Full reset for new game.
    public void ResetForNewGame()
    {
        Score             = 0;
        Kills             = 0;
        MissionCycle      = 1;
        TargetsDestroyed  = 0;
        TargetsTotal      = 0;
        Lives             = 3;
        Speed             = 25f;
        Throttle          = 0.5f;
        Stalled           = false;
        Dead              = false;
        LightMissiles     = GameConfig.MISSILE_LIGHT_MAX;
        HeavyMissiles     = GameConfig.MISSILE_HEAVY_MAX;
        NuclearMissiles   = GameConfig.MISSILE_NUCLEAR_MAX;
        InvincibilityTimer    = 0f;
        RollTimer             = 0f;
        RollCooldown          = 0f;
        MissionFailed         = false;
        MissionCompleteShown  = false;
        CrashFreezeTime       = 0f;
        ShakeTime             = 0f;
        GameTime              = 0f;
        TimeOfDay             = 0.35f;
        Running               = true;
        Paused                = false;
    }
}
