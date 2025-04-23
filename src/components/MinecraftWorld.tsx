import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import InventoryBar from './InventoryBar';
import { BlockType, getTexture } from '../Textures';
import Crosshair from './Crosshair';
import CraftingUI from './CraftingUi';



const createMaterials = (type: BlockType): THREE.MeshStandardMaterial[] => {
  const faces = ['right', 'left', 'top', 'bottom', 'front', 'back'];
  return faces.map(face => {
    const texture = getTexture(type, face);
    return new THREE.MeshStandardMaterial({ map: texture });
  });
};

const materialsCache: Record<BlockType, THREE.MeshStandardMaterial[]> = {
  dirt: createMaterials('dirt'),
  grass: createMaterials('grass'),
  stone: createMaterials('stone'),
  wood: createMaterials('wood'),
  sand: createMaterials('sand'),
  crafting_table: createMaterials('crafting_table'),
  planks: createMaterials('planks')
};
const playerHeight = 1.8; // Define player height
interface Block {
  position: [number, number, number];
  type: BlockType;
}

interface Chunk {
  position: [number, number]; // Chunk position in the world (x, z)
  blocks: Block[]; // Blocks within the chunk
}

const generateChunk = (chunkX: number, chunkZ: number): Chunk => {
  const blocks: Block[] = [];
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      blocks.push({
        position: [chunkX * 16 + x, 0, chunkZ * 16 + z],
        type: 'grass',
      });
    }
  }
  return { position: [chunkX, chunkZ], blocks };
};
const generateWorld = (chunkRange: number): Chunk[] => {
  const chunks: Chunk[] = [];
  for (let chunkX = -chunkRange; chunkX <= chunkRange; chunkX++) {
    for (let chunkZ = -chunkRange; chunkZ <= chunkRange; chunkZ++) {
      chunks.push(generateChunk(chunkX, chunkZ));
    }
  }
  return chunks;
};

