# Godot Version Pin — aero-fighters-v2

## Version String

```
4.4.stable.official.4c311cbee
```

## Install Path

```
~/godot/godot
```

## GODOT_BIN_PATH

```
GODOT_BIN_PATH=~/godot/godot
```

## SHA-256 of Binary

```
de53241695d40c42031a6ae5030f91150592668f257ff8bcf51fa51637f3d72a
```

## Install Date

2026-05-18

## Operator Note

Godot 4.4 stable was installed by the operator prior to Wave 1 execution.
The orchestrator's wget script downloaded the binary directly and placed it
at `~/godot/godot`. The binary is not the Mono build (no C# runtime
bundled); if C# promotion is triggered per NFR-V2-G-05, the operator must
download the Mono variant (`Godot_v4.4-stable_mono_linux_x86_64.zip`) and
replace the binary at this path. The current standard build is sufficient
for all GDScript-first Wave 1 tasks.

## Verification

```bash
~/godot/godot --version
# 4.4.stable.official.4c311cbee
```
