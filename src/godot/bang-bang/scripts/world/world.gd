# world.gd — monta o mundo: terreno + florestas + água + céu.
extends Node3D

const BangTerrainScript = preload("res://scripts/world/terrain.gd")
const BangForestsScript = preload("res://scripts/world/forests.gd")
const BangWaterScript = preload("res://scripts/world/water.gd")
const BangSkyScript = preload("res://scripts/world/sky.gd")
const BangRailwayScript = preload("res://scripts/world/railway.gd")
const BangSettlementsScript = preload("res://scripts/settlements/settlements.gd")
const BangEntitiesScript = preload("res://scripts/entities/entities.gd")

var terrain
var forests
var water
var sky
var railway
var settlements
var entities

func _ready() -> void:
	terrain = BangTerrainScript.new()
	terrain.name = "Terrain"
	add_child(terrain)
	terrain.build(Game.world_seed)

	water = BangWaterScript.new()
	water.name = "Water"
	add_child(water)
	water.build(terrain, terrain.gen)

	forests = BangForestsScript.new()
	forests.name = "Forests"
	add_child(forests)
	forests.build(terrain, terrain.gen, Game.world_seed)

	sky = BangSkyScript.new()
	sky.name = "Sky"
	add_child(sky)

	railway = BangRailwayScript.new()
	railway.name = "Railway"
	add_child(railway)
	railway.build(terrain, Game.world_seed)

	settlements = BangSettlementsScript.new()
	settlements.name = "Settlements"
	add_child(settlements)
	settlements.build(terrain, Game.world_seed)

	entities = BangEntitiesScript.new()
	entities.name = "Entities"
	add_child(entities)
	entities.build(terrain, settlements, Game.world_seed)
