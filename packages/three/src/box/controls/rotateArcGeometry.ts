// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ARROW_GEOMETRY_DEFAULTS } from "../../common/arrowGeometry.ts";
import {
  type AxisSign,
  AXIS_DIRECTION
} from "../../common/axes.ts";
import { mergePositions } from "../../common/mergePositions.ts";

// CONSTANTS
export const ROTATE_ARC_RADIUS = 1.1;

const kMidAngle = Math.PI / 4;
const kArcSpan = THREE.MathUtils.degToRad(25);
const kPickerTube = 0.3;
const kRadialSegments = 8;
const kTubularSegments = 12;
const kPickerRadialSegments = 4;
const kPickerTubularSegments = 8;

const kTangent = new THREE.Vector3();
const kQuaternion = new THREE.Quaternion();

export function createRotateArcGeometry(
  direction: AxisSign
): THREE.BufferGeometry {
  const {
    shaftRadius,
    headLength,
    headRadius,
    radialSegments
  } = ARROW_GEOMETRY_DEFAULTS;
  const from = direction === 1 ? kMidAngle - kArcSpan : kMidAngle;
  const tip = direction === 1 ? from : from + kArcSpan;

  const tube = createArc(
    shaftRadius,
    from,
    kArcSpan,
    kRadialSegments,
    kTubularSegments
  );
  const head = new THREE.ConeGeometry(headRadius, headLength, radialSegments)
    .translate(0, headLength / 2, 0)
    .applyQuaternion(
      kQuaternion.setFromUnitVectors(
        AXIS_DIRECTION.y,
        arcTangent(tip, direction, kTangent)
      )
    )
    .translate(
      ROTATE_ARC_RADIUS * Math.cos(tip),
      0,
      ROTATE_ARC_RADIUS * Math.sin(tip)
    );

  const geometry = mergePositions([tube, head]);
  tube.dispose();
  head.dispose();

  return geometry;
}

export function createRotateArcPickerGeometry(
  direction: AxisSign
): THREE.BufferGeometry {
  return createArc(
    kPickerTube,
    direction === 1 ? 0 : kMidAngle,
    kMidAngle,
    kPickerRadialSegments,
    kPickerTubularSegments
  );
}

function createArc(
  tube: number,
  from: number,
  span: number,
  radialSegments: number,
  tubularSegments: number
): THREE.BufferGeometry {
  return new THREE.TorusGeometry(
    ROTATE_ARC_RADIUS,
    tube,
    radialSegments,
    tubularSegments,
    span
  )
    .rotateX(Math.PI / 2)
    .rotateY(-from);
}

function arcTangent(
  angle: number,
  direction: AxisSign,
  target: THREE.Vector3
): THREE.Vector3 {
  return target.set(
    direction * Math.sin(angle),
    0,
    -direction * Math.cos(angle)
  );
}
