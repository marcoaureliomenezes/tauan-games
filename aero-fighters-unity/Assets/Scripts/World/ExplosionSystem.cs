// ExplosionSystem.cs — Centralized VFX spawner for explosions, shockwaves,
// missile smoke, and nuclear blasts. Uses a simple particle pool approach.

using UnityEngine;

public enum ExplosionSize { Small, Medium, Large }

public class ExplosionSystem : MonoBehaviour
{
    [Header("Materials")]
    public Material ExplosionMaterial;
    public Material SmokeMaterial;
    public Material ShockwaveMaterial;

    // ── Particle pool ─────────────────────────────────────────────────────────
    private const int POOL_SIZE = 120;
    private readonly ExplosionParticle[] _pool = new ExplosionParticle[POOL_SIZE];
    private int _poolHead = 0;

    private struct ExplosionParticle
    {
        public GameObject Go;
        public float Life;
        public float MaxLife;
        public Vector3 Velocity;
        public float StartScale;
        public bool Active;
    }

    private void Awake()
    {
        Material mat = ExplosionMaterial != null
            ? ExplosionMaterial
            : CreateDefaultMat(new Color(1f, 0.5f, 0.1f, 1f));

        for (int i = 0; i < POOL_SIZE; i++)
        {
            GameObject go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = $"FXParticle_{i}";
            go.transform.SetParent(transform, false);
            go.GetComponent<Renderer>().material = mat;
            Destroy(go.GetComponent<Collider>());
            go.SetActive(false);
            _pool[i] = new ExplosionParticle { Go = go };
        }
    }

    private void Update()
    {
        float dt = Time.deltaTime;
        for (int i = 0; i < POOL_SIZE; i++)
        {
            ref ExplosionParticle p = ref _pool[i];
            if (!p.Active) continue;

            p.Life -= dt;
            if (p.Life <= 0f)
            {
                p.Active = false;
                p.Go.SetActive(false);
                continue;
            }

            // Move
            p.Go.transform.position += p.Velocity * dt;
            p.Velocity += Vector3.down * 6f * dt;  // light gravity

            // Shrink as life expires
            float t      = p.Life / p.MaxLife;
            float scale  = p.StartScale * t;
            p.Go.transform.localScale = Vector3.one * scale;

            // Fade via material color alpha
            Renderer rend = p.Go.GetComponent<Renderer>();
            if (rend != null)
            {
                Color c = rend.material.color;
                c.a = t;
                rend.material.color = c;
            }
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public void SpawnExplosion(Vector3 pos, ExplosionSize size)
    {
        int count      = size == ExplosionSize.Large ? 30 : size == ExplosionSize.Medium ? 15 : 8;
        float maxScale = size == ExplosionSize.Large ? 8f : size == ExplosionSize.Medium ? 4f : 2f;
        float speed    = size == ExplosionSize.Large ? 22f : 14f;
        float life     = size == ExplosionSize.Large ? 1.8f : 1.2f;

        for (int i = 0; i < count; i++)
            EmitParticle(pos,
                Random.insideUnitSphere.normalized * Random.Range(0.3f, 1f) * speed,
                Random.Range(maxScale * 0.4f, maxScale),
                life);
    }

    public void SpawnShockwave(Vector3 pos, float radius)
    {
        // Flat ring expanding outward (fake it with a disc that scales up)
        if (ShockwaveMaterial == null) return;
        GameObject ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        ring.transform.position   = pos + Vector3.up * 0.5f;
        ring.transform.localScale = new Vector3(1f, 0.05f, 1f);
        ring.GetComponent<Renderer>().material = ShockwaveMaterial;
        Destroy(ring.GetComponent<Collider>());

        StartCoroutine(AnimateShockwave(ring.transform, radius, 0.6f));
    }

    private System.Collections.IEnumerator AnimateShockwave(Transform ring, float maxRadius, float duration)
    {
        float t = 0f;
        while (t < duration)
        {
            t += Time.deltaTime;
            float s = Mathf.Lerp(1f, maxRadius * 2f, t / duration);
            ring.localScale = new Vector3(s, 0.05f, s);
            Renderer r = ring.GetComponent<Renderer>();
            if (r != null)
            {
                Color c = r.material.color;
                c.a = 1f - t / duration;
                r.material.color = c;
            }
            yield return null;
        }
        Destroy(ring.gameObject);
    }

    public void SpawnNuclearExplosion(Vector3 pos)
    {
        SpawnExplosion(pos, ExplosionSize.Large);
        SpawnShockwave(pos, GameConfig.NUCLEAR_BLAST_RADIUS);
        // Second ring
        SpawnShockwave(pos + Vector3.up * 5f, GameConfig.NUCLEAR_BLAST_RADIUS * 0.6f);
    }

    public void SpawnMissileSmoke(Vector3 pos)
    {
        // Small grey puff
        EmitParticle(pos,
            Random.insideUnitSphere * 2f,
            Random.Range(0.8f, 1.8f),
            0.6f,
            isSomke: true);
    }

    // ── Pool emit ─────────────────────────────────────────────────────────────
    private void EmitParticle(Vector3 pos, Vector3 vel, float scale, float life, bool isSomke = false)
    {
        // Find inactive slot
        for (int attempt = 0; attempt < POOL_SIZE; attempt++)
        {
            int idx = (_poolHead + attempt) % POOL_SIZE;
            ref ExplosionParticle p = ref _pool[idx];
            if (p.Active) continue;

            _poolHead = (idx + 1) % POOL_SIZE;
            p.Active      = true;
            p.Life        = life;
            p.MaxLife     = life;
            p.Velocity    = vel;
            p.StartScale  = scale;
            p.Go.transform.position   = pos;
            p.Go.transform.localScale = Vector3.one * scale;
            p.Go.SetActive(true);

            Renderer rend = p.Go.GetComponent<Renderer>();
            if (rend != null)
            {
                Color c = isSomke
                    ? new Color(0.45f, 0.45f, 0.45f, 1f)
                    : new Color(1f, 0.45f + Random.value * 0.2f, 0.05f, 1f);
                rend.material.color = c;
            }
            return;
        }
        // Pool full — silently drop (no allocation in hot path)
    }

    private static Material CreateDefaultMat(Color color)
    {
        Material m = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        m.color = color;
        m.SetFloat("_Surface", 1f); // transparent
        return m;
    }
}
