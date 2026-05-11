// HUD.cs — In-game heads-up display using TextMeshPro.
// All labels updated each frame from GameState; no caching needed at 60fps.

using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class HUD : MonoBehaviour
{
    [Header("Flight Instruments")]
    public TextMeshProUGUI SpeedLabel;
    public TextMeshProUGUI AltitudeLabel;
    public TextMeshProUGUI ThrottleLabel;

    [Header("Combat")]
    public TextMeshProUGUI ScoreLabel;
    public TextMeshProUGUI LivesLabel;
    public TextMeshProUGUI LightMissilesLabel;
    public TextMeshProUGUI HeavyMissilesLabel;
    public TextMeshProUGUI NuclearMissilesLabel;

    [Header("Warnings")]
    public GameObject StallWarning;
    public GameObject InvincibleIndicator;

    [Header("Mission")]
    public TextMeshProUGUI MissionLabel;
    public TextMeshProUGUI TargetsLabel;

    [Header("Overlay Panel")]
    public GameObject     OverlayPanel;
    public TextMeshProUGUI OverlayTitle;
    public TextMeshProUGUI OverlayBody;

    [Header("Pause")]
    public GameObject PausePanel;

    [Header("Minimap")]
    public Minimap MinimapComponent;

    // ── Overlay timer ──────────────────────────────────────────────────────────
    private float _overlayTimer = 0f;

    private void Update()
    {
        var gs = GameState.Instance;
        if (gs == null) return;

        UpdateFlightInstruments(gs);
        UpdateCombat(gs);
        UpdateWarnings(gs);
        UpdateMission(gs);
        TickOverlay();
        UpdatePause(gs);
    }

    private void UpdateFlightInstruments(GameState gs)
    {
        FlightController fc = FindFirstObjectByType<FlightController>();

        if (SpeedLabel   != null)
            SpeedLabel.text   = $"SPD {gs.Speed:000} m/s";

        float alt = fc != null ? fc.WorldPosition.y : 0f;
        if (AltitudeLabel != null)
            AltitudeLabel.text = $"ALT {alt:0000} m";

        if (ThrottleLabel != null)
            ThrottleLabel.text = $"THR {Mathf.RoundToInt(gs.Throttle * 100f):000}%";
    }

    private void UpdateCombat(GameState gs)
    {
        if (ScoreLabel          != null) ScoreLabel.text          = $"SCORE {gs.Score:000000}";
        if (LivesLabel          != null) LivesLabel.text          = $"LIVES {gs.Lives}";
        if (LightMissilesLabel  != null) LightMissilesLabel.text  = $"MIS {gs.LightMissiles:000}";
        if (HeavyMissilesLabel  != null) HeavyMissilesLabel.text  = $"HVY {gs.HeavyMissiles:00}";
        if (NuclearMissilesLabel != null) NuclearMissilesLabel.text = $"NUC {gs.NuclearMissiles}";
    }

    private void UpdateWarnings(GameState gs)
    {
        if (StallWarning != null)
        {
            // Pulsing blink: visible for 0.3s, hidden for 0.2s
            bool blink = gs.Stalled && (Mathf.Sin(Time.time * 10f) > 0f);
            StallWarning.SetActive(blink);
        }

        if (InvincibleIndicator != null)
            InvincibleIndicator.SetActive(gs.IsInvincible);
    }

    private void UpdateMission(GameState gs)
    {
        if (MissionLabel != null)
            MissionLabel.text = $"MISSAO {gs.MissionCycle}";

        if (TargetsLabel != null)
        {
            int remaining = gs.TargetsTotal - gs.TargetsDestroyed;
            TargetsLabel.text = $"ALVOS {remaining:00}/{gs.TargetsTotal:00}";
        }
    }

    private void TickOverlay()
    {
        if (_overlayTimer > 0f)
        {
            _overlayTimer -= Time.deltaTime;
            if (_overlayTimer <= 0f)
                HideOverlay();
        }
    }

    private void UpdatePause(GameState gs)
    {
        if (PausePanel != null)
            PausePanel.SetActive(gs.Paused);
    }

    // ── Overlay API ───────────────────────────────────────────────────────────

    /// Show a centered overlay (title + body). duration=0 means show indefinitely.
    public void ShowOverlay(string title, string body, float duration)
    {
        if (OverlayPanel != null)
        {
            OverlayPanel.SetActive(true);
            if (OverlayTitle != null) OverlayTitle.text = title;
            if (OverlayBody  != null) OverlayBody.text  = body;
        }
        _overlayTimer = duration > 0f ? duration : 0f;
    }

    public void HideOverlay()
    {
        if (OverlayPanel != null)
            OverlayPanel.SetActive(false);
        _overlayTimer = 0f;
    }
}
