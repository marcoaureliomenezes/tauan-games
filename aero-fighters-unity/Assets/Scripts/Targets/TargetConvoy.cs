// TargetConvoy.cs — Military convoy target (5 trucks in formation).
// Builds convoy mesh procedurally in Awake; no external assets needed.

using UnityEngine;

public class TargetConvoy : TargetBase
{
    [Header("Convoy Settings")]
    [SerializeField] private int TruckCount = 5;
    [SerializeField] private float TruckSpacing = 4f;

    protected override void Awake()
    {
        base.Awake();
        BuildConvoyMesh();
    }

    private void BuildConvoyMesh()
    {
        Material cabMat  = new Material(Shader.Find("Universal Render Pipeline/Lit"))
            { color = new Color(0.29f, 0.31f, 0.25f) };
        Material bedMat  = new Material(Shader.Find("Universal Render Pipeline/Lit"))
            { color = new Color(0.23f, 0.25f, 0.19f) };
        Material tireMat = new Material(Shader.Find("Universal Render Pipeline/Lit"))
            { color = new Color(0.10f, 0.10f, 0.10f) };

        for (int i = 0; i < TruckCount; i++)
        {
            GameObject truck = new GameObject($"Truck_{i}");
            truck.transform.SetParent(transform, false);
            truck.transform.localPosition = new Vector3(0f, 0f, i * TruckSpacing - (TruckCount - 1) * TruckSpacing * 0.5f);

            // Cab
            GameObject cab = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cab.transform.SetParent(truck.transform, false);
            cab.transform.localPosition = new Vector3(0f, 0.95f, -0.6f);
            cab.transform.localScale    = new Vector3(1.4f, 1.2f, 1.0f);
            cab.GetComponent<Renderer>().material = cabMat;
            Destroy(cab.GetComponent<Collider>());

            // Bed
            GameObject bed = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bed.transform.SetParent(truck.transform, false);
            bed.transform.localPosition = new Vector3(0f, 0.9f, 0.9f);
            bed.transform.localScale    = new Vector3(1.4f, 1.1f, 1.8f);
            bed.GetComponent<Renderer>().material = bedMat;
            Destroy(bed.GetComponent<Collider>());

            // Wheels
            float[] wx = { -0.65f, 0.65f, -0.65f, 0.65f };
            float[] wz = { -0.5f, -0.5f, 1.4f, 1.4f };
            for (int w = 0; w < 4; w++)
            {
                GameObject wheel = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                wheel.transform.SetParent(truck.transform, false);
                wheel.transform.localPosition = new Vector3(wx[w], 0.32f, wz[w]);
                wheel.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
                wheel.transform.localScale    = new Vector3(0.32f, 0.11f, 0.32f);
                wheel.GetComponent<Renderer>().material = tireMat;
                Destroy(wheel.GetComponent<Collider>());
            }
        }

        // Add single box collider for the whole convoy
        BoxCollider bc  = gameObject.AddComponent<BoxCollider>();
        bc.center       = new Vector3(0f, 0.9f, 0f);
        bc.size         = new Vector3(1.6f, 1.5f, TruckCount * TruckSpacing);
        bc.isTrigger    = false;
    }

    protected override void OnKilled()
    {
        var fx = FindFirstObjectByType<ExplosionSystem>();
        if (fx != null)
        {
            fx.SpawnExplosion(transform.position, ExplosionSize.Medium);
            fx.SpawnShockwave(transform.position, 22f);
        }
    }
}
