// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  mat4,
  quat,
  vec3,
  type Mat4,
  type Quat,
  type Vec3
} from "../src/index.ts";

// CONSTANTS
const kCount = 1_000;

function poses() {
  const positions: Vec3[] = [];
  const quaternions: Quat[] = [];
  const scales: Vec3[] = [];
  const matrices: Mat4[] = [];
  for (let index = 0; index < kCount; index++) {
    const position = vec3.create(index, index * 0.5, -index);
    const quaternion = quat.loadEuler(quat.create(), {
      x: index * 0.01,
      y: index * 0.02,
      z: index * 0.03
    });
    const scale = vec3.create(1 + (index % 3), 1, index % 2 === 0 ? 1 : -1);
    positions.push(position);
    quaternions.push(quaternion);
    scales.push(scale);
    matrices.push(mat4.compose(mat4.create(), position, quaternion, scale));
  }

  return {
    positions,
    quaternions,
    scales,
    matrices
  };
}

const suite = defineSuite("math / transforms", (bench) => {
  const { positions, quaternions, scales, matrices } = poses();
  const matrix = mat4.create();
  const position = vec3.create();
  const quaternion = quat.create();
  const scale = vec3.create();
  const up = vec3.create(0, 1, 0);

  bench
    .add("compose then multiply 1k world matrices", () => {
      for (let index = 0; index < kCount; index++) {
        mat4.compose(matrix, positions[index], quaternions[index], scales[index]);
        mat4.multiply(matrix, matrices[index], matrix);
      }

      return matrix[12];
    })
    .add("decompose 1k matrices", () => {
      for (let index = 0; index < kCount; index++) {
        mat4.decompose(matrices[index], position, quaternion, scale);
      }

      return quaternion[3];
    })
    .add("invert 1k matrices", () => {
      for (let index = 0; index < kCount; index++) {
        mat4.invert(matrix, matrices[index]);
      }

      return matrix[0];
    })
    .add("slerp 1k quaternions", () => {
      for (let index = 1; index < kCount; index++) {
        quat.slerp(quaternion, quaternions[index - 1], quaternions[index], 0.3);
      }

      return quaternion[3];
    })
    .add("rotate 1k vectors", () => {
      for (let index = 0; index < kCount; index++) {
        vec3.transformQuat(position, positions[index], quaternions[index]);
      }

      return position[0];
    })
    .add("look at 1k targets", () => {
      for (let index = 1; index < kCount; index++) {
        quat.lookAt(quaternion, positions[index - 1], positions[index], up);
      }

      return quaternion[3];
    });
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
