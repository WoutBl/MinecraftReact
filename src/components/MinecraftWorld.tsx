import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';

// Block textures from Minecraft
const textureLoader = new THREE.TextureLoader();
const dirtTexture = textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_dirt.png');
const grassTexture = textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/OldGrass.png');
const stoneTexture = textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_cobble.png');

dirtTexture.magFilter = THREE.NearestFilter;
grassTexture.magFilter = THREE.NearestFilter;
stoneTexture.magFilter = THREE.NearestFilter;

interface Block {
  position: [number, number, number];
  type: 'dirt' | 'grass' | 'stone';
}

function Player() {
  const { camera } = useThree();
  const moveSpeed = 0.15;
  const keys = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame(() => {
    if (keys.current['KeyW']) camera.translateZ(-moveSpeed);
    if (keys.current['KeyS']) camera.translateZ(moveSpeed);
    if (keys.current['KeyA']) camera.translateX(-moveSpeed);
    if (keys.current['KeyD']) camera.translateX(moveSpeed);
    if (keys.current['Space']) camera.position.y += moveSpeed;
    if (keys.current['ShiftLeft']) camera.position.y -= moveSpeed;
  });

  return null;
}

function Blocks({ blocks, onBlockClick }: { blocks: Block[], onBlockClick: (position: [number, number, number], normal: [number, number, number], button: number) => void }) {
  const [hovered, setHovered] = useState<[number, number, number] | null>(null);

  const getTexture = (type: string) => {
    switch (type) {
      case 'dirt': return dirtTexture;
      case 'grass': return grassTexture;
      case 'stone': return stoneTexture;
      default: return dirtTexture;
    }
  };

  return (
    <group>
      {blocks.map((block, i) => (
        <mesh
          key={i}
          position={block.position}
          onPointerOver={() => setHovered(block.position)}
          onPointerOut={() => setHovered(null)}
          onClick={(e) => {
            e.stopPropagation();
            // Convert face normal to array format
            const normal: [number, number, number] = [
              Math.round(e.face?.normal.x || 0),
              Math.round(e.face?.normal.y || 0),
              Math.round(e.face?.normal.z || 0)
            ];
            onBlockClick(block.position, normal, e.button);
          }}
          onContextMenu={(e) => {
            e.stopPropagation();
            const normal: [number, number, number] = [
              Math.round(e.face?.normal.x || 0),
              Math.round(e.face?.normal.y || 0),
              Math.round(e.face?.normal.z || 0)
            ];
            onBlockClick(block.position, normal, 2);
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial 
            map={getTexture(block.type)}
            emissive={hovered && hovered[0] === block.position[0] && 
                     hovered[1] === block.position[1] && 
                     hovered[2] === block.position[2] ? 'white' : 'black'}
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

function MinecraftWorld() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<'dirt' | 'grass' | 'stone'>('dirt');

  useEffect(() => {
    // Generate initial world
    const initialBlocks: Block[] = [];
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        initialBlocks.push({
          position: [x, -1, z],
          type: 'grass'
        });
      }
    }
    setBlocks(initialBlocks);
  }, []);

  const handleBlockClick = (position: [number, number, number], normal: [number, number, number], button: number) => {
    if (button === 2) { // Right click to add block
      const [x, y, z] = position;
      const [nx, ny, nz] = normal;
      // Add block adjacent to the clicked face
      setBlocks([...blocks, { 
        position: [x + nx, y + ny, z + nz], 
        type: selectedBlock 
      }]);
    } else if (button === 0) { // Left click to remove block
      setBlocks(blocks.filter(block => 
        !(block.position[0] === position[0] && 
          block.position[1] === position[1] && 
          block.position[2] === position[2])
      ));
    }
  };

  return (
    <div className="h-screen w-screen">
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
        <div className="w-4 h-4 border-2 border-white rounded-full opacity-75"></div>
      </div>
      <div className="absolute top-4 left-4 z-10 bg-white/80 p-4 rounded-lg">
        <h2 className="text-lg font-bold mb-2">Controls:</h2>
        <ul className="text-sm">
          <li>WASD - Move</li>
          <li>Space - Up</li>
          <li>Shift - Down</li>
          <li>Left Click - Remove block</li>
          <li>Right Click - Add block</li>
          <li>Mouse - Look around</li>
        </ul>
        <div className="mt-4">
          <h3 className="font-bold mb-2">Selected Block:</h3>
          <select 
            value={selectedBlock}
            onChange={(e) => setSelectedBlock(e.target.value as 'dirt' | 'grass' | 'stone')}
            className="w-full p-2 rounded"
          >
            <option value="dirt">Dirt</option>
            <option value="grass">Grass</option>
            <option value="stone">Stone</option>
          </select>
        </div>
      </div>
      <Canvas camera={{ position: [0, 2, 5], fov: 75 }}>
        <color attach="background" args={['#87CEEB']} />
        <fog attach="fog" args={['#87CEEB', 10, 20]} />
        <PointerLockControls />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Player />
        <Blocks blocks={blocks} onBlockClick={handleBlockClick} />
      </Canvas>
    </div>
  );
}

export default MinecraftWorld;