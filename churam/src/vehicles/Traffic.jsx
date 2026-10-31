import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { ActiveCollisionTypes } from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { ROAD } from '../road/roadData.js';
import { buildTrafficModel, TRAFFIC_KINDS, trafficSpec } from './VehicleModels.js';
import { GRAPHICS } from '../config/graphics.js';
import { useStore } from '../core/store.js';
import { player } from '../core/shared.js';
import { mulberry32, clamp } from '../core/noise.js';
import { audio } from '../core/audio.js';

const _p = {}, _e = new THREE.Euler(), _hp = {};

export default function Traffic() {
  const count = GRAPHICS[useStore((s) => s.settings.graphics)].traffic;
  const agents = useMemo(() => {
    const R = mulberry32(101);
    return Array.from({ length: count }, (_, i) => {
      const kind = TRAFFIC_KINDS[i % TRAFFIC_KINDS.length];
      const dir = i % 2 === 0 ? 1 : -1; // 50% uphill (climbing with player), 50% oncoming downhill
      const model = buildTrafficModel(kind, i);
      const spec = trafficSpec(kind) || { w: 1.8, l: 4.0, h: 1.5, mass: 1200 };
      const laneOffset = kind === 'auto' ? (dir > 0 ? -0.35 : 0.35) : 0;
      const baseLat = (dir > 0 ? -ROAD.lane : ROAD.lane) + laneOffset;
      const aggression = 0.95 + R() * 0.35;
      return {
        id: i,
        kind,
        spec,
        dir,
        model,
        aggression,
        u: 0,
        speed: 0,
        curSpeed: 0,
        lat: baseLat,
        targetLat: baseLat,
        effectiveLat: baseLat,
        baseLat,
        steerAngle: 0,
        overtakeState: 'none', // 'none' | 'passing' | 'returning'
        overtakeTimer: 0,
        overtakeCooldown: 1.0 + R() * 3.0,
        overtakeTargetU: 0,
        overtakeTargetLength: 4.0,
        overtakeTargetWidth: 1.8,
        hornCooldown: 1.0 + R() * 3.0,
        holdingForHairpin: null,
        yieldingToFreeSpace: false,
        reversingTimer: 0,
        deadlockTimer: 0,
        stuckTimer: 0,
        R,
      };
    });
  }, [count]);

  useEffect(() => () => agents.forEach((a) => a.model.dispose()), [agents]);
  const refs = useRef([]);

  const respawn = (a, first) => {
    const pu = player.ready ? player.u : ROAD.startIndex;
    let spawnU;

    if (first) {
      if (a.dir > 0) {
        // Spread uphill vehicles: some ahead, some behind player to catch up
        if (a.id % 3 === 0) {
          spawnU = pu - (25 + (a.id % 3) * 25) / ROAD.ds; // behind player
        } else {
          spawnU = pu + (30 + a.id * 24) / ROAD.ds; // ahead
        }
      } else {
        spawnU = pu + (90 + a.id * 32) / ROAD.ds; // oncoming downhill
      }
    } else {
      if (a.dir > 0) {
        // 45% chance to spawn 30m - 70m behind player and rapidly catch up & overtake!
        if (a.R() < 0.45) {
          spawnU = pu - (30 + a.R() * 40) / ROAD.ds;
        } else {
          spawnU = pu + (50 + a.R() * 160) / ROAD.ds;
        }
      } else {
        spawnU = pu + (75 + a.R() * 200) / ROAD.ds;
      }
    }

    // Never spawn directly inside or within 22m of a hairpin bend
    for (const h of ROAD.hairpins) {
      if (Math.abs(spawnU - h.index) < 22) {
        spawnU = a.dir > 0 ? h.index - 26 : h.index + 26;
        break;
      }
    }
    a.u = clamp(spawnU, 16, ROAD.n - 20);

    // Realistic vehicle speed hierarchy (m/s):
    const baseSpeeds = {
      bus: 8.8 + a.R() * 2.8,     // 31 - 42 km/h (KSRTC mountain speed)
      lorry: 5.5 + a.R() * 2.0,   // 20 - 27 km/h (Heavy goods truck)
      auto: 6.2 + a.R() * 1.8,    // 22 - 29 km/h (Auto rickshaw)
      car: 11.2 + a.R() * 3.8,    // 40 - 54 km/h (Sedan / Hatchback)
      jeep: 10.4 + a.R() * 3.2,   // 37 - 49 km/h (Mahindra Thar / 4x4)
      bike: 13.5 + a.R() * 4.5,   // 48 - 65 km/h (Royal Enfield / Bike)
    };
    a.speed = (baseSpeeds[a.kind] || 8.5) * a.aggression;
    a.curSpeed = a.speed;
    const laneOffset = a.kind === 'auto' ? (a.dir > 0 ? -0.35 : 0.35) : 0;
    a.baseLat = (a.dir > 0 ? -ROAD.lane : ROAD.lane) + laneOffset;
    a.lat = a.baseLat;
    a.targetLat = a.baseLat;
    a.effectiveLat = a.baseLat;
    a.steerAngle = 0;
    a.overtakeState = 'none';
    a.overtakeTimer = 0;
    a.overtakeCooldown = 1.0 + a.R() * 3.0;
    a.overtakeTargetU = 0;
    a.overtakeTargetLength = 4.0;
    a.overtakeTargetWidth = 1.8;
    a.hornCooldown = 1.0 + a.R() * 3.0;
    a.holdingForHairpin = null;
    a.yieldingToFreeSpace = false;
    a.reversingTimer = 0;
    a.deadlockTimer = 0;
    a.stuckTimer = 0;
  };

  useEffect(() => {
    agents.forEach((a) => respawn(a, true));
  }, [agents]); // eslint-disable-line

  useFrame((_, rawDt) => {
    if (useStore.getState().paused || !player.ready) return;
    const dt = Math.min(rawDt, 0.05);

    // -------------------------------------------------------------------------
    // 1. Hairpin Exclusive Lock & Right-of-Way Arbitration
    // -------------------------------------------------------------------------
    const hairpinStates = ROAD.hairpins.map((h) => {
      const apex = h.index;
      const curveMin = apex - 18;
      const curveMax = apex + 18;
      const holdUphill = apex - 24;    // Hold line before bend for uphill vehicles
      const holdDownhill = apex + 24;  // Hold line before bend for downhill vehicles

      const insideDir = h.turnSign === 1 ? -1 : 1;
      const outsideDir = -insideDir;

      // 1. Check Player Priority:
      const playerDir = player.speed >= -0.5 ? 1 : -1;
      const distPlayerToApex = Math.abs(player.u - apex) * ROAD.ds;
      const playerNearHairpin = player.ready && distPlayerToApex < 48;

      let ownerDir = 0; // 0 = free, 1 = uphill only, -1 = downhill only

      if (playerNearHairpin) {
        ownerDir = playerDir;
      } else {
        const agentsInCurve = agents.filter((a) => a.u >= curveMin && a.u <= curveMax);
        const upInCurve = agentsInCurve.some((a) => a.dir > 0);
        const downInCurve = agentsInCurve.some((a) => a.dir < 0);

        if (upInCurve && !downInCurve) {
          ownerDir = 1;
        } else if (downInCurve && !upInCurve) {
          ownerDir = -1;
        } else if (upInCurve && downInCurve) {
          ownerDir = insideDir;
        } else {
          const insideApproaching = agents.some(
            (a) => a.dir === insideDir && (insideDir > 0 ? (a.u >= apex - 38 && a.u < holdUphill) : (a.u <= apex + 38 && a.u > holdDownhill))
          );
          const outsideApproaching = agents.some(
            (a) => a.dir === outsideDir && (outsideDir > 0 ? (a.u >= apex - 38 && a.u < holdUphill) : (a.u <= apex + 38 && a.u > holdDownhill))
          );

          if (insideApproaching) {
            ownerDir = insideDir; // Inside vehicle has priority to sweep wide
          } else if (outsideApproaching) {
            ownerDir = outsideDir;
          }
        }
      }

      return {
        id: h.id,
        apex,
        turnSign: h.turnSign,
        curveMin,
        curveMax,
        holdUphill,
        holdDownhill,
        insideDir,
        outsideDir,
        ownerDir,
      };
    });

    // -------------------------------------------------------------------------
    // 2. Update Each Traffic Agent
    // -------------------------------------------------------------------------
    agents.forEach((a) => {
      a.hornCooldown = Math.max(0, a.hornCooldown - dt);
      if (a.overtakeCooldown > 0) a.overtakeCooldown -= dt;
      if (a.overtakeTimer > 0) a.overtakeTimer -= dt;

      // Default target lateral coordinate: its base lane
      let targetLat = a.baseLat;

      // Curvature-based cruise speed
      const uIndex = Math.round(clamp(a.u, 0, ROAD.n - 1));
      const curvature = Math.abs(ROAD.kappa[uIndex] || 0);
      const curveFactor = clamp(1.0 - curvature * 4.4, 0.50, 1.0);
      let desiredSpeed = a.speed * curveFactor;

      let mustStop = false;
      let obstacleDist = 999;
      let holdingForHairpin = null;
      let isYieldingToFreeSpace = false;

      // Check current hairpin state
      ROAD.hairpinState(a.u, _hp);

      // -------------------------------------------------------------
      // Hairpin Stop & Hold Logic:
      // If a hairpin is locked by opposing traffic, this vehicle holds at outer shoulder
      // -------------------------------------------------------------
      for (const hp of hairpinStates) {
        if (hp.ownerDir !== 0 && a.dir !== hp.ownerDir && a.reversingTimer <= 0) {
          if (a.dir < 0) {
            // Downhill vehicle approaching from above (or caught near apex)
            if (a.u >= hp.apex - 2 && a.u <= hp.apex + 45) {
              holdingForHairpin = hp;
              if (a.u > hp.holdDownhill) {
                const queueAhead = agents.filter(
                  (b) => b.id !== a.id && b.dir < 0 && b.u > hp.holdDownhill && b.u < a.u
                ).length;
                const designatedStopU = hp.holdDownhill + queueAhead * 5.5;
                const distToStop = (a.u - designatedStopU) * ROAD.ds;

                if (distToStop > 0 && distToStop < 35) {
                  const approachSpeed = clamp((distToStop / 22) * a.speed, 0, a.speed);
                  desiredSpeed = Math.min(desiredSpeed, approachSpeed);
                  targetLat = a.baseLat + 0.65; // Pull to free space shoulder
                }
                if (distToStop <= 1.5) {
                  mustStop = true;
                  desiredSpeed = 0;
                  targetLat = a.baseLat + 0.85;
                }
              } else {
                // Already past hold line: STOP IMMEDIATELY & HUG SHOULDER FREE SPACE!
                mustStop = true;
                desiredSpeed = 0;
                targetLat = a.baseLat + 1.25;
              }
            }
          } else {
            // Uphill vehicle approaching from below (or caught near apex)
            if (a.u <= hp.apex + 2 && a.u >= hp.apex - 45) {
              holdingForHairpin = hp;
              if (a.u < hp.holdUphill) {
                const queueAhead = agents.filter(
                  (b) => b.id !== a.id && b.dir > 0 && b.u < hp.holdUphill && b.u > a.u
                ).length;
                const designatedStopU = hp.holdUphill - queueAhead * 5.5;
                const distToStop = (designatedStopU - a.u) * ROAD.ds;

                if (distToStop > 0 && distToStop < 35) {
                  const approachSpeed = clamp((distToStop / 22) * a.speed, 0, a.speed);
                  desiredSpeed = Math.min(desiredSpeed, approachSpeed);
                  targetLat = a.baseLat - 0.65; // Pull to valley shoulder free space
                }
                if (distToStop <= 1.5) {
                  mustStop = true;
                  desiredSpeed = 0;
                  targetLat = a.baseLat - 0.85;
                }
              } else {
                // Already past hold line: STOP IMMEDIATELY & HUG SHOULDER FREE SPACE!
                mustStop = true;
                desiredSpeed = 0;
                targetLat = a.baseLat - 1.25;
              }
            }
          }
        }
      }
      a.holdingForHairpin = holdingForHairpin ? holdingForHairpin.id : null;

      // -------------------------------------------------------------
      // Hairpin Inside Curve Physics: The Wide Swing
      // -------------------------------------------------------------
      if (_hp.inside && !holdingForHairpin) {
        const hp = ROAD.hairpins[_hp.current - 1];
        if (hp) {
          const hpApex = hp.index;
          const distToApex = Math.abs(a.u - hpApex);
          const isInsideVehicle = (a.dir === (hp.turnSign === 1 ? -1 : 1));

          const apexSpeedCap = a.kind === 'bus' || a.kind === 'lorry' ? 4.8 : 6.8;
          desiredSpeed = Math.min(desiredSpeed, apexSpeedCap);

          if (isInsideVehicle) {
            const swingFactor = Math.exp(-0.5 * ((distToApex / 12.5) ** 2));
            const maxSwing = (a.kind === 'bus' || a.kind === 'lorry') ? 2.65 : (a.kind === 'car' || a.kind === 'jeep') ? 1.35 : 0.6;
            const swingDir = -hp.turnSign;
            targetLat = a.baseLat + swingDir * maxSwing * swingFactor;
          }

          // Blind hairpin horn warning (Kerala signature hill-horn!)
          if (distToApex < 16 && a.hornCooldown <= 0) {
            a.hornCooldown = 4.5;
            const distToCam = Math.hypot(
              player.pos.x - (a.model.group?.position.x || 0),
              player.pos.z - (a.model.group?.position.z || 0)
            );
            const vol = clamp(1 - distToCam / 120, 0, 1);
            if (vol > 0.04) {
              const dur = a.kind === 'bus' || a.kind === 'lorry' ? 0.48 : 0.26;
              audio.horn(a.kind, dur, vol);
            }
          }
        }
      }

      // -------------------------------------------------------------
      // 3. Dynamic Overtaking State Machine (Speed-Up & Safe Pass)
      // Faster vehicles (bikes, cars, jeeps, aggressive buses) overtake!
      // -------------------------------------------------------------
      const nearHairpin = ROAD.hairpins.some((h) => Math.abs(a.u - h.index) < 26);
      const canOvertake =
        (a.kind === 'bike' || a.kind === 'car' || a.kind === 'jeep' || (a.kind === 'bus' && a.aggression > 1.05)) &&
        !_hp.inside &&
        !nearHairpin &&
        !a.holdingForHairpin &&
        a.reversingTimer <= 0;

      // State A: 'none' -> Evaluate whether to initiate overtake
      if (a.overtakeState === 'none' && canOvertake && a.overtakeCooldown <= 0) {
        let leadAhead = null;
        let minLeadDist = 999;
        let leadSpeed = a.speed;
        let leadLength = 4.0;
        let leadWidth = 1.8;

        // Check AI agents ahead in the same lane
        agents.forEach((b) => {
          if (b.id === a.id || b.dir !== a.dir) return;
          const distSpline = (b.u - a.u) * a.dir * ROAD.ds;
          const latDiff = Math.abs(b.lat - a.baseLat);
          if (distSpline > 2.0 && distSpline < 28.0 && latDiff < 1.3) {
            if (distSpline < minLeadDist) {
              minLeadDist = distSpline;
              leadAhead = b;
              leadSpeed = Math.abs(b.curSpeed);
              leadLength = b.spec.l;
              leadWidth = b.spec.w;
            }
          }
        });

        // Check if player is ahead in the same lane (uphill climbing)
        if (a.dir > 0 && player.ready) {
          const playerDistSpline = (player.u - a.u) * ROAD.ds;
          const pLat = player.lat ?? -ROAD.lane;
          const latDiffPlayer = Math.abs(pLat - a.baseLat);
          if (playerDistSpline > 2.0 && playerDistSpline < 28.0 && latDiffPlayer < 1.3) {
            if (playerDistSpline < minLeadDist) {
              minLeadDist = playerDistSpline;
              leadAhead = player;
              leadSpeed = Math.abs(player.speed);
              leadLength = player.length || 2.1;
              leadWidth = player.width || 0.8;
            }
          }
        }

        // If lead vehicle is slower than desired cruising speed:
        if (leadAhead) {
          const speedDiff = a.speed - leadSpeed;
          const wantToPass = speedDiff > 0.8 || (a.kind === 'bike' && leadSpeed < a.speed * 0.96);

          if (wantToPass) {
            const clearRequired = a.kind === 'bike' ? 24 : 44;
            let oncomingClear = true;

            // Check opposing oncoming lane for traffic
            agents.forEach((c) => {
              if (c.dir === a.dir) return;
              const distOpp = (c.u - a.u) * a.dir * ROAD.ds;
              if (distOpp > -4 && distOpp < clearRequired) oncomingClear = false;
            });

            if (oncomingClear) {
              a.overtakeState = 'passing';
              a.overtakeTimer = 5.5;
              a.overtakeTargetU = leadAhead.u;
              a.overtakeTargetLength = leadLength;
              a.overtakeTargetWidth = leadWidth;

              // Alert horn tap
              if (a.hornCooldown <= 0) {
                a.hornCooldown = 3.2;
                const distToCam = Math.hypot(
                  player.pos.x - (a.model.group?.position.x || 0),
                  player.pos.z - (a.model.group?.position.z || 0)
                );
                const vol = clamp(1 - distToCam / 120, 0, 1);
                if (vol > 0.05) audio.horn(a.kind, a.kind === 'bus' ? 0.35 : 0.18, vol * 0.9);
              }
            }
          }
        }
      }

      // State B: 'passing' -> Pull across center line & speed boost past lead
      if (a.overtakeState === 'passing') {
        const passOffset = a.dir > 0 ? 2.5 : -2.5;
        targetLat = a.baseLat + passOffset;

        // Speed boost during overtake (+35% to +45%)
        const boostMultiplier = a.kind === 'bike' ? 1.45 : a.kind === 'car' ? 1.38 : 1.25;
        desiredSpeed = Math.min(a.speed * boostMultiplier, a.kind === 'bike' ? 18.5 : 15.5);

        // Check lateral separation with the vehicle being passed:
        const currentLateralSeparation = Math.abs(a.lat - a.baseLat);
        const minSafeLateralClearance = (a.spec.w + (a.overtakeTargetWidth || 1.8)) / 2 + 0.35;

        // While still pulling out laterally, hold longitudinal speed behind lead vehicle:
        if (currentLateralSeparation < minSafeLateralClearance) {
          const distToTarget = (a.overtakeTargetU - a.u) * a.dir * ROAD.ds;
          const minSafeDist = (a.spec.l + (a.overtakeTargetLength || 4.0)) / 2 + 2.5;
          if (distToTarget > 0 && distToTarget < minSafeDist) {
            desiredSpeed = Math.min(desiredSpeed, a.curSpeed * 0.98);
          }
        }

        // Abort if oncoming danger appears or near hairpin or timeout
        let dangerAhead = false;
        agents.forEach((c) => {
          if (c.dir === a.dir) return;
          const distOpp = (c.u - a.u) * a.dir * ROAD.ds;
          if (distOpp > 0 && distOpp < 20) dangerAhead = true;
        });

        // Completed pass when front has cleared the lead vehicle by bumper gap + length
        const passedTargetDist = (a.u - a.overtakeTargetU) * a.dir * ROAD.ds;
        const requiredClearance = (a.spec.l + (a.overtakeTargetLength || 4.0)) / 2 + 4.5;
        const isClearlyAhead = passedTargetDist > requiredClearance;

        if (a.overtakeTimer <= 0 || dangerAhead || nearHairpin || isClearlyAhead) {
          a.overtakeState = 'returning';
        }
      }

      // State C: 'returning' -> Glide smoothly back into base lane
      if (a.overtakeState === 'returning') {
        targetLat = a.baseLat;
        if (Math.abs(a.lat - a.baseLat) < 0.20) {
          a.overtakeState = 'none';
          a.overtakeCooldown = 3.5;
        }
      }

      // -------------------------------------------------------------
      // 4. Deadlock Resolution: Adjust into Free Space & Allow Traffic to Move On
      // When two opposing vehicles meet or face a potential deadlock,
      // the yielding vehicle steers into the outer shoulder free space
      // pocket (up to 1.45m off-center), letting the oncoming vehicle drive through!
      // -------------------------------------------------------------
      // A) Check against Player
      const distToPlayerSpline = (player.u - a.u) * a.dir * ROAD.ds;
      const playerLat = player.lat ?? -ROAD.lane;
      const pLen = player.length || 2.1;
      const pWid = player.width || 0.8;
      const latDiffWithPlayer = Math.abs(a.effectiveLat - playerLat);
      const minPlayerCenterDist = (a.spec.l + pLen) / 2 + 2.5;
      const latOverlapPlayer = latDiffWithPlayer < (a.spec.w + pWid) / 2 + 0.35;

      if (distToPlayerSpline > 0 && distToPlayerSpline < 32.0) {
        if (a.dir < 0) {
          // Oncoming downhill bot vs uphill player:
          // The AI ALWAYS yields and adjusts to the hillside free space for the player!
          if (latOverlapPlayer || distToPlayerSpline < 22.0) {
            isYieldingToFreeSpace = true;
            // Shoulder turnout free space (moves from +2.0m out to +3.45m on the hillside):
            targetLat = a.baseLat + 1.45;

            // If lateral gap is now open (> 0.45m), the player has a wide-open path!
            // The bot creeps forward on the shoulder or pauses if very close:
            if (!latOverlapPlayer) {
              // Free space achieved! Player can drive on, bot rolls on smoothly on shoulder!
              desiredSpeed = Math.min(desiredSpeed, 3.5);
              mustStop = false;
            } else {
              // Still overlapping: steer diagonally into the shoulder pocket:
              if (distToPlayerSpline < minPlayerCenterDist + 1.2) {
                // Nose-to-nose: active tuck maneuver (reverse diagonally into pocket)
                a.reversingTimer = Math.max(a.reversingTimer, 1.4);
                mustStop = false;
              } else {
                desiredSpeed = clamp(distToPlayerSpline / 10.0, 1.5, 3.5);
                mustStop = false;
              }
            }
          }
        } else {
          // Uphill bot behind player:
          if (latOverlapPlayer) {
            if (distToPlayerSpline < minPlayerCenterDist + 2.0) {
              mustStop = true;
              obstacleDist = distToPlayerSpline;
              desiredSpeed = Math.min(desiredSpeed, Math.max(0, player.speed));
            } else if (distToPlayerSpline < minPlayerCenterDist + 14.0) {
              desiredSpeed = Math.min(desiredSpeed, Math.max(0, player.speed * 0.95));
            }
          }
        }
      }

      // B) Check against other traffic agents (Bot vs Bot)
      agents.forEach((b) => {
        if (b.id === a.id) return;
        const bDist = (b.u - a.u) * a.dir * ROAD.ds;
        if (bDist <= 0 || bDist > 30.0) return;

        const bEffLat = b.effectiveLat ?? b.lat;
        const latDiff = Math.abs(a.effectiveLat - bEffLat);
        const minCenterDist = (a.spec.l + b.spec.l) / 2 + 2.5;
        const hasLateralOverlap = latDiff < (a.spec.w + b.spec.w) / 2 + 0.35;

        if (b.dir === a.dir) {
          // Same direction queueing:
          if (hasLateralOverlap) {
            const stopThreshold = (b.holdingForHairpin || Math.abs(b.curSpeed) < 0.3) ? minCenterDist + 2.5 : minCenterDist;
            if (bDist < stopThreshold) {
              mustStop = true;
              obstacleDist = Math.min(obstacleDist, bDist);
              desiredSpeed = Math.min(desiredSpeed, Math.max(0, b.curSpeed));

              // Physical repulsion: if they ever touch, prevent penetration
              if (bDist < (a.spec.l + b.spec.l) / 2 + 0.4) {
                a.curSpeed = Math.min(a.curSpeed, -1.0);
              }
            } else if (bDist < minCenterDist + 12.0) {
              const f = (bDist - stopThreshold) / 12.0;
              desiredSpeed = Math.min(desiredSpeed, Math.max(0, b.curSpeed + (a.speed - b.curSpeed) * f));
            }

            // Cascade Reversing: if vehicle ahead is reversing, back up with it
            if ((b.reversingTimer > 0 || b.curSpeed < -0.5) && bDist < minCenterDist + 4.0 && a.reversingTimer <= 0) {
              a.reversingTimer = 2.0;
            }
          }
        } else {
          // Opposing traffic encounter:
          if (b.holdingForHairpin && bDist > 6.0) return;

          // Priority rule: Bus > Lorry > Car/Jeep > Auto > Bike; Uphill > Downhill
          const aIsPriority =
            (a.kind === 'bus' && b.kind !== 'bus') ||
            (a.kind === 'lorry' && b.kind !== 'bus' && b.kind !== 'lorry') ||
            (a.dir > 0 && b.dir < 0 && a.kind === b.kind);

          // ANTICIPATORY FREE SPACE ADJUSTMENT:
          // When opposing vehicles are approaching (within 28m), the yielding vehicle
          // steers into the outer shoulder free space pocket!
          if (hasLateralOverlap || bDist < 20.0) {
            if (!aIsPriority) {
              isYieldingToFreeSpace = true;
              // Target outer shoulder free space (out to lat = ±3.45m):
              const freeSpaceOffset = a.dir > 0 ? -1.45 : 1.45;
              targetLat = a.baseLat + freeSpaceOffset;

              // Check if free space is achieved (no more lateral overlap):
              if (!hasLateralOverlap) {
                // Free space achieved! Allow both vehicles to drive past smoothly!
                desiredSpeed = Math.min(desiredSpeed, 3.5);
                mustStop = false;
              } else {
                // Still overlapping: steer into free space pocket!
                if (bDist < minCenterDist + 1.2) {
                  // Nose-to-nose deadlock: active tuck maneuver (creep back diagonally into pocket)
                  a.reversingTimer = Math.max(a.reversingTimer, 1.4);
                  mustStop = false;
                } else {
                  // Creep forward into the shoulder pocket:
                  desiredSpeed = clamp(bDist / 8.0, 1.5, 3.2);
                  mustStop = false;
                }
              }
            } else {
              // Priority vehicle:
              if (!hasLateralOverlap) {
                // Opposing vehicle has tucked into free space! Move on freely!
                desiredSpeed = Math.min(desiredSpeed, 4.5);
                mustStop = false;
              } else {
                // Wait briefly for the yielding vehicle to complete its tuck into the pocket:
                if (bDist < minCenterDist + 2.0) {
                  desiredSpeed = Math.min(desiredSpeed, 1.8);
                }
                if (bDist < minCenterDist) {
                  mustStop = true;
                  obstacleDist = Math.min(obstacleDist, bDist);
                }
              }
            }
          }
        }
      });
      a.yieldingToFreeSpace = isYieldingToFreeSpace;

      // -------------------------------------------------------------
      // 5. Realistic Non-Holonomic Steering & Lateral Motion
      // Vehicles turn their nose and steer into lane changes and free space pockets!
      // -------------------------------------------------------------
      const steerParams = {
        bike:  { maxSteer: 0.30, lookahead: 5.5,  rate: 5.5 },
        car:   { maxSteer: 0.22, lookahead: 7.5,  rate: 4.2 },
        jeep:  { maxSteer: 0.20, lookahead: 8.0,  rate: 4.0 },
        auto:  { maxSteer: 0.25, lookahead: 6.5,  rate: 4.5 },
        bus:   { maxSteer: 0.14, lookahead: 12.0, rate: 2.8 },
        lorry: { maxSteer: 0.12, lookahead: 13.0, rate: 2.5 },
      };
      const sp = steerParams[a.kind] || steerParams.car;

      // Handle active reverse maneuver (tuck diagonally into shoulder free space)
      if (a.reversingTimer > 0) {
        a.reversingTimer -= dt;
        a.curSpeed = -2.0;
        a.u -= (a.dir * 2.0 * dt) / ROAD.ds;

        // Cut wheels toward the outer shoulder while backing up!
        const steerToShoulder = (a.dir > 0 ? -1 : 1) * sp.maxSteer * 0.85;
        a.steerAngle += (steerToShoulder - a.steerAngle) * Math.min(1.0, 4.0 * dt);
        const deltaLat = (a.dir > 0 ? 1 : -1) * a.curSpeed * Math.sin(a.steerAngle) * dt;
        a.lat += clamp(deltaLat, -1.8 * dt, 1.8 * dt);
      } else {
        // Normal forward steering: difference between target and current lateral position
        const latDiffToTarget = a.dir > 0 ? (targetLat - a.lat) : (a.lat - targetLat);
        const desiredSteer = clamp(latDiffToTarget / sp.lookahead, -sp.maxSteer, sp.maxSteer);

        // Smooth steering wheel turn rate
        a.steerAngle += (desiredSteer - a.steerAngle) * Math.min(1.0, sp.rate * dt);

        // Lateral motion ONLY occurs when moving forward! (non-holonomic Ackermann kinematics)
        if (Math.abs(a.curSpeed) > 0.1) {
          const deltaLat = (a.dir > 0 ? 1 : -1) * a.curSpeed * Math.sin(a.steerAngle) * dt;
          a.lat += clamp(deltaLat, -1.8 * dt, 1.8 * dt);
        }
      }

      a.targetLat = targetLat;
      a.effectiveLat = a.lat;

      // -------------------------------------------------------------
      // Failsafe Gridlock Watchdog (Never Disappear Near Player!)
      // -------------------------------------------------------------
      const distFromPlayer = Math.abs(a.u - player.u) * ROAD.ds;

      if (Math.abs(a.curSpeed) < 0.25 && !a.holdingForHairpin && !a.yieldingToFreeSpace) {
        a.stuckTimer = (a.stuckTimer || 0) + dt;
      } else {
        a.stuckTimer = 0;
      }

      // ONLY respawn a stuck vehicle if it is far away out of player view (> 95m)!
      if (a.stuckTimer > 12.0 && distFromPlayer > 95) {
        respawn(a, false);
      }

      // -------------------------------------------------------------
      // 6. Apply Acceleration, Braking & Audio
      // -------------------------------------------------------------
      if (a.reversingTimer > 0) {
        // Reversing handled above
      } else if (mustStop) {
        a.curSpeed = Math.max(0, a.curSpeed - 20.0 * dt);
        if (!a.holdingForHairpin && obstacleDist <= 8.5 && a.hornCooldown <= 0) {
          a.hornCooldown = 3.5;
          const distToCam = Math.hypot(
            player.pos.x - (a.model.group?.position.x || 0),
            player.pos.z - (a.model.group?.position.z || 0)
          );
          const vol = clamp(1 - distToCam / 120, 0, 1);
          if (vol > 0.05) audio.horn(a.kind, 0.32, vol);
        }
      } else {
        if (a.curSpeed < desiredSpeed) {
          const baseAccel = { bike: 9.8, car: 8.5, jeep: 7.8, auto: 5.5, bus: 5.0, lorry: 3.8 };
          const accRate = (baseAccel[a.kind] || 6.5) * (a.overtakeState === 'passing' ? 1.4 : 1.0) * a.aggression;
          a.curSpeed = Math.min(desiredSpeed, a.curSpeed + accRate * dt);
        } else {
          a.curSpeed = Math.max(desiredSpeed, a.curSpeed - 9.0 * dt);
        }
      }

      // Advance along road spline
      if (a.reversingTimer <= 0) {
        a.u += (a.dir * a.curSpeed * dt) / ROAD.ds;
      }
      a.u = clamp(a.u, 12, ROAD.n - 16);

      // Safe Respawn Recycling:
      // STRICT RULE: Never respawn or vanish a vehicle if it is anywhere near the player (< 130m)!
      if (distFromPlayer > 130) {
        if (
          a.u < 14 ||
          a.u > ROAD.n - 18 ||
          distFromPlayer > 430 ||
          (a.u < player.u - 60 / ROAD.ds && distFromPlayer > 160)
        ) {
          respawn(a, false);
        }
      }

      // -------------------------------------------------------------
      // 7. Apply 3D World Pose with Realistic Heading and Bike Roll
      // -------------------------------------------------------------
      ROAD.lanePose(a.u, a.lat, _p);
      const roadHeading = _p.heading + (a.dir > 0 ? 0 : Math.PI);
      const yaw = roadHeading + (a.dir > 0 ? a.steerAngle : -a.steerAngle);
      const pitch = -Math.atan(a.dir * _p.grade);

      // Dynamic bike lean: curve roll + dynamic counter-steer roll into lane change
      const curveLean = clamp(-ROAD.kappa[uIndex] * (a.curSpeed ** 2) * 0.11 * a.dir, -0.45, 0.45);
      const steerRoll = a.kind === 'bike' ? clamp(-a.steerAngle * (a.curSpeed / 7.0), -0.32, 0.32) : 0;
      const lean = a.kind === 'bike' ? clamp(curveLean + steerRoll, -0.52, 0.52) : 0;

      const g = a.model.group;
      g.visible = distFromPlayer < 450;
      g.position.set(_p.x, _p.y, _p.z);
      _e.set(pitch, Math.PI / 2 - yaw, lean, 'YXZ');
      g.quaternion.setFromEuler(_e);

      // Kinematic Rapier body sync
      const b = refs.current[a.id];
      if (b) {
        const h = a.model.spec.h / 2;
        b.setNextKinematicTranslation({ x: _p.x, y: _p.y + h, z: _p.z });
        b.setNextKinematicRotation(g.quaternion);
      }
    });
  }, -5);

  return (
    <>
      {agents.map((a) => (
        <group key={a.id}>
          <primitive object={a.model.group} />
          <RigidBody
            ref={(r) => {
              refs.current[a.id] = r;
            }}
            type="kinematicPosition"
            colliders={false}
            name={`traffic:${a.model.spec.mass}`}
          >
            <CuboidCollider
              args={[a.model.spec.w / 2, a.model.spec.h / 2, a.model.spec.l / 2]}
              activeCollisionTypes={ActiveCollisionTypes.ALL}
            />
          </RigidBody>
        </group>
      ))}
    </>
  );
}
