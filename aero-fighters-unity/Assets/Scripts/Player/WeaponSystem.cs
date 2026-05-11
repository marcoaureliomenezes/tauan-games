// WeaponSystem.cs — Cannon, homing missiles, and nuclear missile for the player jet.
// Object pool of 40 bullets; missiles use prefab Instantiate.
// Ported from projectiles.js in the Three.js reference implementation.

using System.Collections.Generic;
using UnityEngine;

public class WeaponSystem : MonoBehaviour
{
    // ── References ────────────────────────────────────────────────────────────
    private FlightController _flight;

    [Header("Prefabs")]
    public GameObject BulletPrefab;
    public GameObject LightMissilePrefab;
    public GameObject HeavyMissilePrefab;
    public GameObject NuclearMissilePrefab;

    // ── Bullet pool ───────────────────────────────────────────────────────────
    private const int BULLET_POOL_SIZE = 40;
    private readonly Queue<Bullet> _bulletPool = new();
    private readonly List<Bullet>  _activeBullets = new();

    // ── Cooldowns ─────────────────────────────────────────────────────────────
    private float _cannonCooldown = 0f;

    private void Awake()
    {
        _flight = GetComponent<FlightController>();
    }

    private void Start()
    {
        // Pre-populate bullet pool
        if (BulletPrefab == null) return;
        for (int i = 0; i < BULLET_POOL_SIZE; i++)
        {
            GameObject go = Instantiate(BulletPrefab);
            go.SetActive(false);
            Bullet b = go.GetComponent<Bullet>();
            if (b != null) _bulletPool.Enqueue(b);
        }
    }

    private void Update()
    {
        if (!GameState.Instance.Running || GameState.Instance.Paused) return;

        float dt = Time.deltaTime;
        _cannonCooldown = Mathf.Max(0f, _cannonCooldown - dt);

        // Cannon — Space or Z
        if ((Input.GetKey(KeyCode.Space) || Input.GetKey(KeyCode.Z)) && _cannonCooldown <= 0f)
        {
            FireCannon();
            _cannonCooldown = GameConfig.CANNON_RATE;
        }

        // Light missile — X
        if (Input.GetKeyDown(KeyCode.X))
            FireLightMissile();

        // Heavy missile — B
        if (Input.GetKeyDown(KeyCode.B))
            FireHeavyMissile();

        // Nuclear missile — N
        if (Input.GetKeyDown(KeyCode.N))
            FireNuclearMissile();

        // Update active bullets (pool recycle)
        for (int i = _activeBullets.Count - 1; i >= 0; i--)
        {
            Bullet b = _activeBullets[i];
            if (b == null || !b.gameObject.activeSelf)
            {
                _activeBullets.RemoveAt(i);
                if (b != null) _bulletPool.Enqueue(b);
            }
        }
    }

    // ── Cannon ────────────────────────────────────────────────────────────────
    private void FireCannon()
    {
        if (_flight == null) return;

        // Alternate wings: left then right
        for (int wing = -1; wing <= 1; wing += 2)
        {
            Vector3 muzzle    = _flight.GetMuzzlePosition(wing);
            Vector3 direction = _flight.GetFireDirection();

            Bullet bullet = GetPooledBullet();
            if (bullet != null)
            {
                bullet.Launch(muzzle, direction, isEnemy: false);
                _activeBullets.Add(bullet);
            }
        }
    }

    private Bullet GetPooledBullet()
    {
        if (_bulletPool.Count > 0)
        {
            Bullet b = _bulletPool.Dequeue();
            return b;
        }
        // Pool exhausted: create new (rare path)
        if (BulletPrefab == null) return null;
        return Instantiate(BulletPrefab).GetComponent<Bullet>();
    }

    // ── Light missile ─────────────────────────────────────────────────────────
    private void FireLightMissile()
    {
        var gs = GameState.Instance;
        if (gs.LightMissiles <= 0 || LightMissilePrefab == null) return;

        TargetBase target = FindNearestTarget(GameConfig.MISSILE_LIGHT_SEARCH_RANGE);
        if (target == null) return;

        gs.LightMissiles--;
        SpawnMissile(LightMissilePrefab, target, MissileKind.Light);
    }

    // ── Heavy missile ─────────────────────────────────────────────────────────
    private void FireHeavyMissile()
    {
        var gs = GameState.Instance;
        if (gs.HeavyMissiles <= 0 || HeavyMissilePrefab == null) return;

        TargetBase target = FindNearestTarget(GameConfig.MISSILE_HEAVY_SEARCH_RANGE);
        if (target == null) return;

        gs.HeavyMissiles--;
        SpawnMissile(HeavyMissilePrefab, target, MissileKind.Heavy);
    }

    // ── Nuclear missile ───────────────────────────────────────────────────────
    private void FireNuclearMissile()
    {
        var gs = GameState.Instance;
        if (gs.NuclearMissiles <= 0 || NuclearMissilePrefab == null) return;

        TargetBase target = FindNearestTarget(GameConfig.MISSILE_HEAVY_SEARCH_RANGE);
        // Nuclear fires even without lock (area damage)
        gs.NuclearMissiles--;
        SpawnMissile(NuclearMissilePrefab, target, MissileKind.Nuclear);
    }

    private void SpawnMissile(GameObject prefab, TargetBase target, MissileKind kind)
    {
        if (_flight == null) return;
        Vector3 spawnPos  = _flight.GetMuzzlePosition(0f);
        Vector3 spawnDir  = _flight.GetFireDirection();
        GameObject go     = Instantiate(prefab, spawnPos, Quaternion.LookRotation(spawnDir));
        HomingMissile hm  = go.GetComponent<HomingMissile>();
        NuclearMissile nm = go.GetComponent<NuclearMissile>();
        if (hm != null) hm.Launch(target, kind);
        if (nm != null) nm.Launch(target);
    }

    // ── Nearest target search ─────────────────────────────────────────────────
    private TargetBase FindNearestTarget(float maxRange)
    {
        TargetBase best     = null;
        float      bestDist = maxRange * maxRange;
        Vector3    myPos    = transform.position;

        foreach (TargetBase tb in TargetBase.AllTargets)
        {
            if (tb == null || tb.IsDead) continue;
            float d2 = (tb.transform.position - myPos).sqrMagnitude;
            if (d2 < bestDist)
            {
                bestDist = d2;
                best     = tb;
            }
        }
        return best;
    }

    // ── Public bullet spawner (for enemy AA guns) ─────────────────────────────
    /// Spawns an enemy bullet from the given world position and direction.
    public static void SpawnEnemyBullet(Vector3 origin, Vector3 direction)
    {
        // Enemy bullets are not pooled in this implementation; they self-destruct quickly
        WeaponSystem ws = FindFirstObjectByType<WeaponSystem>();
        if (ws == null || ws.BulletPrefab == null) return;
        GameObject go = Instantiate(ws.BulletPrefab, origin, Quaternion.LookRotation(direction));
        Bullet b = go.GetComponent<Bullet>();
        if (b != null) b.Launch(origin, direction, isEnemy: true);
    }
}
