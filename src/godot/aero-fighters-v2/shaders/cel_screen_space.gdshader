// cel_screen_space.gdshader
// Screen-space cel-shader pass for Aero Fighters v2.
// Applied to a full-screen QuadMesh (MeshInstance3D) that is a direct child of the
// active Camera3D.  Must NOT use canvas_item type — depth and normal-roughness hints
// are only available in spatial shaders (Godot 4 Forward+ only).
//
// FR-V2-G-11 requirements:
//   - Diffuse step-quantisation into <bands> flat bands.
//   - Sobel-edge outline detection on depth + normal-roughness buffers.
//   - ×1.15 saturation lift on quantised output.
//   - Target cost ≤ 0.8 ms @ 1920×1080 on Intel Iris Xe G7 80EU.
//
// Calibration: docs/cel-shader-calibration.md

shader_type spatial;
render_mode unshaded, depth_draw_never, depth_test_disabled, cull_disabled, shadows_disabled;

// --- Samplers (Forward+ only) ---
uniform sampler2D screen_tex  : hint_screen_texture,            filter_linear, repeat_disable;
uniform sampler2D depth_tex   : hint_depth_texture,             filter_nearest, repeat_disable;
uniform sampler2D normal_tex  : hint_normal_roughness_texture,  filter_nearest, repeat_disable;

// --- Tunable parameters (initial values per FR-V2-G-11; calibrate in docs/cel-shader-calibration.md) ---
uniform float bands               : hint_range(2.0, 8.0)   = 3.0;
uniform float depth_edge_thresh   : hint_range(0.001, 0.5) = 0.04;
uniform float normal_edge_thresh  : hint_range(0.05, 1.0)  = 0.55;
uniform float saturation_lift     : hint_range(0.5, 2.0)   = 1.15;
uniform vec3  outline_color       : source_color            = vec3(0.05, 0.05, 0.05);

// --- Sobel edge on depth (raw device depth; relative to local value) ---
float sobel_depth(vec2 uv, vec2 px) {
	float c = texture(depth_tex, uv).r;
	float u = texture(depth_tex, uv + vec2( 0.0,    -px.y)).r;
	float d = texture(depth_tex, uv + vec2( 0.0,     px.y)).r;
	float l = texture(depth_tex, uv + vec2(-px.x,    0.0 )).r;
	float r = texture(depth_tex, uv + vec2( px.x,    0.0 )).r;
	float dx = abs(l - r);
	float dy = abs(u - d);
	return max(dx, dy) / max(c, 0.0001);
}

// --- Sobel edge on world-normal (rgb of normal_roughness buffer, 0-1 packed) ---
float sobel_normal(vec2 uv, vec2 px) {
	vec3 u = texture(normal_tex, uv + vec2( 0.0,   -px.y)).rgb;
	vec3 d = texture(normal_tex, uv + vec2( 0.0,    px.y)).rgb;
	vec3 l = texture(normal_tex, uv + vec2(-px.x,   0.0 )).rgb;
	vec3 r = texture(normal_tex, uv + vec2( px.x,   0.0 )).rgb;
	float dx = length(l - r);
	float dy = length(u - d);
	return max(dx, dy);
}

// --- Quantise colour into flat cel-bands ---
vec3 quantize(vec3 color) {
	return floor(color * bands) / bands;
}

// --- Lift saturation around grey ---
vec3 lift_saturation(vec3 color) {
	float luma = dot(color, vec3(0.299, 0.587, 0.114));
	return mix(vec3(luma), color, saturation_lift);
}

void fragment() {
	vec2 px_size = 1.0 / vec2(textureSize(screen_tex, 0));

	vec4 scene = texture(screen_tex, SCREEN_UV);

	float de = sobel_depth(SCREEN_UV, px_size);
	float ne = sobel_normal(SCREEN_UV, px_size);
	bool  is_edge = (de > depth_edge_thresh) || (ne > normal_edge_thresh);

	vec3 quantized = quantize(scene.rgb);
	vec3 lifted    = lift_saturation(quantized);
	vec3 final_rgb = is_edge ? outline_color : lifted;

	ALBEDO = final_rgb;
}
