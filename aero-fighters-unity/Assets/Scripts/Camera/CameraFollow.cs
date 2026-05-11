// CameraFollow.cs — Smooth camera that follows the player jet.
// Offset 10 units behind, 5.5 above in local space (same tuning as Three.js camera rig).
// Uses SmoothDamp for lag-free but damped following.

using UnityEngine;

public class CameraFollow : MonoBehaviour
{
    [Header("Target")]
    public Transform Target;

    [Header("Offset")]
    [Tooltip("Behind the plane in local space")]
    public float BehindOffset = 10f;
    [Tooltip("Above the plane in local space")]
    public float AboveOffset  = 5.5f;
    [Tooltip("Look-ahead: how many units in front of target to look at")]
    public float LookAheadDist = 30f;

    [Header("Damping")]
    public float SmoothTime = 0.1f;

    // ── Camera shake ───────────────────────────────────────────────────────────
    private float _shakeIntensity = 8f;
    private float _shakeDuration  = 0f;

    private Vector3 _velocity = Vector3.zero;

    private void LateUpdate()
    {
        if (Target == null) return;

        // Desired position: behind and above in target's local space
        Vector3 desiredPos = Target.position
            + Target.up      * AboveOffset
            + Target.forward * (-BehindOffset);  // Unity: -forward = behind

        // Camera shake (driven by GameState.ShakeTime)
        Vector3 shakeOffset = Vector3.zero;
        if (GameState.Instance != null && GameState.Instance.ShakeTime > 0f)
        {
            float mag    = GameState.Instance.ShakeTime * _shakeIntensity;
            shakeOffset  = new Vector3(
                Random.Range(-mag, mag),
                Random.Range(-mag, mag),
                0f);
        }

        transform.position = Vector3.SmoothDamp(
            transform.position,
            desiredPos + shakeOffset,
            ref _velocity,
            SmoothTime);

        // Look-at point: slightly in front of target
        Vector3 lookTarget = Target.position
            + Target.up      * AboveOffset
            + Target.forward * LookAheadDist;
        transform.LookAt(lookTarget);
    }

    public void SetTarget(Transform t) => Target = t;
}
