// src/components/CraftingUI.tsx
import React, { useEffect, useState } from 'react';
import { BlockType, getTexture } from '../Textures'; // Adjust path
// Import types and the find function separately
import { findMatchingRecipe as findRecipe, CraftingRecipe, RecipePattern } from '../CraftingRecipes'; // Adjust path
import { InventoryItem, DndItemData, Slot, DnDSlot, UIArea } from './SharedUI';

// --- Dnd Imports ---
import {
    DndContext, DragOverlay, useDraggable, useDroppable, UniqueIdentifier,
    DragStartEvent, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// --- Types ---
// Now defined globally or imported (assuming it's also used by MinecraftWorld)

// Grid state uses InventoryItem
type CraftingGridState = (InventoryItem | null)[];


interface CraftingUIProps {
  readonly onClose: () => void;
  readonly inventory: ReadonlyArray<InventoryItem>; // Full inventory needed
  readonly selectedSlot: number; // For hotbar highlight
  readonly onCraft: (result: BlockType, count: number, consumedItems: ReadonlyArray<InventoryItem>) => void;
  readonly onConsumeItemFromSlot: (slotIndex: number, amount?: number) => void;
  readonly onAddItemToInventory: (type: BlockType, amount?: number) => void; // General add for grid->inv drops
  readonly onMoveItemInInventory: (fromIndex: number, toIndex: number) => void;
  readonly onSwapItemsInInventory: (index1: number, index2: number) => void;
  readonly onCraftingOpen: () => void;
}




// --- Main Crafting UI Component ---
export default function CraftingUI({
  onClose, inventory, selectedSlot, onCraft,
  onConsumeItemFromSlot, onAddItemToInventory,
  onMoveItemInInventory, onSwapItemsInInventory,
  onCraftingOpen
}: CraftingUIProps) {

  const [grid, setGrid] = useState<CraftingGridState>(Array(9).fill(null));
  const [matchedRecipe, setMatchedRecipe] = useState<CraftingRecipe | null>(null);
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);
  const [activeDragData, setActiveDragData] = useState<DndItemData | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Pad inventory for display
  const displayInventory = inventory.slice(0, 36).concat(
      Array(Math.max(0, 36 - inventory.length)).fill(null)
  );

  useEffect(() => {
      onCraftingOpen();
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape' || e.key.toLowerCase() === 'e') {
              e.preventDefault(); handleClose();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onCraftingOpen]); // handleClose added

  useEffect(() => {
      const recipe = findRecipe(grid);
      setMatchedRecipe(recipe);
  }, [grid]);


  const handleCraft = (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      console.log("--- handleCraft ---");
      console.log("Attempting craft with Matched Recipe:", matchedRecipe);
      console.log("Current Grid State:", JSON.stringify(grid));


      if (!matchedRecipe?.result) {
          console.log("Craft condition failed: No valid matched recipe.");
          return;
      }

      const recipe = matchedRecipe; // Alias for clarity
      console.log("recipe: " + recipe)
      // --- Calculate Max Craft Multiplier ---
      let maxMultiplier = 0;

      if (recipe.shapeless) {
          const requiredMap = new Map<BlockType, number>();
          recipe.pattern.forEach(req => {
              if (req?.type) { requiredMap.set(req.type, (requiredMap.get(req.type) ?? 0) + (req.count ?? 1)); }
          });

          if (requiredMap.size > 0) {
              const providedMap = new Map<BlockType, number>();
              grid.forEach(prov => { if (prov?.type) { providedMap.set(prov.type, (providedMap.get(prov.type) ?? 0) + prov.count); } });

              let currentMinMult = Infinity;
              for (const [type, reqCount] of requiredMap.entries()) {
                  const provCount = providedMap.get(type) ?? 0;
                  if (reqCount <= 0) continue; // Skip if recipe requires 0 of something
                  if (provCount < reqCount) { // Cannot even craft one
                      currentMinMult = 0; break;
                  }
                  currentMinMult = Math.min(currentMinMult, Math.floor(provCount / reqCount));
              }
              maxMultiplier = isFinite(currentMinMult) ? currentMinMult : 0;
          }
      } else { // Shaped
          let currentMinMult = Infinity;
          let canCraftBase = true;
          recipe.pattern.forEach((requiredItem, index) => {
               // If slot requires an item
               if (requiredItem?.type) {
                  const requiredCountPerCraft = requiredItem.count ?? 1;
                  const gridItem = grid[index];
                  if (gridItem?.type === requiredItem.type && gridItem.count >= requiredCountPerCraft) {
                      currentMinMult = Math.min(currentMinMult, Math.floor(gridItem.count / requiredCountPerCraft));
                  } else {
                      canCraftBase = false; // Missing item or not enough count
                  }
               }
               // If slot must be empty, check if it is
               else if (requiredItem === null && grid[index] !== null) {
                  canCraftBase = false;
               }
               // If canCraftBase becomes false, no need to check further slots for this recipe
               if (!canCraftBase) return;
          });
          maxMultiplier = canCraftBase && isFinite(currentMinMult) ? currentMinMult : 0;
      }
      console.log(`Calculated maxMultiplier: ${maxMultiplier}`);
      // --- End Calculate Max Multiplier ---


      if (maxMultiplier <= 0) {
          console.log("Cannot craft this recipe (maxMultiplier <= 0).");
          return;
      }

      const isShiftClick = event.shiftKey;
      // Ensure craftMultiplier is at least 1 if maxMultiplier > 0
      const craftMultiplier = isShiftClick ? maxMultiplier : (maxMultiplier > 0 ? 1 : 0);

      // Final check if multiplier is valid
      if (craftMultiplier <= 0) {
           console.log("Cannot craft (multiplier is 0).");
           return;
      }

      console.log(`Shift clicked: ${isShiftClick}, Craft Multiplier: ${craftMultiplier}`);

      // --- Consume Ingredients (scaled) ---
      const itemsConsumedInThisCraft: InventoryItem[] = []; // Track total consumption PER TYPE
      const consumptionMapByType = new Map<BlockType, number>(); // Helper to aggregate consumption
      const newGrid = grid.map(item => item ? {...item} : null);
      let consumptionPossible = true;
      console.log("Starting consumption simulation...");

      if (recipe.shapeless) {
          const totalConsumptionMap = new Map<BlockType, number>();
          recipe.pattern.forEach(req => {
              if (req?.type) { totalConsumptionMap.set(req.type, (totalConsumptionMap.get(req.type) ?? 0) + ((req.count ?? 1) * craftMultiplier)); }
          });
          console.log("Shapeless - Total Consumption Needed Map:", totalConsumptionMap);

          const consumedFromGridIndices = new Map<number, number>(); // index -> count consumed

          for (const [type, totalNeeded] of totalConsumptionMap.entries()) {
              if (!consumptionPossible) break;
              let remainingNeeded = totalNeeded;
              for (let i = 0; i < newGrid.length && remainingNeeded > 0; i++) {
                  const slot = newGrid[i];
                  if (slot?.type === type && slot.count > 0) {
                      const alreadyConsumed = consumedFromGridIndices.get(i) ?? 0;
                      const availableInSlot = slot.count - alreadyConsumed;
                      const consumeAmount = Math.min(remainingNeeded, availableInSlot);

                      if (consumeAmount > 0) {
                          consumedFromGridIndices.set(i, alreadyConsumed + consumeAmount);
                          remainingNeeded -= consumeAmount;
                          console.log(` -> Shapeless consume: Slot ${i}, Type ${type}, Amount ${consumeAmount}, Available was ${availableInSlot}, Total Remaining Needed ${remainingNeeded}`);
                      }
                  }
              }
              if (remainingNeeded > 0) {
                  console.error(`Consumption Error (Shapeless): Could not find enough ${type} (still needed ${remainingNeeded})`);
                  consumptionPossible = false;
              } else {
                  // Track total consumed per type if successful for this type
                  consumptionMapByType.set(type, (consumptionMapByType.get(type) ?? 0) + totalNeeded);
              }
          }
           // Apply consumption AFTER checking possibility for ALL types
           if (consumptionPossible) {
              console.log("Shapeless applying consumption from slots:", consumedFromGridIndices);
              consumedFromGridIndices.forEach((countConsumed, index) => {
                  const slot = newGrid[index];
                  if (slot && slot.count >= countConsumed) {
                       newGrid[index] = { ...slot, count: slot.count - countConsumed };
                       if (newGrid[index]?.count === 0) newGrid[index] = null;
                  } else { consumptionPossible = false; } // Should not happen if checks above are correct
              });
           }

      } else { // Shaped
          recipe.pattern.forEach((requiredItem, index) => {
              if (!consumptionPossible) return;
              if (requiredItem?.type) {
                  const requiredCountPerCraft = requiredItem.count ?? 1;
                  const totalToConsume = requiredCountPerCraft * craftMultiplier;
                  const gridItem = newGrid[index];

                  console.log(`Shaped consume check: Slot ${index}, Type ${requiredItem.type}, Need ${totalToConsume}, Have ${gridItem?.count ?? 0}`);

                  if (gridItem?.type === requiredItem.type && gridItem.count >= totalToConsume) {
                       // Track total consumption per type
                       consumptionMapByType.set(gridItem.type, (consumptionMapByType.get(gridItem.type) ?? 0) + totalToConsume);
                       // Apply consumption
                      newGrid[index] = { ...gridItem, count: gridItem.count - totalToConsume };
                      if (newGrid[index]?.count === 0) { newGrid[index] = null; }
                      console.log(` -> Shaped consume: Slot ${index}, Consumed ${totalToConsume}, New Count ${newGrid[index]?.count ?? 0}`);
                  } else {
                      console.error(`Consumption Error (Shaped): Not enough ${requiredItem.type} at index ${index}`);
                      consumptionPossible = false;
                  }
              }
          });
      }
      console.log("Consumption check complete. Possible:", consumptionPossible);
      // --- End Consume Ingredients ---

      // --- Produce Result ---
      if (consumptionPossible) {
          // Convert map to array for the callback
          consumptionMapByType.forEach((count, type) => {
              if(type) itemsConsumedInThisCraft.push({ type, count });
          });

          const totalResultCount = craftMultiplier * recipe.count;
          console.log(`Consumption successful. Calling onCraft: Result=${recipe.result}, Count=${totalResultCount}`);
          console.log("Consumed Items map:", consumptionMapByType);
          console.log("Final grid state to be set:", JSON.stringify(newGrid));

          if (recipe.result) {
              onCraft(recipe.result, totalResultCount, itemsConsumedInThisCraft);
              setGrid(newGrid);
              // Recipe will re-evaluate based on new grid state in useEffect
          } else {
               console.error("Crafting failed: Recipe result is missing!");
          }
      } else {
          console.error("Crafting failed due to consumption error. Grid not changed.");
      }
      // ---
  };

  const handleClose = () => {
      grid.forEach((item: InventoryItem | null) => {
          if (item?.type && item.count > 0) { onAddItemToInventory(item.type, item.count); }
      });
      setGrid(Array(9).fill(null)); setMatchedRecipe(null); onClose();
  };


  const handleDragStart = (event: DragStartEvent) => {
      const data = event.active.data.current as DndItemData | undefined;
      if (data?.item?.count && data.item.count > 0) {
          setActiveDragId(event.active.id); setActiveDragData(data);
      } else {
          setActiveDragId(null); setActiveDragData(null);
      }
  };


    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      const cleanup = () => { setActiveDragId(null); setActiveDragData(null); };

      if (!over || !activeDragData?.item || active.id === over.id) return cleanup();

      const sourceData = activeDragData;
      const targetData = over.data.current as DndItemData | undefined;
      if (!targetData) return cleanup(); // Must drop on a valid target

      console.log(`Crafting DnD End: ${sourceData.area}[${sourceData.index}] -> ${targetData.area}[${targetData.index}]`);

      // --- Logic specific to drops involving the crafting grid ---

      // Moving FROM Grid
      if (sourceData.area === 'grid') {
          const sourceGridItem = sourceData.item!;
          // Grid -> Grid (Move/Swap/Stack)
          if (targetData.area === 'grid') {
            setGrid((prevGrid: CraftingGridState) => {
              const newGrid = [...prevGrid];
              const targetGridItem = newGrid[targetData.index];

              if (!targetGridItem) {
                  newGrid[targetData.index] = sourceGridItem;
                  newGrid[sourceData.index] = null;
              }
              // Use optional chaining (TS18047)
              else if (targetGridItem?.type === sourceGridItem?.type) {
                  // Add null check just in case, though types should match if types match
                  if (targetGridItem && sourceGridItem) {
                      const stackLimit = 64;
                      const spaceAvailable = stackLimit - targetGridItem.count;
                      const amountToMove = Math.min(sourceGridItem.count, spaceAvailable);
                      if (amountToMove > 0) {
                          newGrid[targetData.index] = { ...targetGridItem, count: targetGridItem.count + amountToMove };
                          const remainingSourceCount = sourceGridItem.count - amountToMove;
                          newGrid[sourceData.index] = remainingSourceCount > 0
                              ? { ...sourceGridItem, count: remainingSourceCount } : null;
                      }
                  }
              } else {
                   newGrid[targetData.index] = sourceGridItem;
                   newGrid[sourceData.index] = targetGridItem; // targetGridItem could be null here, which is fine
              }
              return newGrid;
          });
          }
          // Grid -> Inventory/Hotbar ( Treat drop outside grid as returning item)
          else if (targetData.area === 'inventory' || targetData.area === 'hotbar') {
            // Use the inventory callbacks for move/swap
             if (sourceGridItem.type) {
                const targetInvItem = inventory[targetData.index]; // Target is inventory index
                setGrid((prevGrid) => {
                     const newGrid = [...prevGrid];
                     if(newGrid[sourceData.index]?.type === sourceGridItem.type) { // Re-check
                        newGrid[sourceData.index] = null; // Clear grid slot first
                        // Try to move/swap into inventory
                        if (!targetInvItem?.type || targetInvItem.count === 0) {
                            // This is complex: needs a way to add sourceGridItem to inventory[targetData.index]
                            // Fallback to general add is simplest for now
                            console.warn("Grid -> Empty Inv Slot move not fully implemented, using general add");
                            onAddItemToInventory(sourceGridItem.type!, sourceGridItem.count);
                        } else if (targetInvItem.type === sourceGridItem.type) {
                            // TODO: Stacking Grid -> Inv
                            console.warn("Stacking Grid -> Inv not implemented, using general add");
                            onAddItemToInventory(sourceGridItem.type!, sourceGridItem.count);
                        } else {
                            // TODO: Swapping Grid <-> Inv
                            console.warn("Swapping Grid <-> Inv not implemented, using general add");
                            onAddItemToInventory(sourceGridItem.type!, sourceGridItem.count);
                        }
                        return newGrid;
                     }
                     return prevGrid;
                });
             }
        }
    }
    // Moving FROM Inventory/Hotbar
    else if (sourceData.area === 'inventory' || sourceData.area === 'hotbar') {
        const sourceInvItem = sourceData.item!;
        // Inv/Hotbar -> Grid
        if (targetData.area === 'grid') {
            setGrid((prevGrid) => {
                const newGrid = [...prevGrid]; const targetGridItem = newGrid[targetData.index];
                if (!sourceInvItem.type) return prevGrid;
                 // Add/Stack logic
                 if (!targetGridItem) { // Place 1
                    newGrid[targetData.index] = { type: sourceInvItem.type, count: 1 };
                    onConsumeItemFromSlot(sourceData.index, 1);
                } else if (targetGridItem.type === sourceInvItem.type) { // Stack 1
                    const stackLimit = 64;
                    if (targetGridItem.count < stackLimit) {
                        newGrid[targetData.index] = { ...targetGridItem, count: targetGridItem.count + 1 };
                        onConsumeItemFromSlot(sourceData.index, 1);
                    } else { return prevGrid; /* Slot full */ }
                } else { return prevGrid; /* Different item */ }
                return newGrid;
            });
        }
        // Inv/Hotbar -> Inv/Hotbar
        else if (targetData.area === 'inventory' || targetData.area === 'hotbar') {
             const targetInvItem = inventory[targetData.index];
             if (!targetInvItem?.type || targetInvItem.count === 0) {
                 onMoveItemInInventory(sourceData.index, targetData.index);
             } else {
                 // Optional: Add stacking logic here too
                 if(targetInvItem.type === sourceInvItem.type) {
                     console.warn("Stacking within CraftingUI's inventory section TBD, swapping.");
                     onSwapItemsInInventory(sourceData.index, targetData.index);
                 } else {
                     onSwapItemsInInventory(sourceData.index, targetData.index);
                 }
             }
         }
    }
    cleanup();
  };
    // --- End Drag and Drop Handlers ---

    const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

    const renderSlotFunction = (area: UIArea, displayIndex: number) => {
        // Map display index (0-8 grid, 0-26 inv, 0-8 hotbar) to unique ID and correct data index
        let id: string;
        let inventoryIndex: number; // Actual index in the main inventory array (0-35)
        let item: InventoryItem | null = null;
        let isSlotDraggable = false;
        const isSlotDroppable = true;

        if (area === 'grid') {
            id = `grid-${displayIndex}`;
            inventoryIndex = -1; // Not applicable for grid's internal index
            item = grid[displayIndex];
            if (item?.type && item.count > 0) { isSlotDraggable = true; }
        } else { // inventory or hotbar
            inventoryIndex = (area === 'inventory') ? displayIndex + 9 : displayIndex;
            id = `${area}-${inventoryIndex}`; // ID uses actual inventory index
            item = displayInventory[inventoryIndex] ?? null;
            if (item?.type && item.count > 0) { isSlotDraggable = true; }
        }

        if (item && (!item.type || item.count <= 0)) { item = null; }

        // Data uses inventoryIndex for inv/hotbar, and displayIndex for grid
        const dataIndex = area === 'grid' ? displayIndex : inventoryIndex;
        const data: DndItemData = { area, index: dataIndex, item };

        return (
            <DnDSlot key={id} id={id} data={data} isDraggable={isSlotDraggable} isDroppable={isSlotDroppable}>
                <Slot
                    item={item}
                    className={area === 'hotbar' && selectedSlot === inventoryIndex ? '!border-t-sky-300 !border-l-sky-300 !border-b-sky-600 !border-r-sky-600' : ''}
                    onContextMenu={(e) => e.preventDefault()}
                />
            </DnDSlot>
        );
    };

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div
                className="fixed inset-0 flex justify-center items-center z-50"
                onMouseDown={stopPropagation} onClick={stopPropagation} onPointerDown={stopPropagation}
                onContextMenu={(e) => { e.preventDefault(); stopPropagation(e); }}
            >
                <div className="bg-stone-800 border-2 border-t-stone-500 border-l-stone-500 border-b-stone-950 border-r-stone-950 p-4 flex flex-col gap-4 shadow-lg select-none">
                    <p className="text-sm text-stone-400">Crafting</p>
                    {/* Crafting Area */}
                    <div className="flex items-center justify-center gap-4">
                        <div className="grid grid-cols-3 gap-1">
                            {Array.from({ length: 9 }).map((_, i) => renderSlotFunction('grid', i))}
                        </div>
                        <div className="w-8 h-14 flex items-center justify-center"> {/* Arrow */} </div>
                        <div className="relative" title={matchedRecipe ? `Click to craft ${matchedRecipe.count} (Shift+Click for max)` : 'Result'} role="button" tabIndex={matchedRecipe ? 0 : -1}>
                            <Slot item={matchedRecipe ? { type: matchedRecipe.result, count: matchedRecipe.count } : null} onClick={handleCraft} onContextMenu={(e) => e.preventDefault()} className={matchedRecipe ? 'cursor-pointer' : 'cursor-default'} isResult={true}/>
                        </div>
                    </div>

                    {/* Player Inventory Area */}
                    <div className="grid grid-cols-9 gap-1">
                       {Array.from({ length: 27 }).map((_, i) => renderSlotFunction('inventory', i))} {/* Indices 0-26 */}
                    </div>

                    {/* Player Hotbar Area */}
                    <div className="grid grid-cols-9 gap-1">
                         {Array.from({ length: 9 }).map((_, i) => renderSlotFunction('hotbar', i))} {/* Indices 0-8 */}
                    </div>
                </div>
            </div>
            <DragOverlay dropAnimation={null}>
                {activeDragId && activeDragData?.item ? ( <Slot item={activeDragData.item} className="cursor-grabbing"/> ) : null}
            </DragOverlay>
        </DndContext>
    );
}


// --- End Original Slot Component ---