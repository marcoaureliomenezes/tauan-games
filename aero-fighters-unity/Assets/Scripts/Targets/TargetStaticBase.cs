// TargetStaticBase.cs — Large military base: flat platform + two bunker boxes + radar dish.
// High HP, large explosion on death. Port of makeBase() from targets.js.

using UnityEngine;

public class TargetStaticBase : TargetBase
{
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
        Material groundMat  = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.30f, 0.28f, 0.22f) };
        Material bunkerMat  = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.22f, 0.24f, 0.18f) };
        Material radarMat   = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.55f, 0.55f, 0.60f) };

        // Ground platform
        GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Cube);
        ground.transform.SetParent(transform, false);
        ground.transform.localPosition = new Vector3(0f, 0.5f, 0f);
        ground.transform.localScale    = new Vector3(18f, 1f, 12f);
        ground.GetComponent<Renderer>().material = groundMat;
        Destroy(ground.GetComponent<Collider>());

        // Bunker left
        GameObject b1 = GameObject.CreatePrimitive(PrimitiveType.Cube);
        b1.transform.SetParent(transform, false);
        b1.transform.localPosition = new Vector3(-5f, 2.0f, 0f);
        b1.transform.localScale    = new Vector3(5f, 3f, 4f);
        b1.GetComponent<Renderer>().material = bunkerMat;
        Destroy(b1.GetComponent<Collider>());

        // Bunker right
        GameObject b2 = GameObject.CreatePrimitive(PrimitiveType.Cube);
        b2.transform.SetParent(transform, false);
        b2.transform.localPosition = new Vector3(5f, 1.5f, 2f);
        b2.transform.localScale    = new Vector3(4f, 2f, 3f);
        b2.GetComponent<Renderer>().material = bunkerMat;
        Destroy(b2.GetComponent<Collider>());

        // Radar pole
        GameObject pole = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        pole.transform.SetParent(transform, false);
        pole.transform.localPosition = new Vector3(0f, 4f, -3f);
        pole.transform.localScale    = new Vector3(0.25f, 2.5f, 0.25f);
        pole.GetComponent<Renderer>().material = radarMat;
        Destroy(pole.GetComponent<Collider>());

        // Radar dish
        GameObject dish = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        dish.transform.SetParent(transform, false);
        dish.transform.localPosition = new Vector3(0f, 6.5f, -3f);
        dish.transform.localScale    = new Vector3(1.4f, 0.3f, 1.4f);
        dish.GetComponent<Renderer>().material = radarMat;
        Destroy(dish.GetComponent<Collider>());

        // Collider covering the whole base
        BoxCollider bc = gameObject.AddComponent<BoxCollider>();
        bc.center = new Vector3(0f, 2f, 0f);
        bc.size   = new Vector3(18f, 4f, 12f);
    }

    protected override void OnKilled()
    {
        if (_fxCache == null) return;
        _fxCache.SpawnExplosion(transform.position,                        ExplosionSize.Large);
        _fxCache.SpawnExplosion(transform.position + new Vector3(-4f, 0f, 0f), ExplosionSize.Medium);
        _fxCache.SpawnExplosion(transform.position + new Vector3( 4f, 1f, 2f), ExplosionSize.Medium);
    }
}
