// Bullet.cs — Pooled projectile for both player cannon and enemy AA guns.
// Uses BoxCollider trigger for hit detection. Pool return happens in WeaponSystem.

using UnityEngine;

[RequireComponent(typeof(Collider))]
public class Bullet : MonoBehaviour
{
    private Vector3 _velocity;
    private float   _lifeTime;
    private bool    _isEnemy;

    private void Awake()
    {
        // Ensure trigger is set
        Collider col = GetComponent<Collider>();
        if (col != null) col.isTrigger = true;
    }

    /// Initialize bullet state and activate it.
    public void Launch(Vector3 position, Vector3 direction, bool isEnemy)
    {
        transform.position = position;
        transform.rotation = Quaternion.LookRotation(direction);

        float speed = isEnemy ? GameConfig.ENEMY_BULLET_SPD : GameConfig.BULLET_SPD;
        _velocity  = direction.normalized * speed;
        _lifeTime  = GameConfig.BULLET_LIFE;
        _isEnemy   = isEnemy;

        gameObject.SetActive(true);
    }

    private void Update()
    {
        transform.position += _velocity * Time.deltaTime;
        _lifeTime          -= Time.deltaTime;
        if (_lifeTime <= 0f)
            gameObject.SetActive(false);
    }

    private void OnTriggerEnter(Collider other)
    {
        if (_isEnemy)
        {
            // Enemy bullet hits player
            if (other.CompareTag("Player"))
            {
                var gs = GameState.Instance;
                if (!gs.IsInvincible)
                {
                    gs.InvincibilityTimer = 1.8f;
                    gs.ShakeTime          = 0.35f;
                    gs.Lives             -= 1;
                    if (gs.Lives <= 0)
                        MissionManager.Instance?.GameOver("AERONAVE DESTRUIDA\nABATIDA POR FOGO INIMIGO");
                    else
                        MissionManager.Instance?.RestartRound();
                }
                gameObject.SetActive(false);
            }
        }
        else
        {
            // Player bullet hits target
            TargetBase target = other.GetComponentInParent<TargetBase>();
            if (target != null && !target.IsDead)
            {
                target.TakeDamage(1);
                gameObject.SetActive(false);
            }
        }
    }
}
