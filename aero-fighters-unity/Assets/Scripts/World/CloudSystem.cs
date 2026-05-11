// CloudSystem.cs — Spawns 60 billboard cloud clusters at random altitudes.
// Clouds drift slowly and wrap around when far from player.

using UnityEngine;

public class CloudSystem : MonoBehaviour
{
    private const float DRIFT_SPEED = 4f;
    private const float ALTITUDE_MIN = 60f;
    private const float ALTITUDE_MAX = 200f;
    private const float SPREAD_RANGE = 1200f;

    private readonly CloudInstance[] _clouds = new CloudInstance[GameConfig.CLOUD_COUNT];
    private Transform _playerTransform;

    private struct CloudInstance
    {
        public GameObject Go;
        public float DriftX;
        public float DriftZ;
    }

    private void Start()
    {
        var fc = FindFirstObjectByType<FlightController>();
        if (fc != null) _playerTransform = fc.transform;

        Material cloudMat = new Material(Shader.Find("Universal Render Pipeline/Simple Lit"))
        {
            name        = "CloudMat",
            color       = new Color(1f, 1f, 1f, 0.78f),
        };
        cloudMat.SetFloat("_Surface", 1f); // transparent surface
        cloudMat.SetFloat("_AlphaClip", 0f);

        for (int i = 0; i < GameConfig.CLOUD_COUNT; i++)
        {
            float x = Random.Range(-SPREAD_RANGE, SPREAD_RANGE);
            float y = Random.Range(ALTITUDE_MIN, ALTITUDE_MAX);
            float z = Random.Range(-SPREAD_RANGE, SPREAD_RANGE);

            GameObject go = BuildCloudMesh(cloudMat);
            go.transform.SetParent(transform, false);
            go.transform.position = new Vector3(x, y, z);
            float scale = Random.Range(18f, 55f);
            go.transform.localScale = new Vector3(scale, scale * 0.35f, scale);

            _clouds[i] = new CloudInstance
            {
                Go    = go,
                DriftX = Random.Range(-DRIFT_SPEED, DRIFT_SPEED),
                DriftZ = Random.Range(-DRIFT_SPEED * 0.5f, DRIFT_SPEED * 0.5f),
            };
        }
    }

    private void Update()
    {
        float dt = Time.deltaTime;
        Vector3 playerPos = _playerTransform != null ? _playerTransform.position : Vector3.zero;

        for (int i = 0; i < _clouds.Length; i++)
        {
            ref CloudInstance c = ref _clouds[i];
            if (c.Go == null) continue;

            c.Go.transform.position += new Vector3(c.DriftX * dt, 0f, c.DriftZ * dt);

            // Wrap cloud when it drifts too far from player
            Vector3 diff = c.Go.transform.position - playerPos;
            if (Mathf.Abs(diff.x) > SPREAD_RANGE)
                c.Go.transform.position = new Vector3(playerPos.x - diff.x, c.Go.transform.position.y, c.Go.transform.position.z);
            if (Mathf.Abs(diff.z) > SPREAD_RANGE)
                c.Go.transform.position = new Vector3(c.Go.transform.position.x, c.Go.transform.position.y, playerPos.z - diff.z);
        }
    }

    private static GameObject BuildCloudMesh(Material mat)
    {
        // Build a cloud from 3-5 overlapping spheres
        GameObject root = new GameObject("Cloud");
        int puffCount = Random.Range(3, 6);
        for (int p = 0; p < puffCount; p++)
        {
            GameObject puff = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            puff.transform.SetParent(root.transform, false);
            float px = Random.Range(-0.5f, 0.5f);
            float pz = Random.Range(-0.3f, 0.3f);
            float ps = Random.Range(0.5f, 1f);
            puff.transform.localPosition = new Vector3(px, 0f, pz);
            puff.transform.localScale    = new Vector3(ps, ps * 0.5f, ps);
            puff.GetComponent<Renderer>().sharedMaterial = mat;
            Destroy(puff.GetComponent<Collider>());
        }
        return root;
    }
}
