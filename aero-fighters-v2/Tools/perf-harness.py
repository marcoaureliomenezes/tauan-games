#!/usr/bin/env python3
# REWRITE PENDING — see aero-fighters-v2-stylized-inhauma-v1/TASKS.md T-S-09
# (Algorithm survives unchanged; docstring + AC reference re-pin to AC-V2-S-18 on Iris Xe baseline)
"""Performance harness for aero-fighters-v2 (AC-V2-17, NFR-V2-01).

Reads frame-time series data, computes mean FPS + percentiles, asserts the
AC-V2-17 gate (mean >= 60 FPS AND p99 <= 18.5 ms), and emits an HTML report.

UE5 launch + trace-capture is the ONLY stub -- Wave 6's game-developer
implements the actual launch glue once UE 5.5 is installed.

Requirements: Python 3.8+ standard library only (no external deps needed for
the core math). HTML report generation uses stdlib too.
"""

import argparse
import csv
import datetime
import os
import sys

# ---------------------------------------------------------------------------
# AC-V2-17 gate constants (NFR-V2-01)
# ---------------------------------------------------------------------------
AC_V2_17_MIN_FPS = 60.0        # mean FPS floor
AC_V2_17_MAX_P99_MS = 18.5     # 99th-percentile frame-time ceiling (ms)
FLIGHT_LOOP_SECONDS = 60       # scripted flight duration for --run mode


# ---------------------------------------------------------------------------
# Stub: UE5 launch + trace capture
# ---------------------------------------------------------------------------
def run_scripted_flight_and_capture(platform: str) -> list:
    """Launch the Shipping build, run a 60 s scripted flight, return frame times.

    STUB -- raises NotImplementedError until Wave 6 implements the actual
    launch glue once UE 5.5 is installed on the operator machine.

    Args:
        platform: One of "windows" or "linux".

    Returns:
        list[float]: Frame times in milliseconds (one entry per rendered frame).

    Raises:
        NotImplementedError: Always, until Wave 6 fills this in.
    """
    raise NotImplementedError(
        "[perf-harness] run_scripted_flight_and_capture() is a stub.\n"
        "Wave 6 (game-developer) implements the actual UE5 launch glue once\n"
        "UE 5.5 is installed.  Platform requested: {platform}.\n"
        "See SPEC §NFR-V2-01 / AC-V2-17 and TASKS T-009 for context.".format(
            platform=platform
        )
    )


# ---------------------------------------------------------------------------
# Core frame-time analysis (fully implemented)
# ---------------------------------------------------------------------------
def parse_frame_times_csv(path: str) -> list:
    """Parse frame times from a CSV file (one frame time per row, in ms).

    Supported formats:
    - Single-column CSV (just frame-time values)
    - Two-column CSV with header "frame,ms" or "index,frame_time_ms"
    - UE5 UnrealInsights exported CSV (detects "GameThread" column if present)

    Args:
        path: Absolute path to CSV file.

    Returns:
        list[float]: Frame times in milliseconds, one entry per frame.

    Raises:
        FileNotFoundError: If path does not exist.
        ValueError: If no valid numeric frame times can be extracted.
    """
    if not os.path.isfile(path):
        raise FileNotFoundError("Frame-time CSV not found: {}".format(path))

    frame_times = []
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        rows = list(reader)

    if not rows:
        raise ValueError("CSV file is empty: {}".format(path))

    # Detect column index for frame time
    header = rows[0]
    ft_col = None

    # Try to find a column by name
    header_lower = [h.strip().lower() for h in header]
    for candidate in ("frame_time_ms", "ms", "frametime", "game_thread", "gametime"):
        if candidate in header_lower:
            ft_col = header_lower.index(candidate)
            data_rows = rows[1:]
            break

    if ft_col is None:
        # Try to detect if first row is numeric (no header)
        try:
            float(rows[0][0].strip())
            ft_col = 0
            data_rows = rows
        except (ValueError, IndexError):
            # First row is a header we didn't recognise; take last numeric column
            ft_col = len(header) - 1
            data_rows = rows[1:]

    for row in data_rows:
        if not row or ft_col >= len(row):
            continue
        cell = row[ft_col].strip()
        try:
            val = float(cell)
            if val > 0:
                frame_times.append(val)
        except ValueError:
            continue

    if not frame_times:
        raise ValueError(
            "No valid positive numeric frame-time values found in: {}".format(path)
        )

    return frame_times


