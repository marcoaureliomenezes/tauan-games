// NuclearMissile.cs — Standalone nuclear missile wrapper.
// Re-uses HomingMissile with MissileKind.Nuclear.
// Attach this alongside HomingMissile so MissionManager can spawn via prefab.

using UnityEngine;

[RequireComponent(typeof(HomingMissile))]
public class NuclearMissile : MonoBehaviour
{
    private HomingMissile _homing;

    private void Awake()
    {
        _homing = GetComponent<HomingMissile>();
    }

    /// Called by WeaponSystem after Instantiate.
    public void Launch(TargetBase target)
    {
        _homing.Launch(target, MissileKind.Nuclear);
    }
}
