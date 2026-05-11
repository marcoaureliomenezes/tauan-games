// TargetAAGun.cs — Anti-aircraft gun: tracks player and fires enemy bullets.
// Exact port of the aaGun target from targets.js.

using UnityEngine;

public class TargetAAGun : TargetBase
{
    private float _fireTimer       = 0f;
    private float _fireInterval   = GameConfig.AA_BASE_INTERVAL;
    private float _range          = GameConfig.AA_RANGE;

    private Transform        _barrels;         // child rotated to aim
    private FlightController _playerCache;     // cached — FindFirstObjectByType only in Start
    private ExplosionSystem  _fxCache;

    protected override void Awake()
    {
        base.Awake();
        BuildAAGunMesh();
    }

    private void Start()
    {
        _playerCache = FindFirstObjectByType<FlightController>();
        _fxCache     = FindFirstObjectByType<ExplosionSystem>();
    }

    public override void InitStats(TargetType type, int hpBonus, int missionNum)
    {
        base.InitStats(type, hpBonus, missionNum);
        float speedup   = Mathf.Min(GameConfig.AA_MAX_SPEEDUP, (missionNum - 1) * GameConfig.AA_CYCLE_SPEEDUP);
        _fireInterval   = GameConfig.AA_BASE_INTERVAL - speedup;
        _fireTimer      = 1.0f + Random.Range(0f, 2.0f);
    }

    private void BuildAAGunMesh()
    {
        Material baseMat   = new Material(Shader.Find("Universal Render Pipeline/Lit"))
            { color = new Color(0.33f, 0.29f, 0.23f) };
        Material turretMat = new Material(Shader.Find("Universal Render Pipeline/Lit"))
            { color = new Color(0.23f, 0.23f, 0.17f) };
        Material barrelMat = new Material(Shader.Find("Universal Render Pipeline/Lit"))
            { color = new Color(0.13f, 0.13f, 0.13f) };

        // Base platform
        GameObject baseObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        baseObj.transform.SetParent(transform, false);
        baseObj.transform.localPosition = new Vector3(0f, 0.4f, 0f);
        baseObj.transform.localScale    = new Vector3(2.4f, 0.4f, 2.4f);
        baseObj.GetComponent<Renderer>().material = baseMat;
        Destroy(baseObj.GetComponent<Collider>());

        // Turret body
        GameObject turret = GameObject.CreatePrimitive(PrimitiveType.Cube);
        turret.transform.SetParent(transform, false);
        turret.transform.localPosition = new Vector3(0f, 1.1f, 0f);
        turret.transform.localScale    = new Vector3(1.0f, 0.7f, 1.2f);
        turret.GetComponent<Renderer>().material = turretMat;
        Destroy(turret.GetComponent<Collider>());

        // Barrels group (rotated to track player)
        GameObject barrelsGo = new GameObject("Barrels");
        barrelsGo.transform.SetParent(transform, false);
        barrelsGo.transform.localPosition = new Vector3(0f, 1.1f, 0f);
        _barrels = barrelsGo.transform;

        for (int side = -1; side <= 1; side += 2)
        {
            GameObject bar = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            bar.transform.SetParent(barrelsGo.transform, false);
            bar.transform.localPosition = new Vector3(side * 0.25f, 0.6f, -0.8f);
            bar.transform.localRotation = Quaternion.Euler(-45f, 0f, 0f);
            bar.transform.localScale    = new Vector3(0.16f, 1.1f, 0.16f);
            bar.GetComponent<Renderer>().material = barrelMat;
            Destroy(bar.GetComponent<Collider>());
        }

        // Collider for the gun
        BoxCollider bc = gameObject.AddComponent<BoxCollider>();
        bc.center      = new Vector3(0f, 0.9f, 0f);
        bc.size        = new Vector3(1.4f, 1.8f, 1.4f);
    }

    private void Update()
    {
        if (IsDead || !GameState.Instance.Running) return;

        FlightController player = _playerCache;
        if (player == null) return;

        Vector3 jetPos  = player.WorldPosition;
        float   distSq  = (transform.position - jetPos).sqrMagnitude;

        if (distSq > _range * _range) return;

        // Aim barrels
        Vector3 toPlayer  = jetPos - transform.position;
        float   angleY    = Mathf.Atan2(toPlayer.x, toPlayer.z) * Mathf.Rad2Deg;
        transform.rotation = Quaternion.Euler(0f, angleY, 0f);

        _fireTimer -= Time.deltaTime;
        if (_fireTimer <= 0f)
        {
            _fireTimer = _fireInterval + Random.Range(0f, 0.4f);
            FireAtPlayer(jetPos);
        }
    }

    private void FireAtPlayer(Vector3 jetPos)
    {
        Vector3 origin    = transform.position + Vector3.up * 1.8f;
        Vector3 direction = (jetPos - origin).normalized;
        WeaponSystem.SpawnEnemyBullet(origin, direction);
    }

    protected override void OnKilled()
    {
        if (_fxCache != null) _fxCache.SpawnExplosion(transform.position, ExplosionSize.Small);
    }
}