def compute_mean_fps(frame_times_ms: list) -> float:
    """Compute mean FPS from a list of per-frame millisecond timings.

    Args:
        frame_times_ms: List of frame times in milliseconds.

    Returns:
        float: Mean FPS (frames per second).
    """
    if not frame_times_ms:
        return 0.0
    mean_ms = sum(frame_times_ms) / len(frame_times_ms)
    if mean_ms <= 0:
        return 0.0
    return 1000.0 / mean_ms


def compute_percentile(frame_times_ms: list, pct: float) -> float:
    """Compute the pct-th percentile of frame times.

    Uses the nearest-rank method (no interpolation).

    Args:
        frame_times_ms: List of frame times in milliseconds.
        pct: Percentile to compute (e.g. 50, 95, 99).

    Returns:
        float: Frame time in milliseconds at the requested percentile.
    """
    if not frame_times_ms:
        return 0.0
    sorted_times = sorted(frame_times_ms)
    n = len(sorted_times)
    # Nearest-rank: ceil(pct/100 * n) - 1, clamped to [0, n-1]
    rank = int((pct / 100.0) * n)
    rank = max(0, min(rank, n - 1))
    return sorted_times[rank]


def assert_ac_v2_17(frame_times_ms: list):
    """Assert AC-V2-17 gate: mean >= 60 FPS AND p99 <= 18.5 ms.

    Args:
        frame_times_ms: List of frame times in milliseconds.

    Returns:
        tuple[bool, str]: (passed, human-readable summary message)
    """
    mean_fps = compute_mean_fps(frame_times_ms)
    p99_ms = compute_percentile(frame_times_ms, 99)

    fps_ok = mean_fps >= AC_V2_17_MIN_FPS
    p99_ok = p99_ms <= AC_V2_17_MAX_P99_MS

    passed = fps_ok and p99_ok
    status = "PASS" if passed else "FAIL"

    msg = (
        "[AC-V2-17 {status}] mean FPS={mean_fps:.2f} (gate>={fps_gate}), "
        "p99={p99_ms:.2f}ms (gate<={p99_gate}ms)".format(
            status=status,
            mean_fps=mean_fps,
            fps_gate=AC_V2_17_MIN_FPS,
            p99_ms=p99_ms,
            p99_gate=AC_V2_17_MAX_P99_MS,
        )
    )
    return passed, msg


def _compute_full_stats(frame_times_ms: list) -> dict:
    """Compute full statistics dict from frame-time list."""
    mean_fps = compute_mean_fps(frame_times_ms)
    p50 = compute_percentile(frame_times_ms, 50)
    p95 = compute_percentile(frame_times_ms, 95)
    p99 = compute_percentile(frame_times_ms, 99)
    mean_ms = sum(frame_times_ms) / len(frame_times_ms) if frame_times_ms else 0.0
    passed, msg = assert_ac_v2_17(frame_times_ms)
    return {
        "frame_count": len(frame_times_ms),
        "mean_ms": mean_ms,
        "mean_fps": mean_fps,
        "p50_ms": p50,
        "p95_ms": p95,
        "p99_ms": p99,
        "ac_v2_17_pass": passed,
        "ac_v2_17_msg": msg,
    }


