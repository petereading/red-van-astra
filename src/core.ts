export type V2 = { x: number; z: number };
export const ROUTE: V2[] = [
  { x: 0, z: 40 }, { x: 0, z: -180 }, { x: 180, z: -180 },
  { x: 180, z: -380 }, { x: -20, z: -380 }, { x: -20, z: -580 },
  { x: 220, z: -580 }, { x: 220, z: -760 },
];
export const STREETS = ['北河街', '福華街', '長沙灣道', '界限街', '汝州街', '荔枝角道', '旺角道'];
export const LENGTHS = ROUTE.slice(1).map((p, i) => Math.hypot(p.x - ROUTE[i].x, p.z - ROUTE[i].z));
export const CUMULATIVE = [0];
for (const l of LENGTHS) CUMULATIVE.push(CUMULATIVE.at(-1)! + l);
export const TOTAL_LENGTH = CUMULATIVE.at(-1)!;
export const RUN_SECONDS = 180;
export const CAPACITY = 16;
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function random(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function onRoute(s: number, lateral = 0) {
  s = clamp(s, 0, TOTAL_LENGTH);
  let i = LENGTHS.findIndex((_, i) => s <= CUMULATIVE[i + 1]);
  if (i < 0) i = LENGTHS.length - 1;
  const a = ROUTE[i], b = ROUTE[i + 1], t = (s - CUMULATIVE[i]) / LENGTHS[i];
  const heading = Math.atan2(b.x - a.x, -(b.z - a.z));
  return { x: a.x + (b.x - a.x) * t - Math.cos(heading) * lateral,
    z: a.z + (b.z - a.z) * t - Math.sin(heading) * lateral, heading, segment: i };
}
export function projectRoute(p: V2) {
  let best = { s: 0, distance: Infinity, segment: 0, lateral: 0 };
  LENGTHS.forEach((len, i) => {
    const a = ROUTE[i], b = ROUTE[i + 1], dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (len * len), 0, 1);
    const distance = Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
    if (distance < best.distance) best = { s: CUMULATIVE[i] + t * len, distance, segment: i, lateral: ((p.x - a.x) * dz - (p.z - a.z) * dx) / len };
  });
  return best;
}
export type RiderState = 'waiting' | 'onboard' | 'delivered' | 'missed';
export type Rider = { id: number; pickup: number; dropoff: number; state: RiderState };
export type Stop = V2 & { id: number; s: number; heading: number; name: string; terminal: boolean };
export type Trip = { seed: number; stops: Stop[]; riders: Rider[]; trafficSeed: number };
export function createTrip(seed: number): Trip {
  const rng = random(seed);
  const positions = [100, 285, 475, 675, 880, 1080, 1170, 1340];
  const names = ['北河街街市', '福華街口', '長沙灣道', '界限街轉角', '汝州街', '荔枝角道', '廣東道口', '旺角街市'];
  const stops: Stop[] = positions.map((s, i) => {
    s += (rng() - .5) * 34;
    const p = onRoute(s, 7);
    return { ...p, id: i, s, name: names[i], terminal: false };
  });
  const end = onRoute(TOTAL_LENGTH - 12, 7);
  stops.push({ ...end, id: 8, s: TOTAL_LENGTH - 12, name: '旺角總站', terminal: true });
  const riders: Rider[] = [];
  for (const pickup of [0, 1, 2, 4, 5]) {
    const dropoff = Math.min(7, pickup + 2 + Math.floor(rng() * 2));
    for (let i = 0; i < 2; i++) riders.push({ id: riders.length, pickup, dropoff, state: 'waiting' });
  }
  return { seed, stops, riders, trafficSeed: Math.floor(rng() * 0xffffffff) };
}
export function isStoppedAt(p: V2, heading: number, speed: number, stop: Stop) {
  const dx = p.x - stop.x, dz = p.z - stop.z;
  const along = dx * Math.sin(stop.heading) - dz * Math.cos(stop.heading);
  const across = dx * Math.cos(stop.heading) + dz * Math.sin(stop.heading);
  const angle = Math.abs(angleDiff(heading, stop.heading));
  const halfAcross = 1.1 * Math.cos(angle) + 3.2 * Math.sin(angle);
  const halfAlong = 3.2 * Math.cos(angle) + 1.1 * Math.sin(angle);
  return Math.abs(speed) < .35 && angle < .38 && Math.abs(along) + halfAlong < 6 && Math.abs(across) + halfAcross < 2.6;
}
export type Stats = {
  picked: number; delivered: number; overspeed: number; doorViolations: number;
  objects: number; cars: number; people: number; resets: number; missed: number;
  remaining: number; completed: boolean; safetyPenalty: number;
};
export function newStats(): Stats { return { picked: 0, delivered: 0, overspeed: 0, doorViolations: 0, objects: 0, cars: 0, people: 0, resets: 0, missed: 0, remaining: RUN_SECONDS, completed: false, safetyPenalty: 0 }; }
export function scoreRun(stats: Stats, totalRiders = 10) {
  const route = stats.completed ? 400 : 0;
  const service = Math.round((stats.picked + stats.delivered * 2) / (totalRiders * 3) * 300);
  const time = stats.completed ? Math.round(clamp(stats.remaining * 2, 0, 100)) : 0;
  const safety = Math.max(0, Math.round(200 - stats.safetyPenalty - stats.overspeed * 2 - stats.doorViolations * 40 - stats.resets * 30));
  const total = route + service + time + safety;
  let grade = total >= 900 ? 'S' : total >= 800 ? 'A' : total >= 650 ? 'B' : total >= 500 ? 'C' : 'D';
  if (grade === 'S' && (stats.delivered < Math.ceil(totalRiders * .8) || stats.people || stats.doorViolations)) grade = 'A';
  if (!stats.completed) grade = 'D';
  return { total, grade, route, service, time, safety };
}
export type Controls = { throttle: number; steer: number; handbrake: boolean };
export type DriveState = V2 & { speed: number; heading: number };
export function driveStep(state: DriveState, input: Controls, dt: number, health: number, offroad = false): DriveState {
  let speed = state.speed;
  const max = (health < 35 ? 23 : 31) * (offroad ? .48 : 1);
  if (input.throttle > 0) speed += (speed < 0 ? 11 : 6.8 * (1 - Math.max(0, speed) / (max + 8))) * dt;
  else if (input.throttle < 0) speed -= (speed > .4 ? 14 : 3.8) * dt;
  else speed *= Math.exp(-.28 * dt);
  if (input.handbrake) speed *= Math.exp(-3.1 * dt);
  speed = clamp(speed, -5, max);
  if (Math.abs(speed) < .04) speed = 0;
  const steerRate = 1.65 / (1 + Math.abs(speed) * .032) * Math.min(1, Math.abs(speed) / 3);
  const heading = state.heading + input.steer * steerRate * Math.sign(speed || 1) * dt;
  return { x: state.x + Math.sin(heading) * speed * dt, z: state.z - Math.cos(heading) * speed * dt, speed, heading };
}
