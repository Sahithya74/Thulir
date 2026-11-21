import { useEffect, useMemo } from 'react'
import { BOX, CYL, PLANE, mat } from './shared3d'
import { AVENUE_HALF_WIDTH, SIDEWALK_HALF_WIDTH, complex } from './layout'
import { C, makeFacadeTexture, makePavingTexture } from './palette'
import { MeshStandardMaterial } from 'three'

const SPAN = 120 // length of the avenue/ground in x

/** Ground, avenue, sidewalks, plaza, crossings, bus shelter and the shopping-complex landmark. */
export function District({ shadows }: { shadows: boolean }) {
  const paving = useMemo(() => {
    const t = makePavingTexture()
    t.repeat.set(10, 7)
    return t
  }, [])
  const plazaMat = useMemo(() => new MeshStandardMaterial({ map: paving, roughness: 0.95 }), [paving])
  const complexTex = useMemo(() => {
    const t = makeFacadeTexture('#d6d0c0', '#2f3b39')
    t.repeat.set(4, 4)
    return t
  }, [])
  const complexMat = useMemo(() => new MeshStandardMaterial({ map: complexTex, roughness: 0.8 }), [complexTex])

  useEffect(
    () => () => {
      paving.dispose()
      plazaMat.dispose()
      complexTex.dispose()
      complexMat.dispose()
    },
    [paving, plazaMat, complexTex, complexMat],
  )

  const stripes = useMemo(() => Array.from({ length: 11 }, (_, i) => -4 + i * 0.8), [])

  return (
    <group>
      {/* ground plinth */}
      <mesh geometry={PLANE} material={mat(C.ground)} rotation={[-Math.PI / 2, 0, 0]} scale={[800, 600, 1]} receiveShadow={shadows} />

      {/* avenue */}
      <mesh geometry={PLANE} material={mat(C.asphalt, { roughness: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[SPAN * 2, AVENUE_HALF_WIDTH * 2, 1]} receiveShadow={shadows} />
      {Array.from({ length: 28 }, (_, i) => (
        <mesh key={i} geometry={PLANE} material={mat('#f3e4c8')} rotation={[-Math.PI / 2, 0, 0]} position={[-SPAN + 2 + i * 4.5, 0.03, 0]} scale={[2, 0.14, 1]} />
      ))}

      {/* sidewalks with a curb */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={BOX} material={mat('#cfc9b8')} position={[0, 0.07, s * (AVENUE_HALF_WIDTH + (SIDEWALK_HALF_WIDTH - AVENUE_HALF_WIDTH) / 2)]} scale={[SPAN * 2, 0.14, SIDEWALK_HALF_WIDTH - AVENUE_HALF_WIDTH]} receiveShadow={shadows} />
        </group>
      ))}

      {/* central paved plaza, interrupting the sidewalks */}
      <mesh geometry={PLANE} material={plazaMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 0]} scale={[18, SIDEWALK_HALF_WIDTH * 2, 1]} receiveShadow={shadows} />
      <mesh geometry={PLANE} material={mat(C.asphalt, { roughness: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.17, 0]} scale={[18, AVENUE_HALF_WIDTH * 2, 1]} />

      {/* zebra crossings at both ends of the plaza */}
      {[-9.4, 9.4].map((x) =>
        stripes.map((z) => (
          <mesh key={`${x}-${z}`} geometry={PLANE} material={mat('#fff6e5')} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.18, z]} scale={[1.1, 0.42, 1]} />
        )),
      )}

      {/* plaza planters + low benches */}
      {[[-6, -5.9], [6, -5.9], [-6, 5.9], [6, 5.9]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0.16, z]}>
          <mesh geometry={BOX} material={mat('#bdb7a6')} position={[0, 0.3, 0]} scale={[2.2, 0.6, 1.2]} castShadow={shadows} />
          <mesh geometry={CYL} material={mat(C.olive)} position={[0, 0.85, 0]} scale={[0.75, 0.5, 0.55]} />
        </group>
      ))}
      {[-3, 3].map((x) => (
        <mesh key={x} geometry={BOX} material={mat('#8a6a4d')} position={[x, 0.45, -5.9]} scale={[2, 0.12, 0.55]} />
      ))}

      {/* wayfinding pylon in the plaza */}
      <group position={[0, 0.16, -6.2]}>
        <mesh geometry={BOX} material={mat(C.forest)} position={[0, 1.6, 0]} scale={[0.5, 3.2, 0.5]} castShadow={shadows} />
        <mesh geometry={BOX} material={mat(C.terracotta)} position={[0, 3.3, 0]} scale={[0.62, 0.16, 0.62]} />
      </group>

      {/* bus shelter on the south sidewalk */}
      <group position={[-26, 0.14, 5.6]}>
        <mesh geometry={BOX} material={mat('#4a504b')} position={[0, 2.4, 0]} scale={[4, 0.14, 1.6]} castShadow={shadows} />
        {[-1.9, 1.9].map((x) => (
          <mesh key={x} geometry={BOX} material={mat('#4a504b')} position={[x, 1.2, -0.7]} scale={[0.1, 2.4, 0.1]} />
        ))}
        <mesh geometry={BOX} material={mat('#8fa6a1', { transparent: true, opacity: 0.45 })} position={[0, 1.2, -0.72]} scale={[3.8, 2.1, 0.04]} />
        <mesh geometry={BOX} material={mat('#8a6a4d')} position={[0, 0.5, -0.4]} scale={[2.6, 0.1, 0.45]} />
      </group>

      {/* shopping-complex landmark */}
      <group position={[complex.x, 0, complex.z]}>
        <mesh geometry={BOX} material={complexMat} position={[0, complex.h / 2, 0]} scale={[complex.w, complex.h, complex.d]} castShadow={shadows} receiveShadow={shadows} />
        {/* arcade colonnade at street level */}
        <mesh geometry={BOX} material={mat('#2a3836', { roughness: 0.2, emissive: '#ffcf8f', emissiveIntensity: 0.3 })} position={[0, 1.6, complex.d / 2 + 0.05]} scale={[complex.w - 1.2, 3, 0.1]} />
        {[-5.5, -2.75, 0, 2.75, 5.5].map((x) => (
          <mesh key={x} geometry={BOX} material={mat('#f3e4c8')} position={[x, 1.7, complex.d / 2 + 0.6]} scale={[0.35, 3.4, 0.35]} castShadow={shadows} />
        ))}
        <mesh geometry={BOX} material={mat('#f3e4c8')} position={[0, 3.55, complex.d / 2 + 0.6]} scale={[complex.w, 0.3, 1.5]} castShadow={shadows} />
        <mesh geometry={BOX} material={mat(C.forest)} position={[0, complex.h + 0.9, 0]} scale={[complex.w * 0.5, 1.8, 0.3]} />
        <mesh geometry={BOX} material={mat(C.forest)} position={[0, complex.h + 0.08, 0]} scale={[complex.w + 0.3, 0.2, complex.d + 0.3]} />
      </group>
    </group>
  )
}
