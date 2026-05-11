// MissionManager.cs — Controls wave flow: spawn → destroy all → next wave.
// Ported from missions.js in the Three.js reference implementation.

using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class MissionManager : MonoBehaviour
{
    public static MissionManager Instance { get; private set; }

    [Header("References")]
    public IslandGenerator IslandGen;
    public GameObject      PlayerObject;
    public HUD             GameHUD;

    // Target prefabs indexed by TargetType enum
    [Header("Target Prefabs")]
    public GameObject BasePrefab;
    public GameObject FactoryPrefab;
    public GameObject BuildingPrefab;
    public GameObject ConvoyPrefab;
    public GameObject AAGunPrefab;
    public GameObject WarshipPrefab;

    private readonly List<TargetBase> _activeTargets = new();
    private Coroutine _nextMissionCoroutine;

    private void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
    }

    private void Start()
    {
        // Show start overlay, wait for Space to begin
        if (GameHUD != null)
            GameHUD.ShowOverlay("AERO FIGHTERS", "Pressione ESPACO para iniciar", 0f);
    }

    private void Update()
    {
        if (!GameState.Instance.Running)
        {
            // Wait for Space on game over / start screen
            if (Input.GetKeyDown(KeyCode.Space))
            {
                if (GameState.Instance.Dead || !GameState.Instance.Running)
                    StartCoroutine(DoRestartGame());
            }
            return;
        }

        // Check mission complete each frame
        CheckMissionComplete();
    }

    private void CheckMissionComplete()
    {
        var gs = GameState.Instance;
        if (gs.MissionCompleteShown) return;
        if (gs.TargetsTotal == 0)    return;
        if (gs.TargetsDestroyed < gs.TargetsTotal) return;

        gs.MissionCompleteShown = true;
        StartCoroutine(DoNextMission());
    }

    private IEnumerator DoNextMission()
    {
        var gs = GameState.Instance;
        gs.MissionCycle += 1;
        if (GameHUD != null)
            GameHUD.ShowOverlay("MISSAO COMPLETA",
                $"Missao {gs.MissionCycle - 1} cumprida\npreparando proxima zona",
                GameConfig.NEXT_OVERLAY_SEC);

        yield return new WaitForSeconds(GameConfig.COMPLETE_DELAY_SEC);

        if (!gs.MissionFailed)
        {
            gs.MissionCompleteShown = false;
            SpawnMission(gs.MissionCycle);
        }
    }

    public void SpawnMission(int missionNum)
    {
        ClearTargets();
        var gs = GameState.Instance;
        gs.TargetsDestroyed = 0;

        int targetCount = TargetCountForMission(missionNum);
        int layoutLen   = GameConfig.TARGET_LAYOUT.GetLength(0);
        int count       = Mathf.Min(targetCount, layoutLen);

        for (int i = 0; i < count; i++)
        {
            int islandIdx = GameConfig.TARGET_LAYOUT[i, 0];
            float dx      = GameConfig.TARGET_LAYOUT[i, 1];
            float dz      = GameConfig.TARGET_LAYOUT[i, 2];
            int   typeIdx = GameConfig.TARGET_LAYOUT[i, 3];
            SpawnTarget(islandIdx, dx, dz, (TargetType)typeIdx, missionNum);
        }

        gs.TargetsTotal = _activeTargets.Count;
        if (GameHUD != null)
            GameHUD.ShowOverlay($"MISSAO {missionNum}",
                $"{gs.TargetsTotal} alvos detectados\ndestrua todos para avancar",
                GameConfig.NEXT_OVERLAY_SEC);
    }

    private void SpawnTarget(int islandIdx, float dx, float dz, TargetType type, int missionNum)
    {
        Vector3 worldPos;
        if (islandIdx == -1)
        {
            // Absolute world coordinate
            worldPos = new Vector3(dx, type == TargetType.Warship ? 0.6f : 0f, dz);
        }
        else
        {
            if (IslandGen == null || islandIdx >= GameConfig.ISLAND_DEFS.Length) return;
            Vector4 def  = GameConfig.ISLAND_DEFS[islandIdx];
            float cx     = def.x;
            float cz     = def.y;
            float radius = def.z;
            float peak   = def.w;
            float groundY = IslandGenerator.SampleHeight(dx, dz, radius, peak);
            worldPos = new Vector3(cx + dx, groundY, cz + dz);
        }

        GameObject prefab = GetPrefabForType(type);
        if (prefab == null) return;

        GameObject obj = Instantiate(prefab, worldPos, Quaternion.Euler(0f, Random.Range(0f, 360f), 0f));

        TargetBase tb = obj.GetComponent<TargetBase>();
        if (tb != null)
        {
            int hpBonus = (missionNum - 1) * GameConfig.HP_BONUS_PER_CYCLE;
            tb.InitStats(type, hpBonus, missionNum);
            _activeTargets.Add(tb);
        }
    }

    private GameObject GetPrefabForType(TargetType type)
    {
        return type switch
        {
            TargetType.Base     => BasePrefab,
            TargetType.Factory  => FactoryPrefab,
            TargetType.Building => BuildingPrefab,
            TargetType.Convoy   => ConvoyPrefab,
            TargetType.AAGun    => AAGunPrefab,
            TargetType.Warship  => WarshipPrefab,
            _                   => null,
        };
    }

    public void OnTargetKilled()
    {
        // GameState.TargetsDestroyed is incremented by GameState.OnTargetKilled
        // Nothing extra needed here — CheckMissionComplete polls each frame
    }

    public void GameOver(string reason)
    {
        if (GameState.Instance.MissionFailed) return;
        GameState.Instance.Running      = false;
        GameState.Instance.MissionFailed = true;
        GameState.Instance.Dead         = true;
        if (GameHUD != null)
            GameHUD.ShowOverlay(reason, "Pressione ESPACO para reiniciar", 0f);
    }

    public void RestartRound()
    {
        // Respawn player with invincibility
        GameState.Instance.InvincibilityTimer = 1.8f;
        if (PlayerObject != null)
        {
            var fc = PlayerObject.GetComponent<FlightController>();
            if (fc != null) fc.Respawn();
        }
    }

    private IEnumerator DoRestartGame()
    {
        yield return null;
        ClearTargets();
        GameState.Instance.ResetForNewGame();
        if (PlayerObject != null)
        {
            var fc = PlayerObject.GetComponent<FlightController>();
            if (fc != null) fc.Respawn();
        }
        if (GameHUD != null) GameHUD.HideOverlay();
        SpawnMission(1);
    }

    private void ClearTargets()
    {
        foreach (var t in _activeTargets)
        {
            if (t != null && t.gameObject != null)
                Destroy(t.gameObject);
        }
        _activeTargets.Clear();
    }

    public static int TargetCountForMission(int m)
    {
        int[] sizes = GameConfig.WAVE_SIZES;
        if (m <= sizes.Length) return sizes[m - 1];
        return sizes[sizes.Length - 1];
    }
}
