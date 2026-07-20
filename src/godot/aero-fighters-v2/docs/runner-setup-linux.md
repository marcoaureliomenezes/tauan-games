# Self-hosted Runner Setup — Linux

**Release:** `aero-fighters-v2-photorealistic-inhauma-v1`
**Task:** T-002 (devops-engineer)
**Last updated:** 2026-05-17

---

## Purpose

NFR-V2-03 requires native Linux x64 Shipping builds alongside Windows x64 to satisfy AC-V2-LOC-L. Achieving this on the operator's own machine requires registering it as a GitHub Actions self-hosted runner so the `aero-v2-runner-healthcheck` workflow can probe GPU availability and UE5 toolchain readiness. This document is subject to the LD-21 Gate-1 if-slip rule: if the Linux runner is not online by end of Wave 1, the operator decides by end of Week 2 whether to defer AC-V2-LOC-L entirely to v2.1 and proceed with a Windows-only build lane through Wave 6 (see the Gate-1 if-slip section at the bottom).

---

## Two paths

Choose one path based on your hardware setup.

| Path | When to choose |
|---|---|
| **Native Linux (preferred)** | Dual-boot Ubuntu 24.04 LTS or a dedicated Linux machine with the RTX 3060 |
| **WSL2 + GPU passthrough (fallback)** | Windows 11 22H2+ already in use; dual-boot is impractical |

---

## Path A — Native Linux (preferred)

### Prerequisites

- Ubuntu 24.04 LTS (or equivalent distro with NVIDIA driver support)
- NVIDIA driver `550` or newer installed and loaded:

  ```bash
  nvidia-smi
  # Expected: table listing GPU name, driver version, CUDA version
  # If this command is not found, install the driver first:
  # sudo ubuntu-drivers autoinstall
  # OR
  # sudo apt install nvidia-driver-550
  # Then reboot.
  ```

- Internet access to reach `https://github.com` from this machine (runner registration calls back to GitHub).

### Step 1 — Create a dedicated runner user (recommended)

Running the GitHub runner as a non-root, non-privileged user reduces blast radius if a workflow misbehaves.

```bash
sudo useradd -m -s /bin/bash ghrunner
sudo su - ghrunner
# All subsequent steps in this section run as ghrunner
```

### Step 2 — Download the runner package

**Operator action required.** Open in a browser:

```
https://github.com/<owner>/<repo>/settings/actions/runners/new
```

Replace `<owner>/<repo>` with the canonical path of the `tauan-games` repository (e.g. `marcoaureliomenezes/tauan-games`). GitHub generates a one-time registration token valid for 1 hour. Copy the `./config.sh` command shown on that page — it includes `--token <SINGLE_USE_TOKEN>`.

Download the runner tarball using the URL shown by GitHub (version may differ):

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.323.0/actions-runner-linux-x64-2.323.0.tar.gz
tar xzf ./actions-runner-linux-x64.tar.gz
```

### Step 3 — Configure the runner

Run the `./config.sh` command copied from the GitHub UI. When prompted for labels, enter:

```
self-hosted,gpu-rtx3060,ue5-builder
```

When prompted for the runner group, accept the default (`Default`).

Example (token is illustrative — use the one GitHub generated for you):

```bash
./config.sh \
  --url https://github.com/<owner>/<repo> \
  --token <SINGLE_USE_TOKEN> \
  --name gpu-rtx3060 \
  --labels "self-hosted,gpu-rtx3060,ue5-builder" \
  --work _work
```

**Token security:** the registration token is single-use and expires in 1 hour. Never commit it. Never paste it into any file that gets tracked by git. GitHub generates a fresh token each time you visit the "New runner" page.

### Step 4 — Install and start the systemd service

GitHub ships a helper script that installs the runner as a systemd service:

```bash
# Still as ghrunner in ~/actions-runner
sudo ./svc.sh install ghrunner   # installs systemd unit as user ghrunner
sudo ./svc.sh start
```

Verify the service is running:

```bash
sudo systemctl status "actions.runner.*"
# Expected: Active: active (running)
```

The runner will now pick up jobs automatically, including after reboots.

---

## Path B — WSL2 + GPU passthrough (fallback)

This path is for operators who cannot or do not want to dual-boot. UE5 packaging from within WSL2 has known idiosyncrasies (see UE5.5 release notes for WSL-specific packaging caveats); treat this as a fallback, not a supported primary path.

### Prerequisites

- Windows 11 22H2 or newer
- WSL2 GPU passthrough enabled (NVIDIA WDDM 3.0+ driver — typically ships with Game Ready Driver 525+)
- Sufficient disk space inside the WSL2 virtual disk for UE5 + build artifacts (~200 GB recommended)

### Step 1 — Install Ubuntu 24.04 under WSL2

```powershell
# Run in PowerShell (admin)
wsl --install -d Ubuntu-24.04
wsl --set-default Ubuntu-24.04
```

Reboot if prompted.

### Step 2 — Verify GPU passthrough

```bash
# Inside WSL2 Ubuntu shell
nvidia-smi
# Expected: same GPU visible as on Windows host
```

If `nvidia-smi` is not found inside WSL2, install the CUDA WSL-Ubuntu package:

```bash
# Follow NVIDIA's WSL2 CUDA installation guide:
# https://docs.nvidia.com/cuda/wsl-user-guide/index.html
# Do NOT install a full NVIDIA driver inside WSL2 — the Windows host driver handles GPU access.
```

### Step 3 — Register the runner inside WSL2

Follow the same steps as Path A (Steps 1–4 above) but run them inside the WSL2 Ubuntu shell. The runner binary is the same `linux-x64` tarball.

**WSL2 caveats for UE5 packaging:**

- UE5 UnrealBuildTool may fail to find the Linux toolchain if `PATH` is not propagated from the Windows environment. Set `WSLENV=UE_INSTALL_PATH/p` in Windows environment variables to pass the path into WSL2.
- Shader compilation in WSL2 can be significantly slower than native Linux due to filesystem translation overhead. The tile cache populate step (`make tile-cache-populate`) is especially affected.
- Cross-compilation from WSL2 to produce Linux Shipping binaries is the expected path; native WSL2 packaging into a Windows `.exe` is not supported in this configuration.

---

## Verification

After registration (either path), dispatch the healthcheck workflow from the GitHub Actions UI:

1. Go to `https://github.com/<owner>/<repo>/actions/workflows/aero-v2-runner-healthcheck.yml`
2. Click **Run workflow** > select branch `main` (or the active feature branch) > **Run workflow**
3. Watch the run until it completes

