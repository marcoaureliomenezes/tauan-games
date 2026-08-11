# Cel-Shader Calibration Log

**Shader:** `shaders/cel_screen_space.gdshader`
**Scene:** `scenes/CelShaderPass.tscn` (CanvasLayer layer=10, fullscreen ColorRect)
**Status:** PROVISIONAL — calibration sessions pending (see protocol below)
**FR reference:** FR-V2-G-11, AC-V2-G-14
**NFR reference:** NFR-V2-G-01 (cost budget: ≤ 0.8 ms @ 1080p on Iris Xe G7 80EU)

---

## Initial (Provisional) Parameter Values

| Parameter | Uniform name | Initial value | Range | Notes |
|---|---|---:|---|---|
| Diffuse bands | `bands` | 3.0 | 2.0 – 8.0 | Shadow / midtone / highlight — 3 bands matches FR-V2-G-11 default |
| Depth-edge threshold | `depth_edge_thresh` | 0.04 | 0.001 – 0.5 | Sobel depth magnitude above which a pixel becomes an outline |
| Normal-edge threshold | `normal_edge_thresh` | 0.55 | 0.05 – 1.0 | Sobel normal-delta magnitude above which a pixel becomes an outline |
| Saturation lift | `saturation_lift` | 1.15 | 0.5 – 2.0 | ×1.15 saturation applied after quantisation, per FR-V2-G-11 |
| Outline colour | `outline_color` | (0.05, 0.05, 0.05) | — | Near-black; slightly lifted to avoid pure black crush |

---

## Calibration Protocol

Run at least 3 PIE smoke captures at distinct flight poses on the Iris Xe G7 80EU
hardware target (1920×1080 native, Forward+ renderer, MSAA 2×). For each session:

1. Open the project in the Godot editor.
2. Enable Godot's built-in GPU profiler: **Debug → Monitor → GPU Time** (or use the
   **Profiler** tab in the debugger).
3. Run PIE (Play In Editor) at 1080p.
4. Fly to each of the three reference poses:
   - **Pose A — Low cruise:** ~200 m AGL above Inhaúma downtown grid, heading north.
   - **Pose B — Banking turn:** 60° roll left at ~500 m AGL, AA cluster in frame.
   - **Pose C — Post-stall recovery:** nose 30° below horizon, speed near `MIN_SPD = 8 m/s`.
5. Capture a screenshot via **Debug → Take Screenshot** or via `Viewport.get_texture().get_image()`.
6. Note visual quality judgement (outline fidelity, banding naturalness, colour saturation).
7. Read GPU time for the `CelPass` ColorRect draw call from the Profiler.

Record results in the table below. After ≥ 3 sessions, lock final values by editing the
`ShaderMaterial` parameters in `scenes/CelShaderPass.tscn`.

### Calibration Sessions

| Session | Date | Pose | bands | depth_thresh | normal_thresh | sat_lift | GPU time (ms) | Visual notes |
|---|---|---|---:|---:|---:|---:|---:|---|
| — | — | — | — | — | — | — | — | PROVISIONAL — sessions pending |

---

## Performance Fallback Ladder

If the measured GPU time exceeds the 0.8 ms budget, apply these reductions in order:

1. **Drop `bands` to 2.0** — halves colour-gradient sampling; slight visual regression
   (harder shadow/highlight boundary).
2. **Skip the normal-edge term** — set `normal_edge_thresh = 9999.0` (effectively disabled);
   outlines become depth-only; less crisp on curved surfaces but cheaper.
3. **Reduce `textureSize` sampling** — replace `textureSize(screen_tex, 0)` with a
   fixed `vec2(1920.0, 1080.0)` constant to save one texture query per fragment.
4. **Lower internal render resolution** to 1600×900 and re-test; if budget met at 900p,
   document as Gate-3 fallback per NFR-V2-G-04.

---

## Verification Deferred

Formal ≤ 0.8 ms verification is wired into **Wave 5 T-G-09** (perf harness). Until that
wave is complete, use operator's manual Godot Profiler readings as a directional guide.

AC-V2-G-14 acceptance: "Sample screenshot: assert black pixels along Sobel-edge regions;
cost ≤ 0.8 ms on Iris Xe @ 1080p." — manual + Godot profiler.
