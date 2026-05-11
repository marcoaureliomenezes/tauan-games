// TargetBase.cs — Base class for all destroyable targets.
// Concrete types override OnKilled for type-specific VFX (mega-explosion, shockwave, etc.)

using System.Collections.Generic;
using UnityEngine;

public enum TargetType { Base, Factory, Building, Convoy, AAGun, Warship }

public abstract class TargetBase : MonoBehaviour
{
    // ── Global registry so HomingMissile can find nearest target ─────────────
    public static readonly List<TargetBase> AllTargets = new();

    // ── Stats ─────────────────────────────────────────────────────────────────
    [HideInInspector] public TargetType Type;
    [HideInInspector] public int        MaxHP;
    [HideInInspector] public int        ScoreValue;
    [HideInInspector] public float      DropChance;

    protected int _hp;
    public bool IsDead => _hp <= 0;

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    protected virtual void Awake()
    {
        AllTargets.Add(this);
    }

    protected virtual void OnDestroy()
    {
        AllTargets.Remove(this);
    }

    /// Called by MissionManager after Instantiate to configure stats for this mission.
    public virtual void InitStats(TargetType type, int hpBonus, int missionNum)
    {
        Type = type;
        (int baseHP, int score, float drop) = type switch
        {
            TargetType.Base     => (GameConfig.BASE_HP,     GameConfig.BASE_SCORE,     GameConfig.BASE_DROP),
            TargetType.Factory  => (GameConfig.FACTORY_HP,  GameConfig.FACTORY_SCORE,  GameConfig.FACTORY_DROP),
            TargetType.Building => (GameConfig.BUILDING_HP, GameConfig.BUILDING_SCORE, GameConfig.BUILDING_DROP),
            TargetType.Convoy   => (GameConfig.CONVOY_HP,   GameConfig.CONVOY_SCORE,   GameConfig.CONVOY_DROP),
            TargetType.AAGun    => (GameConfig.AAGUN_HP,    GameConfig.AAGUN_SCORE,    GameConfig.AAGUN_DROP),
            TargetType.Warship  => (GameConfig.WARSHIP_HP,  GameConfig.WARSHIP_SCORE,  GameConfig.WARSHIP_DROP),
            _                   => (10, 100, 0f),
        };
        MaxHP      = baseHP + hpBonus;
        ScoreValue = score;
        DropChance = drop;
        _hp        = MaxHP;
    }

    // ── Damage ────────────────────────────────────────────────────────────────
    public virtual void TakeDamage(int dmg)
    {
        if (IsDead) return;
        _hp -= dmg;
        if (_hp <= 0) Kill();
    }

    protected void Kill()
    {
        if (IsDead && _hp <= -9999) return; // double-kill guard
        _hp = -9999;  // sentinel — prevents re-entry
        OnKilled();
        GameState.Instance?.OnTargetKilled(this);
        // Small delay so explosion FX can play
        Destroy(gameObject, 0.15f);
    }

    private static ExplosionSystem _fxSingleton;

    protected virtual void OnKilled()
    {
        // Subclasses spawn type-appropriate explosion here
        if (_fxSingleton == null) _fxSingleton = FindFirstObjectByType<ExplosionSystem>();
        if (_fxSingleton != null) _fxSingleton.SpawnExplosion(transform.position, ExplosionSize.Small);
    }
}
