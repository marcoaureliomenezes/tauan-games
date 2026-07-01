export function segmentLength(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export function routeLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += segmentLength(points[i - 1], points[i]);
  return total;
}

export function samplePolyline(points, distance, total = routeLength(points)) {
  let d = ((distance % total) + total) % total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const len = segmentLength(a, b);
    if (d <= len) {
      const t = len > 0 ? d / len : 0;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      return { x, z, ang: Math.atan2(b.x - a.x, b.z - a.z), segmentIndex: i - 1, total };
    }
    d -= len;
  }
  const a = points[points.length - 2], b = points[points.length - 1];
  return { x: b.x, z: b.z, ang: Math.atan2(b.x - a.x, b.z - a.z), segmentIndex: points.length - 2, total };
}
