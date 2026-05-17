#!/usr/bin/env python3
# REWRITE PENDING — see aero-fighters-v2-stylized-inhauma-v1/TASKS.md T-S-08
# (Algorithm survives unchanged; baselines rewrite for cel-shaded poses + thresholds tighten to AC-V2-S-19)
"""Screenshot-diff harness for aero-fighters-v2 (AC-V2-18, FR-V2-14).

Captures screenshots at 4 fixed WGS84 reference poses inside a Shipping build,
compares against per-platform baselines using SSIM (skimage.metrics) and pHash
(imagehash). Gate: per-cam SSIM >= 0.72, mean >= 0.78, pHash distance <= 20.

UE5 launch + screenshot trigger is the ONLY stub -- Wave 5's game-developer
implements the actual launch glue once UE 5.5 is installed.

Requirements (see requirements.txt next to this file):
    pip install scikit-image imagehash Pillow numpy
"""

import argparse
import datetime
import os
import sys
import tempfile

# ---------------------------------------------------------------------------
# Dependency check -- graceful exit with install instructions
# ---------------------------------------------------------------------------
_MISSING_DEPS = []

try:
    import numpy as np
except ImportError:
    _MISSING_DEPS.append("numpy")

try:
    from skimage.metrics import structural_similarity as _ssim_fn
except ImportError:
    _MISSING_DEPS.append("scikit-image")
    _ssim_fn = None

try:
    import imagehash as _imagehash
except ImportError:
    _MISSING_DEPS.append("imagehash")
    _imagehash = None

try:
    from PIL import Image
except ImportError:
    _MISSING_DEPS.append("Pillow")
    Image = None


def _check_deps():
    """Exit with code 2 and install instructions if required packages are absent."""
    if _MISSING_DEPS:
        print(
            "[screenshot-diff-harness] Missing required packages: "
            + ", ".join(_MISSING_DEPS)
        )
        print(
            "Install them with:  pip install -r "
            + os.path.join(os.path.dirname(__file__), "requirements.txt")
        )
        sys.exit(2)


# ---------------------------------------------------------------------------
# Reference poses (WGS84: lat, lon, ellipsoidal_height_m, look_direction_deg)
# ---------------------------------------------------------------------------
REFERENCE_POSES = [
    {
        "id": "Pose_01",
        "lat": -19.470,
        "lon": -44.460,
        "height_m": 2095.0,
        "look_deg": 0.0,
        "description": "Origin anchor, north-looking",
    },
    {
        "id": "Pose_02",
        "lat": -19.470,
        "lon": -44.460,
        "height_m": 2095.0,
        "look_deg": 90.0,
        "description": "Origin anchor, east-looking",
    },
    {
        "id": "Pose_03",
        "lat": -19.490,
        "lon": -44.387,
        "height_m": 1200.0,
        "look_deg": 270.0,
        "description": "AA gun vicinity, west-looking",
    },
    {
        "id": "Pose_04",
        "lat": -19.450,
        "lon": -44.480,
        "height_m": 1600.0,
        "look_deg": 180.0,
        "description": "Northern approach, south-looking",
    },
]

# ---------------------------------------------------------------------------
# Thresholds (provisional per FR-V2-14; empirically tuned in PLAN Wave 5)
# ---------------------------------------------------------------------------
SSIM_PER_CAM_MIN = 0.72
SSIM_MEAN_MIN = 0.78
PHASH_DIST_MAX = 20


# ---------------------------------------------------------------------------
# Stub: UE5 launch + capture
# ---------------------------------------------------------------------------
def launch_shipping_build_and_capture(platform: str, pose: dict) -> bytes:
    """Launch the Shipping build, navigate to pose, capture screenshot.

    STUB -- raises NotImplementedError until Wave 5 implements the actual
    launch glue once UE 5.5 is installed on the operator machine.

    Args:
        platform: One of "windows" or "linux".
        pose: Dict from REFERENCE_POSES with keys id, lat, lon, height_m,
              look_deg.

    Returns:
        PNG bytes of the captured screenshot.

    Raises:
        NotImplementedError: Always, until Wave 5 fills this in.
    """
    raise NotImplementedError(
        "[screenshot-diff-harness] launch_shipping_build_and_capture() is a stub.\n"
        "Wave 5 (game-developer) implements the actual UE5 launch glue once\n"
        "UE 5.5 is installed.  Platform requested: {platform}, pose: {pose_id}.\n"
        "See SPEC §FR-V2-14 and TASKS T-008 for context.".format(
            platform=platform, pose_id=pose["id"]
        )
    )


