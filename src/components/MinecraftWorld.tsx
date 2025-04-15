import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import InventoryBar from './InventoryBar';
import { BlockType, getTexture } from '../Textures';
import Crosshair from './Crosshair';

// Block textures from Minecraft
const textureLoader = new THREE.TextureLoader();
const dirtTexture = textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_dirt.png');
const stoneTexture = textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_cobble.png');
const grassTopTexture = textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/OldGrassTop.png');
const grassSideTexture = textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/OldGrass.png');
const dirtBottomTexture = textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_dirt.png');


dirtTexture.magFilter = THREE.NearestFilter;
stoneTexture.magFilter = THREE.NearestFilter;
grassTopTexture.magFilter = THREE.NearestFilter;
grassSideTexture.magFilter = THREE.NearestFilter;
dirtBottomTexture.magFilter = THREE.NearestFilter;
const playerHeight = 1.8; // Define player height
interface Block {
  position: [number, number, number];
  type: BlockType;
}

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
    const buffer = 0.05;
    return blocks.some(block => {
      const [x, y, z] = block.position;
      const belowY = camera.position.y - playerHeight - buffer;
      const inX = camera.position.x >= x - 0.5 && camera.position.x <= x + 0.5;
      const inZ = camera.position.z >= z - 0.5 && camera.position.z <= z + 0.5;
      const touchingY = belowY >= y - 0.5 && belowY <= y + 0.5;
      return inX && inZ && touchingY;
    });
  };
  const isColliding = (x: number, y: number, z: number) => {
    return blocks.some(block => {
      const [bx, by, bz] = block.position;
      const inX = x >= bx - 0.5 && x <= bx + 0.5;
      const inY = y >= by - 0.5 && y <= by + 0.5;
      const inZ = z >= bz - 0.5 && z <= bz + 0.5;
      return inX && inY && inZ;
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
  
    const halfPlayerHeight = playerHeight / 2;
    const nextY = camera.position.y + velocity.current.y;
    const epsilon = 0.01;
  
    // Check for collision at the feet (falling) or head (jumping)
    const collidesBelow = isColliding(camera.position.x, nextY - halfPlayerHeight - epsilon, camera.position.z);
    const collidesAbove = isColliding(camera.position.x, nextY + epsilon, camera.position.z);
    const currentlyOnGround = collidesBelow;
    if (velocity.current.y < 0) {
      if (!currentlyOnGround) {
        // Falling normally
        camera.position.y = nextY;
        isJumping.current = true;
      } else {
        // Only snap if we were falling last frame and just landed
        if (!wasOnGround.current) {
          velocity.current.y = 0;
          isJumping.current = false;
    
          const yBlock = Math.floor(camera.position.y - halfPlayerHeight);
          const snapY = yBlock + 1 + halfPlayerHeight;
          if (Math.abs(camera.position.y - snapY) > epsilon) {
            console.log('Snapping to block');
            camera.position.y = snapY;
          }
        } else {
          velocity.current.y = 0;
        }
      }
    } else if (velocity.current.y > 0 && !collidesAbove) {
      // Going up
      camera.position.y = nextY;
    } else {
      velocity.current.y = 0;
    }
  
    // Respawn if fallen
    if (camera.position.y < -10) {
      camera.position.set(0, 10, 0);
      velocity.current.set(0, 0, 0);
    }
  });

  return null;
}


function Blocks({ blocks, onBlockClick }: { blocks: Block[], onBlockClick: (position: [number, number, number], normal: [number, number, number], button: number) => void }) {
  const [hovered, setHovered] = useState<[number, number, number] | null>(null);

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
          <meshStandardMaterial attach="material-0" map={getTexture(block.type, 'right')} />
          <meshStandardMaterial attach="material-1" map={getTexture(block.type, 'left')} />
          <meshStandardMaterial attach="material-2" map={getTexture(block.type, 'top')} />
          <meshStandardMaterial attach="material-3" map={getTexture(block.type, 'bottom')} />
          <meshStandardMaterial attach="material-4" map={getTexture(block.type, 'front')} />
          <meshStandardMaterial attach="material-5" map={getTexture(block.type, 'back')} />
        </mesh>
      ))}
    </group>
  );
}

function MinecraftWorld() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedSlot, setSelectedSlot] = useState(0); // Selected inventory slot (0–8)
  const inventory: BlockType[] = ['dirt', 'grass', 'stone', 'wood', 'sand', 'stone', 'dirt', 'grass', 'stone']; // Example inventory

  useEffect(() => {
    // Generate initial world
    const initialBlocks: Block[] = [];
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        initialBlocks.push({
          position: [x, -1, z],
          type: 'grass',
        });
      }
    }
    setBlocks(initialBlocks);
  }, []);

  const handleBlockClick = (
    position: [number, number, number],
    normal: [number, number, number],
    button: number,
    camera: THREE.Camera // Pass the camera object as a parameter
  ) => {
    const playerPosition = camera.position; // Get the player's current position

    if (button === 2) {
      // Right click to add block
      const [x, y, z] = position;
      const [nx, ny, nz] = normal;
      const newBlockPosition: [number, number, number] = [x + nx, y + ny, z + nz];

      // Check if the new block position overlaps with the player's position
      const isPlayerBlocking =
        Math.abs(playerPosition.x - newBlockPosition[0]) < 0.5 &&
        Math.abs(playerPosition.y - newBlockPosition[1]) < playerHeight &&
        Math.abs(playerPosition.z - newBlockPosition[2]) < 0.5;

      if (!isPlayerBlocking) {
        // Add block adjacent to the clicked face
        setBlocks([
          ...blocks,
          {
            position: newBlockPosition,
            type: inventory[selectedSlot] as BlockType,
          },
        ]);
      }
    } else if (button === 0) {
      // Left click to remove block
      setBlocks(
        blocks.filter(
          (block) =>
            !(
              block.position[0] === position[0] &&
              block.position[1] === position[1] &&
              block.position[2] === position[2]
            )
        )
      );
    }
  };

  const BlocksWithCamera = () => {
    const { camera } = useThree(); // Access the camera inside the Canvas context
    return (
      <Blocks
        blocks={blocks}
        onBlockClick={(position, normal, button) => {
          handleBlockClick(position, normal, button, camera);
        }}
      />
    );
  };

  return (
    <div className="h-screen w-screen">
      <Crosshair />
      <InventoryBar
        inventory={inventory}
        selectedSlot={selectedSlot}
        setSelectedSlot={setSelectedSlot}
      />

      <Canvas camera={{ position: [0, 5, 5], fov: 75 }}>
        <color attach="background" args={['#87CEEB']} />
        <fog attach="fog" args={['#87CEEB', 10, 20]} />
        <PointerLockControls />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Player blocks={blocks} />
        <BlocksWithCamera />
      </Canvas>
    </div>
  );
}

export default MinecraftWorld;