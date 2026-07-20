extends Node
## Autoload: rotas cidade-a-cidade, modo de jogo (corrida | perseguicao) e resultados.
##
## Cada rota é uma viagem A→B (curva ABERTA, sem circuito) com trechos tipados:
## "dual" = rodovia duplicada (4 faixas), "single" = pista simples (2 faixas),
## "dirt" = estrada de terra, "ford" = travessia de riacho (terra + água).
## Os mesmos mapas servem às duas visões; muda a lógica de adversários.

const MODE_RACE := "corrida"
const MODE_CHASE := "perseguicao"

const ROUTES := {
	"serra":
	{
		"title": "Tauan City → Vila Serrana",
		"city_a": "Tauan City",
		"city_b": "Vila Serrana",
		"seed": 11,
		"amplitude": 55.0,
		"base_scale": 260.0,
		"sun_energy_lux": 100000.0,
		"sun_temperature": 5500.0,
		"sun_angle": -38.0,
		"fog_density": 0.0011,
		"horizon_color": Color(0.62, 0.75, 0.88),
		"low_color": Color(0.22, 0.45, 0.18),
		"high_color": Color(0.45, 0.42, 0.38),
		"peak_color": Color(0.92, 0.94, 0.97),
		"tree_color": Color(0.12, 0.34, 0.12),
		"tree_count": 500,
		"points":
		[
			Vector3(0, 2, 0),
			Vector3(190, 6, -60),
			Vector3(380, 24, -20),
			Vector3(540, 58, 70),
			Vector3(700, 92, 40),
			Vector3(860, 110, 110),
			Vector3(1030, 84, 190),
			Vector3(1200, 46, 150),
			Vector3(1380, 22, 210),
			Vector3(1560, 8, 170),
			Vector3(1730, 4, 230),
		],
		"crests": [0.34, 0.58, 0.78],
		"veg": "mata",
		"segments":
		[
			{"until": 0.30, "type": "dual"},
			{"until": 0.52, "type": "single"},
			{"until": 0.62, "type": "dirt"},
			{"until": 0.66, "type": "ford"},
			{"until": 0.82, "type": "dirt"},
			{"until": 1.0, "type": "single"},
		],
	},
	"sertao":
	{
		"title": "Inhaúma → Porto Feliz",
		"city_a": "Inhaúma",
		"city_b": "Porto Feliz",
		"seed": 47,
		"amplitude": 22.0,
		"base_scale": 300.0,
		"sun_energy_lux": 105000.0,
		"sun_temperature": 5800.0,
		"sun_angle": -50.0,
		"fog_density": 0.0007,
		"horizon_color": Color(0.5, 0.72, 0.94),
		"low_color": Color(0.76, 0.68, 0.34),
		"high_color": Color(0.62, 0.5, 0.28),
		"peak_color": Color(0.72, 0.42, 0.26),
		"tree_color": Color(0.24, 0.4, 0.16),
		"tree_count": 260,
		"points":
		[
			Vector3(0, 2, 0),
			Vector3(210, 4, 50),
			Vector3(430, 10, -10),
			Vector3(640, 6, 60),
			Vector3(830, 18, 140),
			Vector3(1020, 10, 90),
			Vector3(1240, 4, 160),
			Vector3(1450, 12, 110),
			Vector3(1650, 6, 180),
		],
		"crests": [0.28, 0.52, 0.74, 0.9],
		"veg": "cerrado",
		"segments":
		[
			{"until": 0.22, "type": "dual"},
			{"until": 0.34, "type": "dirt"},
			{"until": 0.38, "type": "ford"},
			{"until": 0.58, "type": "dirt"},
			{"until": 0.64, "type": "ford"},
			{"until": 0.86, "type": "single"},
			{"until": 1.0, "type": "dual"},
		],
	},
}

var selected_track := "serra"
var selected_mode := MODE_RACE
var last_results: Array = []


func track_def() -> Dictionary:
	return ROUTES[selected_track]
