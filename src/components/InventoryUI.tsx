// src/components/InventoryUI.tsx
import React, { useEffect, useState } from 'react';
import { BlockType } from '../Textures'; // Adjust path
import { DndContext, DragOverlay, UniqueIdentifier, DragStartEvent, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
// Import shared components/types
import { InventoryItem, DndItemData, Slot, DnDSlot, UIArea } from './SharedUI'; // Adjust path if needed

interface InventoryUIProps {
    readonly onClose: () => void;
    readonly inventory: ReadonlyArray<InventoryItem>; // Full inventory
    readonly selectedSlot: number; // Hotbar selection highlight
    // Inventory manipulation functions
    readonly onConsumeItemFromSlot: (slotIndex: number, amount?: number) => void; // Might not be needed if only moving
    readonly onMoveItemInInventory: (fromIndex: number, toIndex: number) => void;
    readonly onSwapItemsInInventory: (index1: number, index2: number) => void;
    readonly onInventoryOpen: () => void; // Callback on mount
    // readonly onAddItemToInventory: (type: BlockType, amount?: number) => void; // Likely not needed here
}

export default function InventoryUI({
    onClose, inventory, selectedSlot,
    onConsumeItemFromSlot, // Keep if actions like splitting stacks are added
    onMoveItemInInventory, onSwapItemsInInventory,
    onInventoryOpen
}: InventoryUIProps) {

    const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(null);
    const [activeDragData, setActiveDragData] = useState<DndItemData | null>(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    // Ensure inventory has 36 slots for display
    const displayInventory = inventory.slice(0, 36).concat(
        Array(Math.max(0, 36 - inventory.length)).fill(null)
    );

    useEffect(() => {
        onInventoryOpen();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key.toLowerCase() === 'e') {
                e.preventDefault(); onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onInventoryOpen]);

    const handleDragStart = (event: DragStartEvent) => {
        const data = event.active.data.current as DndItemData | undefined;
        if (data?.item?.count && data.item.count > 0) {
            setActiveDragId(event.active.id); setActiveDragData(data);
        } else {
            setActiveDragId(null); setActiveDragData(null);
        }
    };

    // handleDragEnd for Inventory ONLY (Inv <-> Inv / Hotbar <-> Inv)
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const cleanup = () => { setActiveDragId(null); setActiveDragData(null); };

        if (!over || !activeDragData?.item || active.id === over.id) return cleanup();

        const sourceData = activeDragData;
        const targetData = over.data.current as DndItemData | undefined;
        if (!targetData) return cleanup();

        // Only handle drags within these areas
        const validAreas: UIArea[] = ['inventory', 'hotbar'];
        if (validAreas.includes(sourceData.area) && validAreas.includes(targetData.area)) {
            console.log(`InvUI DnD: ${sourceData.area}[${sourceData.index}] -> ${targetData.area}[${targetData.index}]`);
            const targetInvItem = inventory[targetData.index]; // Check actual inventory state

            // Target is empty -> Move
            if (!targetInvItem?.type || targetInvItem.count === 0) {
                onMoveItemInInventory(sourceData.index, targetData.index);
            }
            // Target has same item type -> Try to Stack (Optional TODO)
            else if (targetInvItem.type === sourceData.item!.type) {
                 console.warn("Stacking logic not implemented in InventoryUI, swapping instead.");
                 // TODO: Implement stacking logic if needed (consume source, add to target)
                 onSwapItemsInInventory(sourceData.index, targetData.index); // Swap as fallback
            }
             // Target has different item -> Swap
            else {
                onSwapItemsInInventory(sourceData.index, targetData.index);
            }
        } else {
             console.log("Drag ended outside inventory/hotbar areas within InventoryUI.");
        }
        cleanup();
    };

    const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

    // --- renderSlot remains the same logic as before ---
    const renderSlot = (area: UIArea, displayIndex: number) => {
        // Map display index (0-26 for inv, 0-8 for hotbar) to actual inventory index (9-35 for inv, 0-8 for hotbar)
        const inventoryIndex = area === 'inventory' ? displayIndex + 9 : displayIndex;
        const id = `${area}-${inventoryIndex}`; // ID uses actual inventory index
        const item = displayInventory[inventoryIndex] ?? null;
        const isSlotDraggable = !!item?.type && item.count > 0;
        const isSlotDroppable = true;
        // Data payload uses actual inventory index
        const data: DndItemData = { area, index: inventoryIndex, item };

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
                    <p className="text-sm text-stone-400">Inventory</p>
                    {/* Optional: Placeholder for armor slots/player preview */}
                    {/* <div className="h-24 ..."> Armor / Preview </div> */}
                    <div className="grid grid-cols-9 gap-1">
                       {Array.from({ length: 27 }).map((_, i) => renderSlot('inventory', i))} {/* Indices 0-26 */}
                    </div>
                    <div className="grid grid-cols-9 gap-1">
                         {Array.from({ length: 9 }).map((_, i) => renderSlot('hotbar', i))} {/* Indices 0-8 */}
                    </div>
                </div>
            </div>
            <DragOverlay dropAnimation={null}>
                {activeDragId && activeDragData?.item ? ( <Slot item={activeDragData.item} className="cursor-grabbing"/> ) : null}
            </DragOverlay>
        </DndContext>
    );
}