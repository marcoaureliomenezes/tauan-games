export const invalidMapCases = [
  {
    name: 'floating target',
    mapId: 'rio',
    mutate(targets) {
      targets[0].y += 20;
    },
    expectedCode: 'TARGET_NOT_GROUNDED',
  },
  {
    name: 'buried target',
    mapId: 'desert',
    mutate(targets) {
      targets[0].y -= 20;
    },
    expectedCode: 'TARGET_NOT_GROUNDED',
  },
  {
    name: 'nan coordinate',
    mapId: 'rio',
    mutate(targets) {
      targets[0].x = Number.NaN;
    },
    expectedCode: 'TARGET_COORDINATE_INVALID',
  },
  {
    name: 'out of bounds',
    mapId: 'desert',
    mutate(targets) {
      targets[0].x = 99999;
    },
    expectedCode: 'TARGET_OUT_OF_BOUNDS',
  },
  {
    name: 'duplicate overlap',
    mapId: 'rio',
    mutate(targets) {
      targets[1].x = targets[0].x;
      targets[1].z = targets[0].z;
      targets[1].y = targets[0].y;
    },
    expectedCode: 'TARGET_OVERLAP',
  },
  {
    name: 'invalid region',
    mapId: 'desert',
    mutate(targets) {
      targets[0].regionIdx = 999;
      targets[0].region = undefined;
    },
    expectedCode: 'TARGET_REGION_INVALID',
  },
  // Fixture: central mesa overlaps runway — a target placed at the runway center would
  // be computed at mesa height (≈45 m) rather than airport elevation (0), triggering
  // TARGET_NOT_GROUNDED. This exercises the same path the RUNWAY_NOT_FLAT sweep guards.
  {
    name: 'central-mesa runway overlap',
    mapId: 'desert',
    mutate(targets) {
      // Move first target to the runway center (x=-160, z=120) and set y=45
      // (mesa peak height), simulating terrain poking through the runway.
      targets[0].x = -160;
      targets[0].z = 120;
      targets[0].region = null;
      targets[0].regionIdx = -1;
      targets[0].y = 45;  // mesa peak, not airport elevation (0)
    },
    expectedCode: 'TARGET_NOT_GROUNDED',
  },
];
