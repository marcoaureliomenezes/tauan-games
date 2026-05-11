// TargetFactory.cs — Industrial factory: main hall + chimney stack + smoke emitter.
// Port of makeFactory() from targets.js. Chimney emits continuous smoke while alive.

using UnityEngine;

public class TargetFactory : TargetBase
{
    private ParticleSystem _chimneySmoke;
    private ExplosionSystem _fxCache;

    protected override void Awake()
    {
        base.Awake();
        BuildMesh();
    }

    private void Start()
    {
        _fxCache = FindFirstObjectByType<ExplosionSystem>();
    }

    private void BuildMesh()
    {
        Material wallMat    = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.48f, 0.44f, 0.38f) };
        Material roofMat    = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.35f, 0.32f, 0.28f) };
        Material chimneyMat = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.22f, 0.22f, 0.22f) };

        // Main hall
        GameObject hall = GameObject.CreatePrimitive(PrimitiveType.Cube);
        hall.transform.SetParent(transform, false);
        hall.transform.localPosition = new Vector3(0f, 2.5f, 0f);
        hall.transform.localScale    = new Vector3(10f, 5f, 7f);
        hall.GetComponent<Renderer>().material = wallMat;
        Destroy(hall.GetComponent<Collider>());

        // Roof ridge
        GameObject roof = GameObject.CreatePrimitive(PrimitiveType.Cube);
        roof.transform.SetParent(transform, false);
        roof.transform.localPosition = new Vector3(0f, 5.5f, 0f);
        roof.transform.localRotation = Quaternion.Euler(0f, 0f, 0f);
        roof.transform.localScale    = new Vector3(10f, 1f, 7f);
        roof.GetComponent<Renderer>().material = roofMat;
        Destroy(roof.GetComponent<Collider>());

        // Side annex
        GameObject annex = GameObject.CreatePrimitive(PrimitiveType.Cube);
        annex.transform.SetParent(transform, false);
        annex.transform.localPosition = new Vector3(5f, 1.5f, 1f);
        annex.transform.localScale    = new Vector3(4f, 3f, 5f);
        annex.GetComponent<Renderer>().material = wallMat;
        Destroy(annex.GetComponent<Collider>());

        // Chimney stack
        GameObject chimney = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        chimney.transform.SetParent(transform, false);
        chimney.transform.localPosition = new Vector3(-3f, 7f, 2f);
        chimney.transform.localScale    = new Vector3(0.8f, 4f, 0.8f);
        chimney.GetComponent<Renderer>().material = chimneyMat;
        Destroy(chimney.GetComponent<Collider>());

        // Chimney smoke particle system
        GameObject smokeGo = new GameObject("ChimneySmoke");
        smokeGo.transform.SetParent(transform, false);
        smokeGo.transform.localPosition = new Vector3(-3f, 11.5f, 2f);
        _chimneySmoke = smokeGo.AddComponent<ParticleSystem>();
        var main      = _chimneySmoke.main;
        main.startLifetime  = 4f;
        main.startSpeed     = 1.5f;
        main.startSize      = 1.2f;
        main.startColor     = new Color(0.55f, 0.55f, 0.55f, 0.6f);
        main.maxParticles   = 60;
        var emission = _chimneySmoke.emission;
        emission.rateOverTime = 8f;
        var shape = _chimneySmoke.shape;
        shape.shapeType = ParticleSystemShapeType.Circle;
        shape.radius    = 0.3f;

        // Collider
        BoxCollider bc = gameObject.AddComponent<BoxCollider>();
        bc.center = new Vector3(0f, 3f, 0f);
        bc.size   = new Vector3(14f, 6f, 7f);
    }

    protected override void OnKilled()
    {
        if (_chimneySmoke != null) _chimneySmoke.Stop();
        if (_fxCache == null) return;
        _fxCache.SpawnExplosion(transform.position,                            ExplosionSize.Large);
        _fxCache.SpawnExplosion(transform.position + new Vector3(-3f, 0f, 2f), ExplosionSize.Medium);
        _fxCache.SpawnExplosion(transform.position + new Vector3( 3f, 1f, 0f), ExplosionSize.Small);
    }
}
