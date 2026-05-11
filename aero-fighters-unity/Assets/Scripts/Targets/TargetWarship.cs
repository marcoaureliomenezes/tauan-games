// TargetWarship.cs — Naval warship: moves slowly along a patrol path, fires flak.
// Used in the Rio map. Port of makeWarship() from targets.js.

using UnityEngine;

public class TargetWarship : TargetBase
{
    private Vector3[]  _patrolPath;
    private int        _pathIdx   = 0;
    private float      _speed     = GameConfig.WARSHIP_SPEED;
    private float      _fireTimer = 2f;
    private float      _fireInterval;

    private FlightController _playerCache;
    private ExplosionSystem  _fxCache;

    protected override void Awake()
    {
        base.Awake();
        BuildMesh();
    }

    private void Start()
    {
        _playerCache  = FindFirstObjectByType<FlightController>();
        _fxCache      = FindFirstObjectByType<ExplosionSystem>();
        _fireInterval = GameConfig.AA_BASE_INTERVAL * 1.4f;

        // Default patrol if none assigned
        if (_patrolPath == null || _patrolPath.Length < 2)
        {
            Vector3 p = transform.position;
            _patrolPath = new Vector3[]
            {
                p + new Vector3(-80f, 0f, 0f),
                p + new Vector3( 80f, 0f, 0f),
            };
        }
    }

    /// Assign patrol waypoints from MissionManager before spawn.
    public void SetPatrolPath(Vector3[] path) => _patrolPath = path;

    private void Update()
    {
        if (IsDead || !GameState.Instance.Running) return;

        MoveAlongPath();

        _fireTimer -= Time.deltaTime;
        if (_fireTimer <= 0f && _playerCache != null)
        {
            float dist = Vector3.Distance(transform.position, _playerCache.WorldPosition);
            if (dist < GameConfig.AA_RANGE)
            {
                _fireTimer = _fireInterval + Random.Range(0f, 0.5f);
                FireAtPlayer();
            }
            else
            {
                _fireTimer = 1f;
            }
        }
    }

    private void MoveAlongPath()
    {
        if (_patrolPath == null || _patrolPath.Length == 0) return;

        Vector3 target = _patrolPath[_pathIdx];
        Vector3 dir    = (target - transform.position);
        dir.y = 0f;

        if (dir.sqrMagnitude < 4f)
        {
            _pathIdx = (_pathIdx + 1) % _patrolPath.Length;
        }
        else
        {
            transform.position += dir.normalized * _speed * Time.deltaTime;
            transform.rotation  = Quaternion.LookRotation(dir.normalized, Vector3.up);
        }
    }

    private void FireAtPlayer()
    {
        Vector3 origin    = transform.position + Vector3.up * 5f;
        Vector3 direction = (_playerCache.WorldPosition - origin).normalized;
        WeaponSystem.SpawnEnemyBullet(origin, direction);
    }

    private void BuildMesh()
    {
        Material hullMat   = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.25f, 0.27f, 0.30f) };
        Material deckMat   = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.32f, 0.33f, 0.30f) };
        Material superMat  = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.40f, 0.40f, 0.38f) };
        Material gunMat    = new Material(Shader.Find("Universal Render Pipeline/Lit")) { color = new Color(0.20f, 0.20f, 0.18f) };

        // Hull
        GameObject hull = GameObject.CreatePrimitive(PrimitiveType.Cube);
        hull.transform.SetParent(transform, false);
        hull.transform.localPosition = new Vector3(0f, 1f, 0f);
        hull.transform.localScale    = new Vector3(6f, 2f, 22f);
        hull.GetComponent<Renderer>().material = hullMat;
        Destroy(hull.GetComponent<Collider>());

        // Deck
        GameObject deck = GameObject.CreatePrimitive(PrimitiveType.Cube);
        deck.transform.SetParent(transform, false);
        deck.transform.localPosition = new Vector3(0f, 2.1f, 0f);
        deck.transform.localScale    = new Vector3(5.5f, 0.2f, 21f);
        deck.GetComponent<Renderer>().material = deckMat;
        Destroy(deck.GetComponent<Collider>());

        // Superstructure
        GameObject super = GameObject.CreatePrimitive(PrimitiveType.Cube);
        super.transform.SetParent(transform, false);
        super.transform.localPosition = new Vector3(0f, 4.5f, 2f);
        super.transform.localScale    = new Vector3(3.5f, 5f, 6f);
        super.GetComponent<Renderer>().material = superMat;
        Destroy(super.GetComponent<Collider>());

        // Mast
        GameObject mast = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        mast.transform.SetParent(transform, false);
        mast.transform.localPosition = new Vector3(0f, 9f, 2f);
        mast.transform.localScale    = new Vector3(0.2f, 2.5f, 0.2f);
        mast.GetComponent<Renderer>().material = gunMat;
        Destroy(mast.GetComponent<Collider>());

        // Bow gun
        GameObject gun = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        gun.transform.SetParent(transform, false);
        gun.transform.localPosition = new Vector3(0f, 2.5f, -7f);
        gun.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
        gun.transform.localScale    = new Vector3(0.5f, 2.5f, 0.5f);
        gun.GetComponent<Renderer>().material = gunMat;
        Destroy(gun.GetComponent<Collider>());

        // Collider
        BoxCollider bc = gameObject.AddComponent<BoxCollider>();
        bc.center = new Vector3(0f, 3f, 0f);
        bc.size   = new Vector3(6f, 6f, 22f);
    }

    protected override void OnKilled()
    {
        if (_fxCache == null) return;
        _fxCache.SpawnExplosion(transform.position,                            ExplosionSize.Large);
        _fxCache.SpawnExplosion(transform.position + new Vector3(0f, 3f, -6f), ExplosionSize.Large);
        _fxCache.SpawnExplosion(transform.position + new Vector3(0f, 0f,  6f), ExplosionSize.Medium);
    }
}
