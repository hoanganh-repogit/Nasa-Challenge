import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import type { RouteFile, TraverseFile } from '../data/types'
import { createReplay } from '../engine/replay'
import type { StageAssets } from './createMissionStage'

const getJSON = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
  return r.json() as Promise<T>
}

/** Data first (the route can be drawn without the model), then the textures and the NASA model. */
export async function loadStageAssets(onProgress?: (what: string) => void): Promise<StageAssets> {
  const [traverse, route] = await Promise.all([
    getJSON<TraverseFile>('/data/traverse.json'),
    getJSON<RouteFile>('/data/route_simplified.json'),
  ])
  onProgress?.('data')
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const [basemap, gltf] = await Promise.all([
    new THREE.TextureLoader().loadAsync('/media/ground-pia23178-clean.webp'),
    loader.loadAsync('/models/mer.glb'),
  ])
  onProgress?.('model')
  return { traverse, route, basemap, gltf, replay: createReplay(traverse) }
}