# ---------------------------------------------------------------------------
# Core SSIM + pHash functions (fully implemented)
# ---------------------------------------------------------------------------
def compute_ssim(img_a_path: str, img_b_path: str) -> float:
    """Compute SSIM between two image files.

    Args:
        img_a_path: Absolute path to reference image (PNG).
        img_b_path: Absolute path to captured image (PNG).

    Returns:
        SSIM float in [0, 1]. 1.0 = identical.
    """
    _check_deps()
    img_a = np.array(Image.open(img_a_path).convert("RGB"))
    img_b = np.array(Image.open(img_b_path).convert("RGB"))

    # Resize img_b to match img_a dimensions if needed
    if img_a.shape != img_b.shape:
        pil_b = Image.open(img_b_path).convert("RGB").resize(
            (img_a.shape[1], img_a.shape[0]), Image.LANCZOS
        )
        img_b = np.array(pil_b)

    score = _ssim_fn(img_a, img_b, channel_axis=2, data_range=255)
    return float(score)


def compute_phash_distance(img_a_path: str, img_b_path: str) -> int:
    """Compute perceptual hash Hamming distance between two image files.

    Args:
        img_a_path: Absolute path to reference image (PNG).
        img_b_path: Absolute path to captured image (PNG).

    Returns:
        Hamming distance (int). 0 = identical hash; <= 20 is the passing gate.
    """
    _check_deps()
    hash_a = _imagehash.phash(Image.open(img_a_path))
    hash_b = _imagehash.phash(Image.open(img_b_path))
    return int(hash_a - hash_b)


def score_pair(reference_path: str, captured_path: str, thresholds: dict) -> dict:
    """Score a reference/captured image pair against configured thresholds.

    Args:
        reference_path: Path to committed baseline PNG.
        captured_path: Path to newly captured PNG.
        thresholds: Dict with keys ssim_per_cam_min (float) and
                    phash_dist_max (int).

    Returns:
        Dict with keys: ssim (float), phash_dist (int), pass (bool),
        ssim_pass (bool), phash_pass (bool).
    """
    ssim_val = compute_ssim(reference_path, captured_path)
    phash_val = compute_phash_distance(reference_path, captured_path)
    ssim_ok = ssim_val >= thresholds["ssim_per_cam_min"]
    phash_ok = phash_val <= thresholds["phash_dist_max"]
    return {
        "ssim": ssim_val,
        "phash_dist": phash_val,
        "ssim_pass": ssim_ok,
        "phash_pass": phash_ok,
        "pass": ssim_ok and phash_ok,
    }


def aggregate_results(per_pose_results: list) -> dict:
    """Aggregate per-pose score dicts and enforce the mean SSIM gate.

    Args:
        per_pose_results: List of dicts returned by score_pair(), one per pose.

    Returns:
        Dict with keys: mean_ssim (float), mean_ssim_pass (bool),
        all_per_cam_pass (bool), overall_pass (bool),
        per_pose (list, the input unchanged).
    """
    mean_ssim = sum(r["ssim"] for r in per_pose_results) / len(per_pose_results)
    all_per_cam = all(r["pass"] for r in per_pose_results)
    mean_ok = mean_ssim >= SSIM_MEAN_MIN
    return {
        "mean_ssim": mean_ssim,
        "mean_ssim_pass": mean_ok,
        "all_per_cam_pass": all_per_cam,
        "overall_pass": all_per_cam and mean_ok,
        "per_pose": per_pose_results,
    }


