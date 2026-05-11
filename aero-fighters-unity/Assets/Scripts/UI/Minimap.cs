// Minimap.cs — Top-down radar minimap rendered to a RawImage via RenderTexture.
// Shows player (green dot), targets (red dots), and islands (grey blobs).

using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class Minimap : MonoBehaviour
{
    [Header("Minimap Camera")]
    public Camera MinimapCamera;  // orthographic, looking straight down

    [Header("Display")]
    public RawImage MinimapDisplay;
    public int TextureSize = 256;

    [Header("Range")]
    [Tooltip("World units shown in minimap radius")]
    public float Range = 1500f;

    private RenderTexture _rt;

    // Dot markers pooled as UI Images
    [Header("Dot Prefabs")]
    public Image PlayerDotPrefab;
    public Image TargetDotPrefab;

    private Image _playerDot;
    private readonly List<Image> _targetDots = new();

    private void Start()
    {
        SetupRenderTexture();
        if (PlayerDotPrefab != null)
        {
            _playerDot = Instantiate(PlayerDotPrefab, transform);
            _playerDot.color = Color.green;
        }
    }

    private void SetupRenderTexture()
    {
        _rt = new RenderTexture(TextureSize, TextureSize, 16);
        if (MinimapCamera  != null) MinimapCamera.targetTexture = _rt;
        if (MinimapDisplay != null) MinimapDisplay.texture      = _rt;
    }

    private void LateUpdate()
    {
        if (MinimapCamera == null) return;

        FlightController fc = FindFirstObjectByType<FlightController>();
        if (fc == null) return;

        Vector3 playerPos = fc.WorldPosition;

        // Center minimap camera above player
        MinimapCamera.transform.position    = playerPos + Vector3.up * 2000f;
        MinimapCamera.transform.rotation    = Quaternion.Euler(90f, 0f, 0f);
        MinimapCamera.orthographicSize      = Range;
        MinimapCamera.orthographic          = true;
        MinimapCamera.farClipPlane          = 3000f;

        UpdateDots(playerPos);
    }

    private void UpdateDots(Vector3 playerPos)
    {
        if (MinimapDisplay == null) return;
        Rect displayRect = MinimapDisplay.rectTransform.rect;

        // Update player dot (center of minimap)
        if (_playerDot != null)
        {
            _playerDot.rectTransform.anchoredPosition = Vector2.zero;
        }

        // Update target dots
        var targets = TargetBase.AllTargets;

        // Expand or shrink pool
        while (_targetDots.Count < targets.Count)
        {
            if (TargetDotPrefab == null) break;
            Image dot = Instantiate(TargetDotPrefab, transform);
            dot.color = Color.red;
            _targetDots.Add(dot);
        }
        for (int i = 0; i < _targetDots.Count; i++)
        {
            bool active = i < targets.Count && targets[i] != null && !targets[i].IsDead;
            _targetDots[i].gameObject.SetActive(active);
            if (!active) continue;

            Vector3 diff = targets[i].transform.position - playerPos;
            float nx = diff.x / Range;
            float nz = diff.z / Range;

            // Clamp to minimap circle
            float mag = Mathf.Sqrt(nx * nx + nz * nz);
            if (mag > 1f) { nx /= mag; nz /= mag; }

            float px = nx * displayRect.width  * 0.5f;
            float py = nz * displayRect.height * 0.5f;
            _targetDots[i].rectTransform.anchoredPosition = new Vector2(px, py);
        }
    }

    private void OnDestroy()
    {
        if (_rt != null) _rt.Release();
    }
}
