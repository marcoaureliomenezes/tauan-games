// IslandGenerator.cs — Procedural island meshes matching the Three.js dome formula.
// 18 islands, vertex colors by altitude zone, 44-segment planes.
// Static SampleHeight used by MissionManager to place targets.

using UnityEngine;
using System.Collections.Generic;

public class IslandGenerator : MonoBehaviour
{
    private const int SEG = 44;

    private readonly List<(float cx, float cz, float radius, float peak)> _islandData = new();

    private void Start()
    {
        for (int i = 0; i < GameConfig.ISLAND_DEFS.Length; i++)
        {
            Vector4 def = GameConfig.ISLAND_DEFS[i];
            float cx     = def.x;
            float cz     = def.y;
            float radius = def.z;
            float peak   = def.w;
            _islandData.Add((cx, cz, radius, peak));
            CreateIslandMesh(cx, cz, radius, peak);
        }
    }

    private void CreateIslandMesh(float cx, float cz, float radius, float peakHeight)
    {
        // Build a flat grid then displace Y by dome formula
        int    vCount = (SEG + 1) * (SEG + 1);
        int    iCount = SEG * SEG * 6;
        Vector3[]  verts  = new Vector3[vCount];
        Vector2[]  uvs    = new Vector2[vCount];
        Color[]    colors = new Color[vCount];
        int[]      tris   = new int[iCount];

        float step = (radius * 2f) / SEG;
        int   vi   = 0;
        for (int row = 0; row <= SEG; row++)
        {
            for (int col = 0; col <= SEG; col++)
            {
                float x = -radius + col * step;
                float z = -radius + row * step;
                float h = ComputeHeight(x, z, radius, peakHeight);
                verts[vi]  = new Vector3(x, h, z);
                uvs[vi]    = new Vector2(col / (float)SEG, row / (float)SEG);
                colors[vi] = AltitudeColor(h, peakHeight);
                vi++;
            }
        }

        // Triangles
        int ti = 0;
        for (int row = 0; row < SEG; row++)
        {
            for (int col = 0; col < SEG; col++)
            {
                int bl = row * (SEG + 1) + col;
                int br = bl + 1;
                int tl = bl + (SEG + 1);
                int tr = tl + 1;
                tris[ti++] = bl; tris[ti++] = tl; tris[ti++] = br;
                tris[ti++] = br; tris[ti++] = tl; tris[ti++] = tr;
            }
        }

        Mesh mesh = new Mesh();
        mesh.name = $"Island_{cx}_{cz}";
        mesh.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
        mesh.vertices    = verts;
        mesh.triangles   = tris;
        mesh.uv          = uvs;
        mesh.colors      = colors;
        mesh.RecalculateNormals();

        GameObject go = new GameObject($"Island_{cx:0}_{cz:0}");
        go.transform.SetParent(transform, false);
        go.transform.position = new Vector3(cx, 0f, cz);
        go.tag = "Island";

        MeshFilter   mf = go.AddComponent<MeshFilter>();
        mf.mesh = mesh;

        MeshRenderer mr = go.AddComponent<MeshRenderer>();
        // Use a URP lit material that reads vertex colors
        Material mat = new Material(Shader.Find("Universal Render Pipeline/Simple Lit"))
        {
            name = "IslandMat"
        };
        // Enable vertex color in URP via shader keyword or custom shader
        // Fallback: create a simple colored material for each altitude zone
        mr.material = mat;

        // Mesh collider for terrain collision checks
        MeshCollider mc = go.AddComponent<MeshCollider>();
        mc.sharedMesh = mesh;
    }

    // ── Dome height formula (exact port from world.js) ────────────────────────
    private static float ComputeHeight(float x, float z, float radius, float peakHeight)
    {
        float dist = Mathf.Sqrt(x * x + z * z) / radius;

        // 4-octave sine noise — same as Three.js
        float noise =
            Mathf.Sin(x * 0.18f) * Mathf.Cos(z * 0.14f) * 5f +
            Mathf.Sin(x * 0.36f + 1.5f) * Mathf.Cos(z * 0.29f + 0.8f) * 2.5f +
            Mathf.Sin(x * 0.72f) * Mathf.Cos(z * 0.63f) * 1.2f +
            Mathf.Sin(x * 1.42f + 0.4f) * Mathf.Cos(z * 1.18f - 0.6f) * 0.6f;

        return Mathf.Max(0f, (1f - dist * dist * 1.35f) * peakHeight + noise);
    }

    // ── Altitude-based vertex color (same zones as world.js) ─────────────────
    private static Color AltitudeColor(float h, float peakHeight)
    {
        float ratio = h / Mathf.Max(peakHeight, 1f);
        if (h <= 2f)
            return new Color(0.94f, 0.89f, 0.76f);   // beach: sandy white
        if (h <= 4.5f)
            return new Color(0.36f, 0.64f, 0.28f);   // grass: mid-green
        if (ratio < 0.58f)
            return new Color(0.22f, 0.48f, 0.18f);   // forest: dark green
        if (ratio < 0.80f)
            return new Color(0.48f, 0.42f, 0.36f);   // rock: brown-grey
        return new Color(0.96f, 0.96f, 0.98f);       // snow: white
    }

    // ── Static: sample island height at local offset (used by MissionManager) ─
    /// Returns the world-space Y at local offset (dx, dz) on an island with given radius and peak.
    public static float SampleHeight(float dx, float dz, float radius, float peakHeight)
    {
        return ComputeHeight(dx, dz, radius, peakHeight);
    }

    // ── Terrain collision check (called by FlightController each frame) ────────
    /// Returns true if position is below island terrain at that XZ coordinate.
    public bool CheckTerrainCollision(Vector3 pos)
    {
        foreach (var (cx, cz, radius, peak) in _islandData)
        {
            float dx = pos.x - cx;
            float dz = pos.z - cz;
            if (Mathf.Abs(dx) > radius || Mathf.Abs(dz) > radius) continue;
            float h = SampleHeight(dx, dz, radius, peak);
            if (pos.y < h + GameConfig.MOUNTAIN_BUFFER)
                return true;
        }
        return false;
    }
}
