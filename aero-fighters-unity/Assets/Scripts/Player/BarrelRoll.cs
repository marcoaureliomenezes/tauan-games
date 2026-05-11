// BarrelRoll.cs — Visual and invincibility effects during barrel roll.
// GameState tracks RollTimer; this component adds visual trail and invincibility flash.

using UnityEngine;

public class BarrelRoll : MonoBehaviour
{
    [Header("Visual")]
    [Tooltip("Optional trail renderer on the wingtips for roll effect")]
    public TrailRenderer LeftWingTrail;
    public TrailRenderer RightWingTrail;

    private bool _wasRolling = false;

    private void Update()
    {
        bool rolling = GameState.Instance.RollTimer > 0f;

        if (rolling && !_wasRolling)
            OnRollStart();
        else if (!rolling && _wasRolling)
            OnRollEnd();

        _wasRolling = rolling;

        // Pulse alpha on wing trails to show invincibility
        if (rolling)
        {
            float alpha = 0.5f + 0.5f * Mathf.Sin(Time.time * 30f);
            SetTrailAlpha(alpha);
        }
    }

    private void OnRollStart()
    {
        if (LeftWingTrail  != null) LeftWingTrail.enabled  = true;
        if (RightWingTrail != null) RightWingTrail.enabled = true;
    }

    private void OnRollEnd()
    {
        if (LeftWingTrail  != null) LeftWingTrail.enabled  = false;
        if (RightWingTrail != null) RightWingTrail.enabled = false;
    }

    private void SetTrailAlpha(float alpha)
    {
        if (LeftWingTrail != null)
        {
            Color c = LeftWingTrail.startColor;
            c.a = alpha;
            LeftWingTrail.startColor = c;
            LeftWingTrail.endColor   = new Color(c.r, c.g, c.b, 0f);
        }
        if (RightWingTrail != null)
        {
            Color c = RightWingTrail.startColor;
            c.a = alpha;
            RightWingTrail.startColor = c;
            RightWingTrail.endColor   = new Color(c.r, c.g, c.b, 0f);
        }
    }
}
