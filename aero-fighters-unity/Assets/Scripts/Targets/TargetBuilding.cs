// TargetBuilding.cs — Tall office/apartment building: tiered floors with windows.
// Port of makeBuilding() from targets.js. Low HP, minimal explosion.

using UnityEngine;

public class TargetBuilding : TargetBase
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
        Material wallMat    = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.75f, 0.72f, 0.65f) };
        Material glassMat   = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.40f, 0.55f, 0.70f) };
        Material topMat     = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.60f, 0.58f, 0.50f) };

        float height = 8f + Random.Range(0f, 6f);

        // Main tower
        GameObject tower = GameObject.CreatePrimitive(PrimitiveType.Cube);
        tower.transform.SetParent(transform, false);
        tower.transform.localPosition = new Vector3(0f, height * 0.5f, 0f);
        tower.transform.localScale    = new Vector3(4f, height, 4f);
        tower.GetComponent<Renderer>().material = wallMat;
        Destroy(tower.GetComponent<Collider>());

        // Window strip (glass band mid-height)
        GameObject windows = GameObject.CreatePrimitive(PrimitiveType.Cube);
        windows.transform.SetParent(transform, false);
        windows.transform.localPosition = new Vector3(0f, height * 0.55f, 0f);
        windows.transform.localScale    = new Vector3(4.02f, height * 0.4f, 4.02f);
        windows.GetComponent<Renderer>().material = glassMat;
        Destroy(windows.GetComponent<Collider>());

        // Roof cap
        GameObject cap = GameObject.CreatePrimitive(PrimitiveType.Cube);
        cap.transform.SetParent(transform, false);
        cap.transform.localPosition = new Vector3(0f, height + 0.5f, 0f);
        cap.transform.localScale    = new Vector3(4.4f, 1f, 4.4f);
        cap.GetComponent<Renderer>().material = topMat;
        Destroy(cap.GetComponent<Collider>());

        // Antenna
        GameObject antenna = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        antenna.transform.SetParent(transform, false);
        antenna.transform.localPosition = new Vector3(0f, height + 2.5f, 0f);
        antenna.transform.localScale    = new Vector3(0.12f, 1.5f, 0.12f);
        antenna.GetComponent<Renderer>().material = topMat;
        Destroy(antenna.GetComponent<Collider>());

        // Collider
        BoxCollider bc = gameObject.AddComponent<BoxCollider>();
        bc.center = new Vector3(0f, height * 0.5f, 0f);
        bc.size   = new Vector3(4f, height, 4f);
    }

    protected override void OnKilled()
    {
        if (_fxCache == null) return;
        _fxCache.SpawnExplosion(transform.position, ExplosionSize.Medium);
        _fxCache.SpawnExplosion(transform.position + Vector3.up * 4f, ExplosionSize.Small);
    }
}
