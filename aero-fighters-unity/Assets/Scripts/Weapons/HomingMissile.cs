// HomingMissile.cs — Homing missile that tracks the nearest live target.
// Ported from the missile system in projectiles.js (Three.js reference).

using UnityEngine;

public enum MissileKind { Light, Heavy, Nuclear }

public class HomingMissile : MonoBehaviour
{
    private TargetBase _target;
    private MissileKind _kind;

    private float _speed;
    private float _trackingSpeed;
    private float _turnRate;
    private float _closeTurnRate;
    private float _lifeTime;
    private int   _damage;

    private bool _launched = false;

    // ── Cached constants per kind ─────────────────────────────────────────────
    private static float GetInitialSpeed(MissileKind k) => k switch
    {
        MissileKind.Heavy   => GameConfig.MISSILE_HEAVY_INITIAL_SPD,
        MissileKind.Nuclear => GameConfig.MISSILE_NUCLEAR_INITIAL_SPD,
        _                   => GameConfig.MISSILE_LIGHT_INITIAL_SPD,
    };
    private static float GetTrackingSpeed(MissileKind k) => k switch
    {
        MissileKind.Heavy   => GameConfig.MISSILE_HEAVY_TRACKING_SPD,
        MissileKind.Nuclear => GameConfig.MISSILE_NUCLEAR_TRACKING_SPD,
        _                   => GameConfig.MISSILE_LIGHT_TRACKING_SPD,
    };
    private static float GetTurnRate(MissileKind k) => k switch
    {
        MissileKind.Heavy   => GameConfig.MISSILE_HEAVY_TURN_RATE,
        MissileKind.Nuclear => GameConfig.MISSILE_NUCLEAR_TURN_RATE,
        _                   => GameConfig.MISSILE_LIGHT_TURN_RATE,
    };
    private static float GetCloseTurnRate(MissileKind k) => k switch
    {
        MissileKind.Heavy   => GameConfig.MISSILE_HEAVY_CLOSE_RATE,
        MissileKind.Nuclear => GameConfig.MISSILE_NUCLEAR_CLOSE_RATE,
        _                   => GameConfig.MISSILE_LIGHT_CLOSE_RATE,
    };
    private static float GetLifetime(MissileKind k) => k switch
    {
        MissileKind.Heavy   => GameConfig.MISSILE_HEAVY_LIFE,
        MissileKind.Nuclear => GameConfig.MISSILE_NUCLEAR_LIFE,
        _                   => GameConfig.MISSILE_LIGHT_LIFE,
    };
    private static int GetDamage(MissileKind k) => k switch
    {
        MissileKind.Heavy   => GameConfig.MISSILE_HEAVY_DAMAGE,
        MissileKind.Nuclear => GameConfig.MISSILE_NUCLEAR_DAMAGE,
        _                   => GameConfig.MISSILE_LIGHT_DAMAGE,
    };

    // ── Launch ────────────────────────────────────────────────────────────────
    public void Launch(TargetBase target, MissileKind kind)
    {
        _target       = target;
        _kind         = kind;
        _speed        = GetInitialSpeed(kind);
        _trackingSpeed = GetTrackingSpeed(kind);
        _turnRate     = GetTurnRate(kind);
        _closeTurnRate = GetCloseTurnRate(kind);
        _lifeTime     = GetLifetime(kind);
        _damage       = GetDamage(kind);
        _launched     = true;
    }

    // ── Update ────────────────────────────────────────────────────────────────
    private void Update()
    {
        if (!_launched) return;

        float dt  = Time.deltaTime;
        _lifeTime -= dt;

        if (_lifeTime <= 0f)
        {
            Destroy(gameObject);
            return;
        }

        // Accelerate toward tracking speed
        _speed = Mathf.MoveTowards(_speed, _trackingSpeed, dt * 30f);

        // Homing toward target
        if (_target != null && !_target.IsDead)
        {
            Vector3 toTarget = (_target.transform.position - transform.position);
            float   dist     = toTarget.magnitude;

            // Use aggressive close-range turn when within 40m
            float rate = dist < 40f ? _closeTurnRate : _turnRate;

            // Rotate forward toward target direction (rad/s → deg/s)
            Vector3 desiredDir  = toTarget.normalized;
            Vector3 currentDir  = transform.forward;
            Vector3 newDir      = Vector3.RotateTowards(currentDir, desiredDir, rate * dt, 0f);
            transform.rotation  = Quaternion.LookRotation(newDir);

            // Check proximity hit (within 4m of target center)
            if (dist < 4f)
            {
                Explode();
                return;
            }
        }

        // Move forward
        transform.position += transform.forward * _speed * dt;

        // Smoke trail FX
        SpawnSmokeParticle();
    }

    private void SpawnSmokeParticle()
    {
        // Delegate to ExplosionSystem if present; lightweight approach
        var fx = FindFirstObjectByType<ExplosionSystem>();
        if (fx != null) fx.SpawnMissileSmoke(transform.position);
    }

    private void Explode()
    {
        if (_kind == MissileKind.Nuclear)
        {
            NuclearBlast();
        }
        else
        {
            // Normal explosion: damage single target
            if (_target != null && !_target.IsDead)
                _target.TakeDamage(_damage);

            var fx = FindFirstObjectByType<ExplosionSystem>();
            if (fx != null) fx.SpawnExplosion(transform.position, ExplosionSize.Medium);
        }
        Destroy(gameObject);
    }

    private void NuclearBlast()
    {
        // Damage all targets within blast radius
        foreach (TargetBase tb in TargetBase.AllTargets)
        {
            if (tb == null || tb.IsDead) continue;
            float dist = Vector3.Distance(transform.position, tb.transform.position);
            if (dist <= GameConfig.NUCLEAR_BLAST_RADIUS)
                tb.TakeDamage(_damage);
        }

        // Damage player if within kill or damage radius
        Vector3 playerPos = GameState.Instance != null
            ? FindFirstObjectByType<FlightController>()?.WorldPosition ?? transform.position
            : transform.position;

        float playerDist = Vector3.Distance(transform.position, playerPos);
        if (playerDist <= GameConfig.NUCLEAR_PLAYER_KILL_RADIUS)
        {
            // Instant kill
            GameState.Instance.Lives = 0;
            MissionManager.Instance?.GameOver("AERONAVE DESTRUIDA\nEXPLOSAO NUCLEAR");
        }
        else if (playerDist <= GameConfig.NUCLEAR_PLAYER_DMG_RADIUS)
        {
            GameState.Instance.Lives -= 1;
            if (GameState.Instance.Lives <= 0)
                MissionManager.Instance?.GameOver("AERONAVE DESTRUIDA\nEXPLOSAO NUCLEAR");
            else
                MissionManager.Instance?.RestartRound();
        }

        var fx = FindFirstObjectByType<ExplosionSystem>();
        if (fx != null) fx.SpawnNuclearExplosion(transform.position);
    }

    private void OnTriggerEnter(Collider other)
    {
        TargetBase tb = other.GetComponentInParent<TargetBase>();
        if (tb != null && !tb.IsDead && _launched)
        {
            _target = tb;
            Explode();
        }
    }
}
