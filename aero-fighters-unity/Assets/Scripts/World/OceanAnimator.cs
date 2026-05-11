// OceanAnimator.cs — Animated ocean mesh using 3 overlapping wave functions.
// Exact port of the wave formula from world.js (Three.js reference).
// Updates every 2nd frame for performance (still visually smooth at 60 fps).

using UnityEngine;

[RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
public class OceanAnimator : MonoBehaviour
{
    private const int SEGMENTS = 64;

    private Mesh    _mesh;
    private Vector3[] _baseVerts;  // original flat positions
    private Vector3[] _animVerts;  // animated positions (reused each frame)
    private int     _frameCount = 0;

    private void Start()
    {
        BuildOceanMesh();
    }

    private void BuildOceanMesh()
    {
        int vertCount = (SEGMENTS + 1) * (SEGMENTS + 1);
        int triCount  = SEGMENTS * SEGMENTS * 6;

        Vector3[] verts = new Vector3[vertCount];
        Vector2[] uvs   = new Vector2[vertCount];
        int[]     tris  = new int[triCount];

        float half = GameConfig.OCEAN_SIZE * 0.5f;
        float step = GameConfig.OCEAN_SIZE / SEGMENTS;

        int vi = 0;
        for (int row = 0; row <= SEGMENTS; row++)
        {
            for (int col = 0; col <= SEGMENTS; col++)
            {
                float x = -half + col * step;
                float z = -half + row * step;
                verts[vi] = new Vector3(x, 0f, z);
                uvs[vi]   = new Vector2((float)col / SEGMENTS * 50f,
                                        (float)row / SEGMENTS * 50f);
                vi++;
            }
        }

        int ti = 0;
        for (int row = 0; row < SEGMENTS; row++)
        {
            for (int col = 0; col < SEGMENTS; col++)
            {
                int bl = row * (SEGMENTS + 1) + col;
                int br = bl + 1;
                int tl = bl + (SEGMENTS + 1);
                int tr = tl + 1;
                tris[ti++] = bl; tris[ti++] = tl; tris[ti++] = br;
                tris[ti++] = br; tris[ti++] = tl; tris[ti++] = tr;
            }
        }

        _mesh              = new Mesh();
        _mesh.name         = "Ocean";
        _mesh.indexFormat  = UnityEngine.Rendering.IndexFormat.UInt32;
        _mesh.vertices     = verts;
        _mesh.triangles    = tris;
        _mesh.uv           = uvs;
        _mesh.RecalculateNormals();

        _baseVerts = verts;
        _animVerts = new Vector3[vertCount];
        System.Array.Copy(_baseVerts, _animVerts, vertCount);

        GetComponent<MeshFilter>().sharedMesh = _mesh;

        // Ocean material
        MeshRenderer mr = GetComponent<MeshRenderer>();
        Material mat    = new Material(Shader.Find("Universal Render Pipeline/Lit"))
        {
            name  = "OceanMat",
            color = new Color(0f, 0.31f, 0.47f),
        };
        mr.material = mat;
    }

    private void Update()
    {
        // Update every 2nd frame (same optimization as Three.js)
        _frameCount++;
        if ((_frameCount & 1) != 0) return;

        float t = Time.time * 0.0008f * 1000f; // match Three.js: performance.now() * 0.0008
        int   n = _animVerts.Length;

        for (int i = 0; i < n; i++)
        {
            float x = _baseVerts[i].x;
            float z = _baseVerts[i].z;

            // Exact 3-wave formula from world.js
            float wave =
                Mathf.Sin(x * 0.04f + t * 1.8f) * 0.55f +
                Mathf.Cos(z * 0.05f + t * 1.5f) * 0.45f +
                Mathf.Sin((x + z) * 0.07f + t * 2.4f) * 0.30f;

            _animVerts[i] = new Vector3(x, wave, z);
        }

        _mesh.vertices = _animVerts;
        // Skip RecalculateNormals for performance — ocean uses diffuse lighting
        // which tolerates slightly stale normals (same decision as world.js)
    }
}
