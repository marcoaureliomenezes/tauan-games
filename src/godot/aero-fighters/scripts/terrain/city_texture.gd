class_name CityTexture
extends RefCounted
## CityTexture — texturas de fachada baked em runtime (port de
## inhauma-city.js#makeFacadeTextures): grade regular de janelas (vidro escuro
## com variação de reflexo), linhas de piso, embasamento térreo mais escuro,
## PORTA na residencial, e mapa emissive casado (só janelas acesas, quente
## 0xffc873) que liga à noite. Determinístico (sementes fixas).

const SPECS := {
	"low": {"rows": 2, "cols": 4, "lit": 0.42, "door": true}, # residencial 1-2 pav.
	"mid": {"rows": 5, "cols": 6, "lit": 0.35, "door": false}, # downtown 4-8 pav.
	"tower": {"rows": 10, "cols": 6, "lit": 0.30, "door": false}, # 9+ pav.
}


static func bake(kind: String) -> Dictionary:
	var spec: Dictionary = SPECS[kind]
	const S := 256
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(kind) & 0x7fffffff
	# Grade de janelas (mesma posição nos dois mapas — senão a acesa "anda")
	var wins: Array[Dictionary] = []
	var mx := S * 0.10
	var my := S * 0.08
	var cw: float = (S - 2 * mx) / spec.cols
	var ch: float = (S - 2 * my) / spec.rows
	for r in spec.rows:
		for c in spec.cols:
			wins.append({"x": mx + c * cw + cw * 0.22, "y": my + r * ch + ch * 0.20,
				"w": cw * 0.56, "h": ch * 0.58,
				"lit": rng.randf() < spec.lit, "shade": rng.randf()})
	# Difuso: fachada clara (a cor vem do instanceColor)
	var img := Image.create(S, S, false, Image.FORMAT_RGBA8)
	img.fill(Color(0.914, 0.898, 0.863)) # #e9e5dc
	for r in range(1, spec.rows): # linhas de piso sutis
		_rect(img, mx * 0.4, my + r * ch - 1, S - mx * 0.8, 2, Color(0.35, 0.33, 0.29, 0.18))
	_rect(img, 0, S - my * 0.7, S, my * 0.7, Color(0.27, 0.25, 0.22, 0.35)) # térreo
	for w in wins: # vidro escuro com reflexo variado
		var l: float = 0.16 + w.shade * 0.14
		_rect(img, w.x, w.y, w.w, w.h, Color(l * 0.35, l * 0.43, l * 0.55))
	if spec.door: # porta residencial (pedido do operador) — centro do térreo
		var dw: float = cw * 0.5
		_rect(img, S * 0.5 - dw * 0.5, S - my * 0.7 - ch * 0.6, dw, ch * 0.6,
			Color(0.30, 0.20, 0.13))
		_rect(img, S * 0.5 - dw * 0.5 - 2, S - my * 0.7 - ch * 0.6 - 4, dw + 4, 4,
			Color(0.42, 0.36, 0.28)) # verga
	img.generate_mipmaps()
	# Emissive: só janelas acesas
	var eimg := Image.create(S, S, false, Image.FORMAT_RGBA8)
	eimg.fill(Color.BLACK)
	for w in wins:
		if not w.lit:
			continue
		var l: float = 0.75 + w.shade * 0.25
		_rect(eimg, w.x, w.y, w.w, w.h, Color(1.0 * l, 0.80 * l, 0.55 * l))
	eimg.generate_mipmaps()
	return {"albedo": ImageTexture.create_from_image(img),
		"emission": ImageTexture.create_from_image(eimg)}


static func _rect(img: Image, x: float, y: float, w: float, h: float, color: Color) -> void:
	for py in range(int(y), mini(int(y + h), img.get_height())):
		for px in range(int(x), mini(int(x + w), img.get_width())):
			if px >= 0 and py >= 0:
				img.set_pixel(px, py, color)
