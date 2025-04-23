import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import InventoryBar from './InventoryBar';
import { BlockType, getTexture } from '../Textures';
import Crosshair from './Crosshair';
import CraftingUI from './CraftingUi';
import InventoryUI from './InventoryUI'; // Import the new UI
import { InventoryItem } from './SharedUI';


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
      onPointerDown={(e) => {
        if (e.instanceId === undefined) return;

        if (e.button !== 0 && e.button !== 2) return; // only left/right click

        e.stopPropagation(); // prevent bubbling

        const block = blocks[e.instanceId];
        const type = block.type;

        const normal = [
          Math.round(e.face?.normal.x || 0),
          Math.round(e.face?.normal.y || 0),
          Math.round(e.face?.normal.z || 0),
        ] as [number, number, number];

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
  const [chunks, setChunks] = useState<Chunk[]>([]);
    const [selectedSlot, setSelectedSlot] = useState(0);
    const controlsRef = useRef<any>(null);
    const lastClickTime = useRef(0);
    const CLICK_COOLDOWN = 100;

    // --- UI State ---
    type UiState = 'none' | 'inventory' | 'crafting';
    const [uiOpen, setUiOpen] = useState<UiState>('none');
    const [craftingGridState, setCraftingGridState] = useState<(InventoryItem | null)[]>(Array(9).fill(null)); // Keep track of crafting grid items if needed for return on close
    // ---

    const [inventory, setInventory] = useState<InventoryItem[]>([
        // Initial inventory... ensure it uses InventoryItem structure
        { type: 'dirt', count: 10 }, { type: 'grass', count: 10 }, { type: 'stone', count: 10 },
        { type: 'wood', count: 64 }, { type: 'sand', count: 10 }, { type: 'stone', count: 10 },
        { type: 'crafting_table', count: 1 }, { type: 'planks', count: 20 }, { type: 'stone', count: 10 },
         // Pad to 36 slots with nulls for consistency if needed by display logic
         ...Array(36 - 9).fill(null).map(() => ({ type: null, count: 0 }))
    ]);

    

  const useItemFromInventory = (slot: number) => {
    setInventory(prev => prev.map((item, i) => 
      i === slot ? { ...item, count: Math.max(0, item.count - 1) } : item
    ));
    console.log("Slot: " + slot)
    console.log(inventory)
  };

  const consumeItemFromInventorySlot = useCallback((slotIndex: number, amount: number = 1) => {
    setInventory(prevInv => {
          if (slotIndex < 0 || slotIndex >= prevInv.length || !prevInv[slotIndex] || prevInv[slotIndex].count < amount) {
              console.warn(`Cannot consume ${amount} from slot ${slotIndex}`);
              return prevInv;
          }
          const newInventory = [...prevInv];
          const newItem = { ...newInventory[slotIndex] };
          newItem.count -= amount;

          // If count is zero, clear the slot (set to null or keep structure with count 0)
          if (newItem.count <= 0) {
              newInventory[slotIndex] = null as any; // Or { type: null, count: 0 } if you prefer
          } else {
              newInventory[slotIndex] = newItem;
          }
          return newInventory;
      });
  }, []);

  const reduceItemFromInventory = (prev: typeof inventory, slot: number) => {
    return prev.map((item, i) =>
      i === slot ? { ...item, count: Math.max(0, item.count - 1) } : item
    );
  };

  const addToInventoryHelper = (
    inventory: { type: BlockType; count: number; }[],
    type: BlockType,
    amount: number = 1
  ) => {
    const newInventory = [...inventory];
    const existingSlot = newInventory.findIndex(item => item.type === type);
    if (existingSlot >= 0) {
      newInventory[existingSlot].count += amount;
    } else {
      newInventory.push({ type, count: amount });
    }
    return newInventory;
  };
  
  const addToInventory = (type: BlockType, amount: number = 1) => {
    setInventory(prev => addToInventoryHelper(prev, type, amount));
  };

  const addItemToInventory = useCallback((type: BlockType | null, amount: number = 1) => {
    if (!type) return;
    setInventory(prevInv => {
      const newInventory = [...prevInv];
      let remainingAmount = amount;

      // 1. Try to stack with existing items (up to a stack limit, e.g., 64)
      const stackLimit = 64; // Example stack limit
      for (let i = 0; i < newInventory.length; i++) {
        if (newInventory[i].type === type && newInventory[i].count < stackLimit) {
          const canAdd = stackLimit - newInventory[i].count;
          const amountToAdd = Math.min(remainingAmount, canAdd);
          newInventory[i] = { ...newInventory[i], count: newInventory[i].count + amountToAdd };
          remainingAmount -= amountToAdd;
          if (remainingAmount <= 0) break;
        }
      }

      // 2. If still items remaining, find an empty slot (or add a new slot if inventory isn't fixed size)
      if (remainingAmount > 0) {
        // Find first slot with count 0 or null type (if you implement that)
        const emptySlotIndex = newInventory.findIndex(item => item.count === 0 /* || item.type === null */);
        if (emptySlotIndex !== -1) {
           // Assume we can only add up to stackLimit in one go to an empty slot
           const amountToAdd = Math.min(remainingAmount, stackLimit);
           newInventory[emptySlotIndex] = { type, count: amountToAdd };
           remainingAmount -= amountToAdd;
           // Note: This simple logic doesn't handle adding more than a stack limit if multiple empty slots are needed.
        } else {
            // Optional: If inventory size is dynamic, add a new slot
            // newInventory.push({ type, count: Math.min(remainingAmount, stackLimit) });
            // remainingAmount -= Math.min(remainingAmount, stackLimit);
            console.warn("Inventory full, cannot add item:", type);
        }
      }

      // Handle any remaining amount if inventory is full / no empty slots found
      if (remainingAmount > 0) {
          console.warn(`Could not add ${remainingAmount} of ${type} to inventory (full?).`);
      }


      return newInventory;
    });
  },[]);

  const addItemStackToInventory = useCallback((item: InventoryItem | null) => {
    if (item?.type && item.count > 0) {
         addItemToInventory(item.type, item.count);
    }
 }, [addItemToInventory]);

 

  const addItemToInventorySlot = (slotIndex: number, itemToAdd: InventoryItem): boolean => {
      let success = false;
      setInventory(prevInv => {
          if (slotIndex < 0 || slotIndex >= prevInv.length) return prevInv; // Index out of bounds

          const newInventory = [...prevInv];
          const targetSlot = newInventory[slotIndex];

          // If target slot is empty
          if (!targetSlot || targetSlot.count === 0) {
              newInventory[slotIndex] = { ...itemToAdd }; // Place the new item (usually count 1 from grid)
              success = true;
          }
          // If target slot has the same item type and can stack
          else if (targetSlot.type === itemToAdd.type) {
              const stackLimit = 64; // Define your stack limit
              const canAdd = stackLimit - targetSlot.count;
              if (canAdd >= itemToAdd.count) {
                  newInventory[slotIndex] = { ...targetSlot, count: targetSlot.count + itemToAdd.count };
                  success = true;
              } else {
                  // Cannot stack fully, operation fails for simplicity here
                  // Or: Add partially and handle remainder? More complex.
                  console.warn("Cannot stack item in slot", slotIndex);
                  success = false; // Indicate failure
              }
          } else {
              // Target slot has a different item, cannot add here
              console.warn("Target slot has different item type", slotIndex);
              success = false;
          }

          return newInventory; // Always return the (potentially unchanged) inventory
      });
      // Return the success status determined within the updater
      // NOTE: This immediate return might be tricky with async nature of setState.
      // A more robust way might involve passing a callback or using useEffect.
      // For now, we rely on the logic inside setInventory. The success flag here
      // might not be perfectly reliable immediately after calling this function.
      // Let's return true for now and refine if needed. The CraftingUI logic
      // currently uses the return value to decide if it should fallback to general add.
      // TODO: Re-evaluate reliability of this return value.
      return success; // Or manage success state differently if needed
  };
  const addItemToAvailableSlot = (type: BlockType, amount: number = 1) => {
    // Your existing addItemToInventory logic which finds stacks or empty slots
    addItemToInventory(type, amount); // Assuming addItemToInventory is your general add function
  };

  // Moves an item from one inventory slot to another (assumes target is empty)
  const moveItemInInventory = useCallback((fromIndex: number, toIndex: number) => {
    setInventory(prevInv => {
        if (fromIndex < 0 || fromIndex >= prevInv.length || toIndex < 0 || toIndex >= prevInv.length || fromIndex === toIndex) return prevInv;
        if (!prevInv[fromIndex]) return prevInv; // No item at source
        if (prevInv[toIndex]) return prevInv; // Target not empty (should use swap)

        const newInventory = [...prevInv];
        newInventory[toIndex] = newInventory[fromIndex];
        newInventory[fromIndex] = null as any; // Clear source slot
        return newInventory;
    });
  }, []);

  // Swaps items between two inventory slots
  const swapItemsInInventory = useCallback((index1: number, index2: number) => {
    setInventory(prevInv => {
        if (index1 < 0 || index1 >= prevInv.length || index2 < 0 || index2 >= prevInv.length || index1 === index2) return prevInv;

        const newInventory = [...prevInv];
        const temp = newInventory[index1];
        newInventory[index1] = newInventory[index2];
        newInventory[index2] = temp;
        return newInventory;
    });
  }, []);


  const handleCraftItem = useCallback((resultType: BlockType, resultCount: number, consumedItems: ReadonlyArray<InventoryItem>) => {
      console.log(`Crafting ${resultCount} of ${resultType}`); console.log("Consumed:", consumedItems);
      addItemToInventory(resultType, resultCount);
  }, [addItemToInventory]);


  useEffect(() => {
    const initialChunks = generateWorld(2);
    setChunks(initialChunks);
  }, []);

  

  

  const lockControls = useCallback(() => { controlsRef.current?.lock(); }, []);
  const unlockControls = useCallback(() => { controlsRef.current?.unlock(); }, []);

  const closeUI = useCallback(() => {
      console.log("Closing UI. Current state:", uiOpen);
      // Add item return logic here if CraftingUI doesn't handle it internally on close
      // For now, assume CraftingUI handles its internal state return via its handleClose
      setUiOpen('none');
      setTimeout(lockControls, 50);
  }, [uiOpen, lockControls]); // Removed addItemStackToInventory if CraftingUI handles return


  const openInventoryUI = useCallback(() => {
    console.log("Opening Inventory UI");
    setUiOpen('inventory');
    unlockControls();
  }, [unlockControls]);

  const openCraftingUI = useCallback((/* position?: [number, number, number] */) => { // <-- This function needs to be called
      console.log("Opening Crafting UI called from MinecraftWorld");
      setUiOpen('crafting');
      unlockControls();
  }, [unlockControls]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key.toLowerCase() === 'e') {
              e.preventDefault();
              setUiOpen(currentUi => {
                  if (currentUi === 'inventory' || currentUi === 'crafting') {
                      console.log("E pressed, closing UI");
                      closeUI(); return 'none';
                  } else {
                      console.log("E pressed, opening inventory");
                      openInventoryUI(); return 'inventory';
                  }
              });
          } else if (e.key === 'Escape') {
              if (uiOpen !== 'none') {
                  e.preventDefault(); console.log("Escape pressed, closing UI"); closeUI();
              }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiOpen, closeUI, openInventoryUI]); // Dependencies correct


  const blocksByType = useMemo(() => {
    const groups: Record<BlockType, Block[]> = { dirt: [], grass: [], stone: [], wood: [], sand: [], crafting_table: [], planks: [] };
    chunks.flatMap(chunk => chunk.blocks).forEach(block => {
      groups[block.type].push(block);
    });
    return groups;
  }, [chunks]);

  const handleBlockClick = useCallback((
    position: [number, number, number],
    normal: [number, number, number],
    button: number,
    camera: THREE.Camera
  ) => {
    if (uiOpen !== 'none') return;
    const now = Date.now();
    if (now - lastClickTime.current < CLICK_COOLDOWN) return;
    lastClickTime.current = now;
    const playerPosition = camera.position;

    
    
    
    if (button === 2) {
      
        const selectedItem = inventory[selectedSlot];
        if (selectedItem && selectedItem.type && selectedItem.count > 0) {
          const [x, y, z] = position;
          const [nx, ny, nz] = normal;
          let blockType: BlockType | null = null;

            // Find block type (this could be optimized)
            for (const chunk of chunks) {
                const block = chunk.blocks.find(b => b.position[0] === x && b.position[1] === y && b.position[2] === z);
                if (block) {
                    blockType = block.type;
                    break;
                }
            }
            
          const newBlockPosition: [number, number, number] = [x + nx, y + ny, z + nz];
          const isPlayerBlocking =
            Math.abs(playerPosition.x - newBlockPosition[0]) < 0.5 &&
            Math.abs(playerPosition.y - newBlockPosition[1]) < playerHeight &&
            Math.abs(playerPosition.z - newBlockPosition[2]) < 0.5;

            // Find the chunk containing the new block
            const chunkX = Math.floor(newBlockPosition[0] / 16);
            const chunkZ = Math.floor(newBlockPosition[2] / 16);
            
            let didPlaceBlock = false;
            const newChunks = chunks.map((chunk) => {
              if (chunk.position[0] === chunkX && chunk.position[1] === chunkZ) {
                const alreadyExists = chunk.blocks.some(
                  (b) =>
                    b.position[0] === newBlockPosition[0] &&
                    b.position[1] === newBlockPosition[1] &&
                    b.position[2] === newBlockPosition[2]
                );
          
                if (!alreadyExists && !isPlayerBlocking && inventory[selectedSlot].count > 0) {
                  didPlaceBlock = true;
                  return {
                    ...chunk,
                    blocks: [
                      ...chunk.blocks,
                      {
                        position: newBlockPosition,
                        type: selectedItem.type,
                      },
                    ],
                  };
                }
              }
              return chunk;
            });
            if (didPlaceBlock) {
              setInventory(prev => reduceItemFromInventory(prev, selectedSlot));
              setChunks(newChunks);
            }
          }
          
      
    } else if (button === 0) {
      let removedBlockType: BlockType | null = null;
      let blockRemoved = false;
      let nextInventory = inventory; // Start with current inventory
    
      const newChunks = chunks.map((chunk) => {
        if (blockRemoved) return chunk;
    
        const blockIndex = chunk.blocks.findIndex(b =>
          b.position[0] === position[0] &&
          b.position[1] === position[1] &&
          b.position[2] === position[2]
        );
    
        if (blockIndex !== -1) {
          removedBlockType = chunk.blocks[blockIndex].type;
          blockRemoved = true;

          nextInventory = addToInventoryHelper(inventory, removedBlockType);
          console.log("Calculated next inventory state after adding:", removedBlockType); // Log calculation
    
          const newBlocks = [...chunk.blocks];
          newBlocks.splice(blockIndex, 1);
    
          return {
            ...chunk,
            blocks: newBlocks
          };
        }
    
        return chunk;
      });
    
      if (blockRemoved) {
        console.log("Block removed, applying state updates.");
        setInventory(nextInventory); // Apply the pre-calculated inventory state
        setChunks(newChunks);      // Apply the new chunks state
      } else {
        console.log("No block found at position to remove.");
      }
    }
  }, [uiOpen, chunks, inventory, selectedSlot, openCraftingUI, consumeItemFromInventorySlot, addItemToInventory]);

  const CameraAwareBlocks = useMemo(() => 
    ({ blocks, onBlockClick }: { blocks: Block[], onBlockClick: typeof handleBlockClick }) => {
      const { camera } = useThree();
      return (
        <Blocks
          blocks={blocks}
          onBlockClick={(position, normal, button) => onBlockClick(position, normal, button, camera)} 
          onCraftingOpen={(position) => {
            console.log("onCraftingOpen called in CameraAwareBlocks for position:", position);
            openCraftingUI(/* Pass position if needed */); // Directly call the function that sets the state
        }}/>
      );
    },
    [handleBlockClick, openCraftingUI]);

  return (
    <div className="h-screen w-screen relative"> {/* Ensure relative positioning for absolute children */}
            {/* Crosshair always visible? */}
            <Crosshair />
             {/* InventoryBar always visible? */}
            <InventoryBar inventory={inventory.slice(0, 9)} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} />

            <Canvas camera={{ position: [0, 5, 5], fov: 75 }} className="absolute inset-0 z-0"> {/* Canvas behind UI */}
                <color attach="background" args={['#87CEEB']} />
                <fog attach="fog" args={['#87CEEB', 10, 100]} />
                {/* Only render controls when no UI is open */}
                {uiOpen === 'none' && <PointerLockControls ref={controlsRef} />}
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <Player blocks={chunks.flatMap(chunk => chunk.blocks)} />
                 {/* Render Blocks */}
                 {Object.entries(blocksByType).map(([type, blocks]) => (
                     <CameraAwareBlocks
                        key={type}
                        blocks={blocks}
                        onBlockClick={handleBlockClick} // Pass memoized or updated handler
                     />
                 ))}
            </Canvas>

            {/* Conditional UI Rendering */}
            {uiOpen === 'crafting' && (
                <CraftingUI
                  onClose={closeUI}
                  inventory={inventory}
                  selectedSlot={selectedSlot} // Pass selectedSlot
                  onCraft={handleCraftItem}
                  onConsumeItemFromSlot={consumeItemFromInventorySlot}
                  onAddItemToInventory={addItemToInventory}
                  onMoveItemInInventory={moveItemInInventory}
                  onSwapItemsInInventory={swapItemsInInventory}
                  onCraftingOpen={unlockControls} // Still useful for consistency
              />
            )}

            {uiOpen === 'inventory' && (
                <InventoryUI
                  onClose={closeUI}
                  inventory={inventory}
                  selectedSlot={selectedSlot}
                  onConsumeItemFromSlot={consumeItemFromInventorySlot}
                  // onAddItemToInventory={addItemToInventory} // Not needed?
                  onMoveItemInInventory={moveItemInInventory}
                  onSwapItemsInInventory={swapItemsInInventory}
                  onInventoryOpen={unlockControls}
              />
            )}
        </div>
  );
}


export default MinecraftWorld;