function Player({ blocks }: { blocks: Block[] }) {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const keys = useRef<{ [key: string]: boolean }>({});
  const isJumping = useRef(false);
  const wasOnGround = useRef(false);

  const moveSpeed = 0.1;
  const gravity = -0.01;
  const jumpStrength = 0.18;
  const playerWidth = 0.3;

  const spatialGrid = useMemo(() => {
    const grid: Record<string, Block[]> = {};
    blocks.forEach(block => {
      // Use exact position without flooring
      const key = `${block.position[0]},${block.position[1]},${block.position[2]}`;
      if (!grid[key]) grid[key] = [];
      grid[key].push(block);
    });
    return grid;
  }, [blocks]);

  const getNearbyBlocks = (position: THREE.Vector3) => {
    const nearby: Block[] = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const key = `${Math.floor(position.x + x)},${Math.floor(position.y + y)},${Math.floor(position.z + z)}`;
          if (spatialGrid[key]) nearby.push(...spatialGrid[key]);
        }
      }
    }
    return nearby;
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current[e.code] = true;
    const up = (e: KeyboardEvent) => keys.current[e.code] = false;

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const isOnGround = () => {
    const buffer = 0.1; // Increased buffer
    const checkPosition = new THREE.Vector3(
      camera.position.x,
      camera.position.y - playerHeight - buffer,
      camera.position.z
    );
    return isColliding(checkPosition.x, checkPosition.y, checkPosition.z);
  };
  const isColliding = (x: number, y: number, z: number) => {
    const nearbyBlocks = getNearbyBlocks(new THREE.Vector3(x, y, z));
    return nearbyBlocks.some(block => {
      const [bx, by, bz] = block.position;
      // Player bounds (AABB collision detection)
      return (
        x + playerWidth >= bx - 0.5 &&
        x - playerWidth <= bx + 0.5 &&
        y + playerHeight/2 >= by - 0.5 &&
        y - playerHeight/2 <= by + 0.5 &&
        z + playerWidth >= bz - 0.5 &&
        z - playerWidth <= bz + 0.5
      );
    });
  };

  useFrame(() => {
    const front = new THREE.Vector3();
    camera.getWorldDirection(front);
    front.y = 0;
    front.normalize();
    
  
    const right = new THREE.Vector3().crossVectors(front, new THREE.Vector3(0, 1, 0)).normalize();
  
    direction.current.set(0, 0, 0);
    if (keys.current['KeyW']) direction.current.add(front);
    if (keys.current['KeyS']) direction.current.sub(front);
    if (keys.current['KeyA']) direction.current.sub(right);
    if (keys.current['KeyD']) direction.current.add(right);
    direction.current.normalize();
  
    const moveX = direction.current.x * moveSpeed;
    const moveZ = direction.current.z * moveSpeed;
  
    const newX = camera.position.x + moveX;
    const newZ = camera.position.z + moveZ;
    const newY = camera.position.y;

    const checkPosition = new THREE.Vector3(newX, newY - playerHeight/2, newZ);
    if (!isColliding(checkPosition.x, checkPosition.y, checkPosition.z)) {
      camera.position.x = newX;
      camera.position.z = newZ;
    }
  
    // Horizontal collision
    if (!isColliding(newX, newY - playerHeight / 2, camera.position.z)) {
      camera.position.x = newX;
    }
    if (!isColliding(camera.position.x, newY - playerHeight / 2, newZ)) {
      camera.position.z = newZ;
    }
  
    // Jumping
    if (keys.current['Space'] && isOnGround() && !isJumping.current) {
      velocity.current.y = jumpStrength;
      isJumping.current = true;
    }

  
    // Gravity
    if (!isOnGround()) {
      velocity.current.y += gravity; // Apply gravity only when not on the ground
      velocity.current.y = Math.max(velocity.current.y, -0.3); // Apply terminal velocity only when falling
    }
  
    const nextY = camera.position.y + velocity.current.y;
    const collidesBelow = isColliding(camera.position.x, nextY - playerHeight, camera.position.z);
    const collidesAbove = isColliding(camera.position.x, nextY + 0.5, camera.position.z);
  
    if (velocity.current.y < 0 && collidesBelow) {
      velocity.current.y = 0;
      isJumping.current = false;
      camera.position.y = Math.floor(camera.position.y - playerHeight) + playerHeight + 0.01;
      wasOnGround.current = true;
    } else if (velocity.current.y > 0 && collidesAbove) {
      velocity.current.y = 0;
    } else {
      camera.position.y = nextY;
      wasOnGround.current = false;
    }
  
    // Respawn if fallen
    if (camera.position.y < -10) {
      camera.position.set(0, 10, 0);
      velocity.current.set(0, 0, 0);
    }
  });

  return null;
}


function Blocks({
  blocks,
  onBlockClick,
  onCraftingOpen
}: {
  blocks: Block[],
  onBlockClick: (position: [number, number, number], normal: [number, number, number], button: number) => void,
  onCraftingOpen: (position: [number, number, number]) => void
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const [hoveredInstance, setHoveredInstance] = useState<number | null>(null);
  const type = blocks[0]?.type;

  useEffect(() => {
    if (ref.current && blocks.length > 0) {
      blocks.forEach((block, i) => {
        const matrix = new THREE.Matrix4();
        matrix.setPosition(...block.position);
        ref.current!.setMatrixAt(i, matrix);
      });
      ref.current!.instanceMatrix.needsUpdate = true;
    }
  }, [blocks]);

  if (!type || blocks.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, blocks.length]}
      onClick={(e) => {
        if (e.instanceId === undefined) return;
        const block = blocks[e.instanceId];
        const type = block.type;
      
        const normal = [
          Math.round(e.face?.normal.x || 0),
          Math.round(e.face?.normal.y || 0),
          Math.round(e.face?.normal.z || 0)
        ] as [number, number, number];
      
        // Right-click (button === 2)
        if (e.button === 2 && type === 'crafting_table') {
          onCraftingOpen(block.position);
        } else {
          onBlockClick(block.position, normal, e.button);
        }
      }}
      onPointerMove={(e) => {
        if (e.instanceId !== undefined) setHoveredInstance(e.instanceId);
      }}
      onPointerOut={() => setHoveredInstance(null)}
    >
      <boxGeometry args={[1, 1, 1]} />
      {materialsCache[type].map((material, i) => (
        <primitive key={i} object={material.clone()} attach={`material-${i}`} />
      ))}
    </instancedMesh>
  );
}

