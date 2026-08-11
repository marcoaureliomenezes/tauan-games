// Web game package: james-bond.
const PLAYER_RADIUS = 0.34;
const PLAYER_HALF_HEIGHT = 0.92;

export async function createPhysics() {
  let boxes = [];
  let player = { x: 0, y: 1, z: 0 };
  let playerReady = false;

  function reset() {
    boxes = [];
    playerReady = false;
  }

  function addBox(x, y, z, hx, hy, hz) {
    const box = { x, y, z, hx, hy, hz };
    boxes.push(box);
    return box;
  }

  function createPlayer(position) {
    player = { x: position.x, y: position.y, z: position.z };
    playerReady = true;
  }

  function movePlayer(desired) {
    if (!playerReady) return desired;
    const nextY = Math.max(1, player.y + desired.y);
    const nextX = player.x + desired.x;
    if (!collides(nextX, nextY, player.z)) player.x = nextX;
    const nextZ = player.z + desired.z;
    if (!collides(player.x, nextY, nextZ)) player.z = nextZ;
    player.y = nextY;
    return desired;
  }

  function collides(x, y, z) {
    return boxes.some((box) => {
      const vertical = y - PLAYER_HALF_HEIGHT < box.y + box.hy && y + PLAYER_HALF_HEIGHT > box.y - box.hy;
      return vertical && Math.abs(x - box.x) < box.hx + PLAYER_RADIUS && Math.abs(z - box.z) < box.hz + PLAYER_RADIUS;
    });
  }

  reset();
  return {
    reset,
    addBox,
    createPlayer,
    movePlayer,
    position: () => player,
    get staticColliderCount() { return boxes.length; },
  };
}