# ---------------------------------------------------------------------------
# HTML report generator
# ---------------------------------------------------------------------------
def write_html_report(stats: dict, output_path: str) -> None:
    """Write an HTML perf report from the stats dict.

    Args:
        stats: Dict returned by _compute_full_stats().
        output_path: Absolute path for the output HTML file.
    """
    ts = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    overall_color = "#2a7a2a" if stats.get("ac_v2_17_pass") else "#a82222"
    overall_label = "PASS" if stats.get("ac_v2_17_pass") else "FAIL"

    fps_color = "#2a7a2a" if stats["mean_fps"] >= AC_V2_17_MIN_FPS else "#a82222"
    p99_color = "#2a7a2a" if stats["p99_ms"] <= AC_V2_17_MAX_P99_MS else "#a82222"

    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>perf-harness report {ts}</title>
  <style>
    body {{ font-family: monospace; background: #111; color: #ddd; padding: 1em; }}
    h1 {{ color: {overall_color}; }}
    table {{ border-collapse: collapse; }}
    th, td {{ border: 1px solid #444; padding: 6px 14px; }}
    th {{ background: #222; }}
  </style>
</head>
<body>
<h1>Perf Harness Report: <span style="color:{overall_color}">{overall_label}</span></h1>
<p>Generated: {ts}</p>
<table>
  <tr><th>Metric</th><th>Value</th><th>Gate</th><th>Result</th></tr>
  <tr>
    <td>Frames sampled</td>
    <td>{frame_count}</td>
    <td>—</td>
    <td>—</td>
  </tr>
  <tr>
    <td>Mean frame time (ms)</td>
    <td>{mean_ms:.3f}</td>
    <td>—</td>
    <td>—</td>
  </tr>
  <tr>
    <td>Mean FPS</td>
    <td style="color:{fps_color}">{mean_fps:.2f}</td>
    <td>&ge; {fps_gate}</td>
    <td style="color:{fps_color}">{fps_label}</td>
  </tr>
  <tr>
    <td>p50 frame time (ms)</td>
    <td>{p50_ms:.3f}</td>
    <td>—</td>
    <td>—</td>
  </tr>
  <tr>
    <td>p95 frame time (ms)</td>
    <td>{p95_ms:.3f}</td>
    <td>—</td>
    <td>—</td>
  </tr>
  <tr>
    <td>p99 frame time (ms)</td>
    <td style="color:{p99_color}">{p99_ms:.3f}</td>
    <td>&le; {p99_gate}</td>
    <td style="color:{p99_color}">{p99_label}</td>
  </tr>
  <tr>
    <td><strong>AC-V2-17</strong></td>
    <td colspan="2">{ac_msg}</td>
    <td style="color:{overall_color}"><strong>{overall_label}</strong></td>
  </tr>
</table>
</body>
</html>""".format(
        ts=ts,
        overall_color=overall_color,
        overall_label=overall_label,
        frame_count=stats["frame_count"],
        mean_ms=stats["mean_ms"],
        mean_fps=stats["mean_fps"],
        fps_color=fps_color,
        fps_gate=AC_V2_17_MIN_FPS,
        fps_label="PASS" if stats["mean_fps"] >= AC_V2_17_MIN_FPS else "FAIL",
        p50_ms=stats["p50_ms"],
        p95_ms=stats["p95_ms"],
        p99_ms=stats["p99_ms"],
        p99_color=p99_color,
        p99_gate=AC_V2_17_MAX_P99_MS,
        p99_label="PASS" if stats["p99_ms"] <= AC_V2_17_MAX_P99_MS else "FAIL",
        ac_msg=stats["ac_v2_17_msg"],
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write(html)
    print("[perf-harness] HTML report written to: {}".format(output_path))


# ---------------------------------------------------------------------------
# CLI commands
# ---------------------------------------------------------------------------
def _cmd_self_check(args) -> int:
    """Verify percentile math against a synthetic constant frame-time array."""
    print("[self-check] Generating synthetic constant-16ms frame-time array (3600 frames)...")
    # 3600 frames at constant 16.0 ms => mean FPS = 1000/16 = 62.5
    frame_times = [16.0] * 3600

    mean_fps = compute_mean_fps(frame_times)
    p99 = compute_percentile(frame_times, 99)

    print("[self-check] Mean FPS = {:.4f} (expected 62.5)".format(mean_fps))
    print("[self-check] p99 frame time = {:.4f} ms (expected 16.0)".format(p99))

    ok = True
    if abs(mean_fps - 62.5) > 0.1:
        print(
            "[self-check] FAIL: mean FPS expected 62.5 +/- 0.1, got {:.4f}".format(mean_fps)
        )
        ok = False
    else:
        print("[self-check] PASS: mean FPS within tolerance")

    if abs(p99 - 16.0) > 0.1:
        print(
            "[self-check] FAIL: p99 expected 16.0 +/- 0.1 ms, got {:.4f}".format(p99)
        )
        ok = False
    else:
        print("[self-check] PASS: p99 within tolerance")

    # Also verify AC-V2-17 gate on this data (62.5 FPS >= 60, p99 16ms <= 18.5ms)
    passed, msg = assert_ac_v2_17(frame_times)
    if not passed:
        print(
            "[self-check] FAIL: AC-V2-17 assertion unexpectedly failed for "
            "constant-16ms data: {}".format(msg)
        )
        ok = False
    else:
        print("[self-check] PASS: AC-V2-17 assertion correct for constant-16ms data")

    if ok:
        print("[self-check] All checks PASSED. Exit 0.")
        return 0
    else:
        print("[self-check] One or more checks FAILED. Exit 1.")
        return 1


def _cmd_analyze(args) -> int:
    """Read frame-time data from file, compute stats, emit HTML report."""
    path = args.analyze
    print("[analyze] Reading frame times from: {}".format(path))
    try:
        frame_times = parse_frame_times_csv(path)
    except (FileNotFoundError, ValueError) as exc:
        print("[analyze] ERROR: {}".format(exc))
        return 1

    stats = _compute_full_stats(frame_times)
    print("[analyze] {}".format(stats["ac_v2_17_msg"]))
    print(
        "[analyze] Frames={frame_count}, mean={mean_fps:.2f} FPS, "
        "p50={p50_ms:.2f}ms, p95={p95_ms:.2f}ms, p99={p99_ms:.2f}ms".format(**stats)
    )

    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    ts = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H%M%SZ")
    report_path = os.path.join(
        repo_root, "Tests", "results", "perf-{}.html".format(ts)
    )
    write_html_report(stats, report_path)
    return 0


def _cmd_assert_only(args) -> int:
    """Like --analyze but exit non-zero unless AC-V2-17 passes."""
    path = args.assert_only
    print("[assert-only] Reading frame times from: {}".format(path))
    try:
        frame_times = parse_frame_times_csv(path)
    except (FileNotFoundError, ValueError) as exc:
        print("[assert-only] ERROR: {}".format(exc))
        return 1

    stats = _compute_full_stats(frame_times)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    ts = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H%M%SZ")
    report_path = os.path.join(
        repo_root, "Tests", "results", "perf-assert-{}.html".format(ts)
    )
    write_html_report(stats, report_path)

    print("[assert-only] {}".format(stats["ac_v2_17_msg"]))
    if not stats["ac_v2_17_pass"]:
        print("[assert-only] Gate FAILED. Exit 1.")
        return 1
    print("[assert-only] Gate PASSED. Exit 0.")
    return 0


def _cmd_run(args) -> int:
    """Invoke UE5 stub for 60s flight, capture frame times, analyze."""
    platform = args.platform
    print("[run] Platform: {}. Launching scripted flight (stub until Wave 6)...")
    # Raises NotImplementedError until Wave 6
    frame_times = run_scripted_flight_and_capture(platform)

    stats = _compute_full_stats(frame_times)
    print("[run] {}".format(stats["ac_v2_17_msg"]))

    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    ts = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H%M%SZ")
    report_path = os.path.join(
        repo_root, "Tests", "results", "perf-run-{}.html".format(ts)
    )
    write_html_report(stats, report_path)

    if not stats["ac_v2_17_pass"]:
        return 1
    return 0


# ---------------------------------------------------------------------------
# Argparse
# ---------------------------------------------------------------------------
def parse_args(argv=None):
    """Build and return the argument parser for the perf harness."""
    parser = argparse.ArgumentParser(
        prog="perf-harness",
        description=(
            "Performance harness for aero-fighters-v2 (AC-V2-17, NFR-V2-01). "
            "Reads frame-time CSV, computes mean FPS + p50/p95/p99, asserts "
            "the AC-V2-17 gate (>=60 FPS mean, <=18.5 ms p99), emits HTML."
        ),
    )

    parser.add_argument(
        "--self-check",
        action="store_true",
        help=(
            "Verify percentile math against a synthetic constant-16ms array. "
            "Expects mean FPS == 62.5 +/- 0.1 and p99 == 16.0 +/- 0.1. "
            "Exit 0 on success."
        ),
    )
    parser.add_argument(
        "--analyze",
        metavar="CSV",
        help=(
            "Read frame-time CSV, compute stats, emit HTML report. "
            "Does NOT enforce the AC-V2-17 gate (always exits 0)."
        ),
    )
    parser.add_argument(
        "--assert-only",
        metavar="CSV",
        help=(
            "Same as --analyze but exit non-zero unless mean >= 60 FPS "
            "AND p99 <= 18.5 ms (AC-V2-17 gate)."
        ),
    )
    parser.add_argument(
        "--run",
        action="store_true",
        help=(
            "Invoke UE5 stub (stub until Wave 6) for 60 s scripted flight, "
            "capture frame times, analyze + emit HTML. Exit non-zero on gate breach."
        ),
    )
    parser.add_argument(
        "--platform",
        choices=["windows", "linux"],
        default="linux",
        help="Target platform for --run mode (default: linux).",
    )

    return parser, parser.parse_args(argv)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main(argv=None) -> int:
    parser, args = parse_args(argv)

    if args.self_check:
        return _cmd_self_check(args)
    if args.analyze:
        return _cmd_analyze(args)
    if args.assert_only:
        return _cmd_assert_only(args)
    if args.run:
        return _cmd_run(args)

    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