function MinecraftWorld() {
  const [chunks, setChunks] = useState<Chunk[]>([]); // Store chunks instead of individual blocks
  const [selectedSlot, setSelectedSlot] = useState(0); // Selected inventory slot (0–8)
  const inventory: BlockType[] = ['dirt', 'grass', 'stone', 'wood', 'sand', 'stone', 'crafting_table', 'planks', 'stone'];
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [craftingPosition, setCraftingPosition] = useState<[number, number, number] | null>(null);


  function openCraftingUI(position: [number, number, number]) {
    setCraftingOpen(true);
  }
  useEffect(() => {
    const initialChunks = generateWorld(2);
    setChunks(initialChunks);
  }, []);

  const blocksByType = useMemo(() => {
    const groups: Record<BlockType, Block[]> = { dirt: [], grass: [], stone: [], wood: [], sand: [], crafting_table: [], planks: [] };
    chunks.flatMap(chunk => chunk.blocks).forEach(block => {
      groups[block.type].push(block);
    });
    return groups;
  }, [chunks]);

  const handleBlockClick = (
    position: [number, number, number],
    normal: [number, number, number],
    button: number,
    camera: THREE.Camera
  ) => {
    
    const playerPosition = camera.position;
    
    
    
    if (button === 2) {
      const [x, y, z] = position;
      const [nx, ny, nz] = normal;
      const newBlockPosition: [number, number, number] = [x + nx, y + ny, z + nz];

      const isPlayerBlocking =
        Math.abs(playerPosition.x - newBlockPosition[0]) < 0.5 &&
        Math.abs(playerPosition.y - newBlockPosition[1]) < playerHeight &&
        Math.abs(playerPosition.z - newBlockPosition[2]) < 0.5;

      if (!isPlayerBlocking) {
        // Find the chunk containing the new block
        const chunkX = Math.floor(newBlockPosition[0] / 16);
        const chunkZ = Math.floor(newBlockPosition[2] / 16);
        setChunks((prevChunks) =>
          prevChunks.map((chunk) => {
            if (chunk.position[0] === chunkX && chunk.position[1] === chunkZ) {
              return {
                ...chunk,
                blocks: [
                  ...chunk.blocks,
                  {
                    position: newBlockPosition,
                    type: inventory[selectedSlot] as BlockType,
                  },
                ],
              };
            }
            return chunk;
          })
        );
      }
    } else if (button === 0) {
      // Left click to remove block
      setChunks((prevChunks) =>
        prevChunks.map((chunk) => ({
          ...chunk,
          blocks: chunk.blocks.filter(
            (block) =>
              !(
                block.position[0] === position[0] &&
                block.position[1] === position[1] &&
                block.position[2] === position[2]
              )
          ),
        }))
      );
    }
  };


  const CameraAwareBlocks = useMemo(() => 
    ({ blocks, onBlockClick }: { blocks: Block[], onBlockClick: typeof handleBlockClick }) => {
      const { camera } = useThree();
      return (
        <Blocks
          blocks={blocks}
          onBlockClick={(position, normal, button) => onBlockClick(position, normal, button, camera)} 
          onCraftingOpen={(position) => {
            setCraftingPosition(position);
            setCraftingOpen(true);
          }}/>
      );
    },
  []);

  return (
    <div className="h-screen w-screen">
      <Crosshair />
      <InventoryBar inventory={inventory} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} />
      <Canvas camera={{ position: [0, 5, 5], fov: 75 }}>
        <color attach="background" args={['#87CEEB']} />
        <fog attach="fog" args={['#87CEEB', 10, 100]} />
        <PointerLockControls />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Player blocks={chunks.flatMap(chunk => chunk.blocks)} />
        {Object.entries(blocksByType).map(([type, blocks]) => (
          <CameraAwareBlocks
            key={type}
            blocks={blocks}
            onBlockClick={handleBlockClick}
          />
        ))}
        
      </Canvas>
      {craftingOpen && craftingPosition && (
        <CraftingUI onClose={() => setCraftingOpen(false)} />
      )}
    </div>
  );
}


export default MinecraftWorld;