Open the uploaded artifact `runner-healthcheck-<run_id>.log` and confirm:

- `nvidia-smi` output shows the RTX 3060 (name and driver version)
- `Runner name:` matches what you set during `./config.sh`
- `GOOGLE_MAPS_TILES_API_KEY:` shows `PRESENT` (requires the GitHub Secret to be set — see below)

**GitHub Secret wiring:** Add the `GOOGLE_MAPS_TILES_API_KEY` secret in `Settings > Secrets and variables > Actions > New repository secret`. Fetch the value from 1Password:

```bash
op item get "aero-fighters-v2/google-maps-tiles-api-key" --field credential
```

This is required before nightly screenshot-diff harness runs (AC-V2-18). It is informational-only for the healthcheck.

---

## Troubleshooting

### (a) `nvidia-smi: command not found`

**Cause:** NVIDIA driver not installed or not loaded.

```bash
# Check if the module is loaded:
lsmod | grep nvidia
# If nothing: install the driver
sudo ubuntu-drivers autoinstall
# OR explicitly:
sudo apt install nvidia-driver-550
sudo reboot
# After reboot:
nvidia-smi
```

For WSL2: do not install a Linux NVIDIA driver inside the WSL2 VM. The host Windows driver provides GPU access via the `libcuda.so` stub. Follow the CUDA WSL-Ubuntu installation guide linked in Path B Step 2.

### (b) Runner status `offline` in GitHub Settings

**Cause:** The runner process/service is not running, or the registration token has expired.

```bash
# Check systemd service
sudo systemctl status "actions.runner.*"

# If stopped, restart:
sudo systemctl restart "actions.runner.*"

# If the service is not found, re-run the svc.sh install:
cd ~/actions-runner
sudo ./svc.sh install ghrunner
sudo ./svc.sh start
```

If the runner was configured with an expired token, you must re-register: run `./config.sh remove` then repeat Steps 2–4 with a fresh token from the GitHub UI.

### (c) Workflow dispatch fails: "No runner matching the specified labels was found"

**Cause:** The runner is either offline or was not registered with the exact labels `self-hosted`, `gpu-rtx3060`, and `ue5-builder`.

Check registered labels:

```bash
# On the runner machine
cat ~/actions-runner/.runner | python3 -m json.tool | grep -i label
```

If labels are wrong, re-register with `./config.sh remove` then `./config.sh` using `--labels "self-hosted,gpu-rtx3060,ue5-builder"`.

Also confirm the runner appears as **Idle** (not Offline) in `https://github.com/<owner>/<repo>/settings/actions/runners`.

---

## Gate-1 if-slip handling (LD-21)

Gate-1 fires at the end of Wave 1 (end of Week 1). The gate condition: self-hosted Windows AND Linux runners online and passing a UE5 compile-check job.

If the Linux runner is not online by Gate-1:

1. Mark the Linux-side Gate-1 as **at-risk** in the T-002 closure note in TASKS.md (the devops-engineer adds this note when closing T-002).
2. Continue through Wave 2–6 using the Windows-only build lane (`make build-win-shipping` targeting AC-V2-LOC-W only).
3. Operator decides by end of Week 2 whether to:
   - Proceed with Linux registration (follow this document and close the at-risk flag), or
   - Defer AC-V2-LOC-L entirely to v2.1 (document the deferral in the CLOSURE.md note).

The georef seam (LD-15) and the modular build targets (SPEC §11) mean the Windows lane can proceed independently. Linux support is additive, not on the critical path for Windows Gate-2 and Gate-3.
