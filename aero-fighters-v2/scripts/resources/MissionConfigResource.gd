extends Resource
class_name MissionConfigResource
# MissionConfigResource — custom Resource class for mission target placement and difficulty.
# Implements FR-V2-G-06 target layout and FR-V2-G-07 difficulty scaling.
# Instantiated as Content/Data/MissionConfig.tres.

# --- AA Gun Cluster anchor (WGS84) ---
@export var aa_cluster_latitude: float = -19.490
@export var aa_cluster_longitude: float = -44.387

# --- Factory instances: lat/lon offsets from world origin (Vector2: lat_offset, lon_offset) ---
# One factory per mission cycle. Offset from origin (-19.47, -44.46).
@export var factory_offsets: Array[Vector2] = [Vector2(-0.03, 0.05)]

# --- Base instances: lat/lon offsets from world origin ---
# One base per mission cycle.
@export var base_offsets: Array[Vector2] = [Vector2(0.02, -0.04)]

# --- Target hit points ---
@export var factory_hp: int = 20
@export var base_hp: int = 28
@export var aa_gun_hp: int = 6  # per gun; 3 guns in the cluster

# --- Difficulty scaling per cycle ---
@export var difficulty_hp_coef: float = 1.15    # HP multiplier per cycle
@export var difficulty_aa_interval_coef: float = 0.92  # AA fire interval multiplier per cycle (< 1 = faster)