# ---------------------------------------------------------------------------
# HTML report generator
# ---------------------------------------------------------------------------
def write_html_report(results: dict, output_path: str) -> None:
    """Write a side-by-side HTML report for the screenshot diff run.

    Args:
        results: Dict returned by aggregate_results(), augmented with
                 optional per-pose keys: pose_id (str), reference_path (str),
                 captured_path (str).
        output_path: Absolute path for the output HTML file.
    """
    ts = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    overall_color = "#2a7a2a" if results.get("overall_pass") else "#a82222"
    overall_label = "PASS" if results.get("overall_pass") else "FAIL"

    rows_html = ""
    for entry in results.get("per_pose", []):
        pose_id = entry.get("pose_id", "?")
        ssim_val = entry.get("ssim", 0.0)
        phash_val = entry.get("phash_dist", 999)
        row_ok = entry.get("pass", False)
        row_color = "#2a7a2a" if row_ok else "#a82222"
        row_label = "PASS" if row_ok else "FAIL"

        ref_path = entry.get("reference_path", "")
        cap_path = entry.get("captured_path", "")

        ref_img_tag = (
            '<img src="{}" style="max-width:320px;">'.format(ref_path)
            if ref_path
            else "(no reference image)"
        )
        cap_img_tag = (
            '<img src="{}" style="max-width:320px;">'.format(cap_path)
            if cap_path
            else "(no captured image)"
        )

        rows_html += """
        <tr>
            <td>{pose_id}</td>
            <td>{ref_img}</td>
            <td>{cap_img}</td>
            <td>{ssim:.4f} (gate &ge;{gate_ssim})</td>
            <td>{phash} (gate &le;{gate_phash})</td>
            <td style="color:{row_color}; font-weight:bold;">{row_label}</td>
        </tr>""".format(
            pose_id=pose_id,
            ref_img=ref_img_tag,
            cap_img=cap_img_tag,
            ssim=ssim_val,
            gate_ssim=SSIM_PER_CAM_MIN,
            phash=phash_val,
            gate_phash=PHASH_DIST_MAX,
            row_color=row_color,
            row_label=row_label,
        )

    mean_ssim = results.get("mean_ssim", 0.0)
    mean_color = "#2a7a2a" if results.get("mean_ssim_pass") else "#a82222"

    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>screenshot-diff report {ts}</title>
  <style>
    body {{ font-family: monospace; background: #111; color: #ddd; padding: 1em; }}
    h1 {{ color: {overall_color}; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #444; padding: 6px 10px; vertical-align: top; }}
    th {{ background: #222; }}
    img {{ display: block; border: 1px solid #555; }}
  </style>
</head>
<body>
<h1>Screenshot-Diff Report: <span style="color:{overall_color}">{overall_label}</span></h1>
<p>Generated: {ts}</p>
<p>Mean SSIM: <span style="color:{mean_color}">{mean_ssim:.4f}</span>
   (gate &ge;{gate_mean})</p>
<table>
  <thead>
    <tr>
      <th>Pose</th>
      <th>Reference</th>
      <th>Captured</th>
      <th>SSIM</th>
      <th>pHash dist</th>
      <th>Result</th>
    </tr>
  </thead>
  <tbody>
    {rows}
  </tbody>
</table>
</body>
</html>""".format(
        ts=ts,
        overall_color=overall_color,
        overall_label=overall_label,
        mean_color=mean_color,
        mean_ssim=mean_ssim,
        gate_mean=SSIM_MEAN_MIN,
        rows=rows_html,
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write(html)
    print("[screenshot-diff-harness] HTML report written to: {}".format(output_path))


# ---------------------------------------------------------------------------
# CLI modes
# ---------------------------------------------------------------------------
def _cmd_self_check(args) -> int:
    """Verify SSIM + pHash math against a synthetic identical-image pair."""
    _check_deps()
    print("[self-check] Generating synthetic 256x256 random-noise image pair...")
    with tempfile.TemporaryDirectory() as tmpdir:
        rng = np.random.default_rng(seed=42)
        noise = (rng.integers(0, 256, (256, 256, 3), dtype=np.uint8))
        img_a_path = os.path.join(tmpdir, "a.png")
        img_b_path = os.path.join(tmpdir, "b.png")
        Image.fromarray(noise).save(img_a_path)
        Image.fromarray(noise).save(img_b_path)

        ssim_val = compute_ssim(img_a_path, img_b_path)
        phash_val = compute_phash_distance(img_a_path, img_b_path)

        print("[self-check] SSIM (identical images) = {:.6f}".format(ssim_val))
        print("[self-check] pHash distance (identical images) = {}".format(phash_val))

        ok = True
        if ssim_val < 0.99:
            print("[self-check] FAIL: expected SSIM > 0.99, got {:.6f}".format(ssim_val))
            ok = False
        else:
            print("[self-check] PASS: SSIM > 0.99")

        if phash_val > 2:
            print("[self-check] FAIL: expected pHash distance <= 2, got {}".format(phash_val))
            ok = False
        else:
            print("[self-check] PASS: pHash distance <= 2")

    if ok:
        print("[self-check] All checks PASSED. Exit 0.")
        return 0
    else:
        print("[self-check] One or more checks FAILED. Exit 1.")
        return 1


def _cmd_list_poses(args) -> int:
    """Print the 4 hard-coded WGS84 reference poses."""
    print("Reference poses for aero-fighters-v2 screenshot-diff harness:")
    for pose in REFERENCE_POSES:
        print(
            "  {id}: lat={lat}, lon={lon}, height_m={height_m}, "
            "look_deg={look_deg}  -- {description}".format(**pose)
        )
    return 0


def _cmd_capture_baseline(args) -> int:
    """Invoke UE5 stub, capture 4 poses, write to Tests/Baselines/<platform>/."""
    _check_deps()
    platform = args.platform
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    baselines_dir = os.path.join(repo_root, "Tests", "Baselines", platform)
    os.makedirs(baselines_dir, exist_ok=True)

    print("[capture-baseline] Platform: {}".format(platform))
    for pose in REFERENCE_POSES:
        print("[capture-baseline] Capturing pose {} ...".format(pose["id"]))
        # This call raises NotImplementedError until Wave 5
        png_bytes = launch_shipping_build_and_capture(platform, pose)
        out_path = os.path.join(baselines_dir, "{}.png".format(pose["id"]))
        with open(out_path, "wb") as fh:
            fh.write(png_bytes)
        print("[capture-baseline] Saved: {}".format(out_path))

    print("[capture-baseline] Baselines written to: {}".format(baselines_dir))
    return 0


def _cmd_compare(args) -> int:
    """Capture 4 poses and compare against committed baselines; emit HTML report."""
    _check_deps()
    platform = args.platform
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    baselines_dir = os.path.join(repo_root, "Tests", "Baselines", platform)

    thresholds = {
        "ssim_per_cam_min": SSIM_PER_CAM_MIN,
        "phash_dist_max": PHASH_DIST_MAX,
    }

    per_pose_results = []
    with tempfile.TemporaryDirectory() as tmpdir:
        for pose in REFERENCE_POSES:
            ref_path = os.path.join(baselines_dir, "{}.png".format(pose["id"]))
            if not os.path.isfile(ref_path):
                print(
                    "[compare] ERROR: baseline not found for pose {}: {}".format(
                        pose["id"], ref_path
                    )
                )
                return 1

            print("[compare] Capturing pose {} ...".format(pose["id"]))
            # Raises NotImplementedError until Wave 5
            png_bytes = launch_shipping_build_and_capture(platform, pose)
            cap_path = os.path.join(tmpdir, "{}.png".format(pose["id"]))
            with open(cap_path, "wb") as fh:
                fh.write(png_bytes)

            result = score_pair(ref_path, cap_path, thresholds)
            result["pose_id"] = pose["id"]
            result["reference_path"] = ref_path
            result["captured_path"] = cap_path
            per_pose_results.append(result)

        aggregated = aggregate_results(per_pose_results)

        ts = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H%M%SZ")
        results_dir = os.path.join(repo_root, "Tests", "results")
        report_path = os.path.join(
            results_dir, "screenshot-diff-{}.html".format(ts)
        )
        write_html_report(aggregated, report_path)

    if not aggregated["overall_pass"]:
        print(
            "[compare] FAIL: threshold breach. Mean SSIM={:.4f} (gate>={:.2f}). "
            "See report: {}".format(
                aggregated["mean_ssim"], SSIM_MEAN_MIN, report_path
            )
        )
        return 1

    print(
        "[compare] PASS: Mean SSIM={:.4f}. Report: {}".format(
            aggregated["mean_ssim"], report_path
        )
    )
    return 0


# ---------------------------------------------------------------------------
# Argparse
# ---------------------------------------------------------------------------
def parse_args(argv=None):
    """Build and return the argument parser for the harness."""
    parser = argparse.ArgumentParser(
        prog="screenshot-diff-harness",
        description=(
            "Screenshot-diff harness for aero-fighters-v2 (AC-V2-18, FR-V2-14). "
            "Compares Shipping build captures against per-platform baselines "
            "using SSIM + pHash."
        ),
    )

    parser.add_argument(
        "--self-check",
        action="store_true",
        help=(
            "Verify SSIM + pHash math against a synthetic identical-image pair. "
            "Exit 0 on success."
        ),
    )
    parser.add_argument(
        "--list-poses",
        action="store_true",
        help="Print the 4 hard-coded WGS84 reference poses.",
    )
    parser.add_argument(
        "--capture-baseline",
        action="store_true",
        help=(
            "Invoke UE5 stub (stub until Wave 5), capture 4 reference poses, "
            "write to Tests/Baselines/<platform>/Pose_NN.png."
        ),
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help=(
            "Invoke UE5 stub (stub until Wave 5), capture 4 poses, compare "
            "against committed baselines; emit HTML report; exit non-zero on "
            "threshold breach."
        ),
    )
    parser.add_argument(
        "--platform",
        choices=["windows", "linux"],
        default="linux",
        help="Target platform for baseline path selection (default: linux).",
    )

    return parser, parser.parse_args(argv)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main(argv=None) -> int:
    parser, args = parse_args(argv)

    if args.self_check:
        return _cmd_self_check(args)
    if args.list_poses:
        return _cmd_list_poses(args)
    if args.capture_baseline:
        return _cmd_capture_baseline(args)
    if args.compare:
        return _cmd_compare(args)

    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
