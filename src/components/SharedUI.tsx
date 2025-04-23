// src/components/ui/SharedUI.tsx
import React from 'react';
import { BlockType, getTexture } from '../Textures'; // Adjust path
import { UniqueIdentifier } from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// --- Types ---
export interface InventoryItem {
    readonly type: BlockType | null;
    readonly count: number;
}

export type UIArea = 'grid' | 'inventory' | 'hotbar' | 'armor'; // Added armor for InventoryUI

export interface DndItemData {
    readonly area: UIArea;
    readonly index: number;
    readonly item: InventoryItem | null;
}

// --- Visual Slot Component ---
export interface SlotProps {
    readonly item: InventoryItem | null;
    readonly onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    readonly onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
    readonly className?: string;
    readonly title?: string;
    readonly isResult?: boolean; // Keep if result slot needs special visual
}

export const Slot: React.FC<SlotProps> = ({ item, onClick, onContextMenu, className = '', title = '', isResult = false }) => {
    const blockType = item?.type;
    const count = item?.count;
    const baseStyle = "w-14 h-14 flex justify-center items-center relative select-none";
    // Slightly different style for result slot maybe
    const mcBorderStyle = isResult
        ? "bg-stone-700/70 border-2 border-solid border-stone-500" // Example different border
        : "bg-stone-900/70 border border-solid border-t-stone-600 border-l-stone-600 border-b-stone-950 border-r-stone-950";

    return (
        <div
            className={`${baseStyle} ${mcBorderStyle} ${className}`}
            onClick={onClick}
            onContextMenu={onContextMenu}
            title={title ?? blockType ?? 'Empty slot'}
        >
            {blockType && (
                <>
                    <img
                        src={getTexture(blockType, 'all').image.src}
                        alt={blockType ?? 'empty'}
                        className="w-8 h-8 pointer-events-none"
                        style={{ imageRendering: 'pixelated' }}
                        draggable="false"
                    />
                    {(count !== undefined && count > 1) && (
                        <span
                            className="absolute bottom-0.5 right-0.5 text-sm font-bold text-white"
                            style={{ textShadow: '1px 1px 1px black' }}
                        >
                            {count}
                        </span>
                    )}
                </>
            )}
        </div>
    );
};


// --- DnD Slot Wrapper Component ---
export interface DnDSlotProps {
    readonly id: UniqueIdentifier;
    readonly data: DndItemData;
    readonly children: React.ReactNode;
    readonly className?: string;
    readonly isDraggable: boolean;
    readonly isDroppable: boolean;
}

export const DnDSlot: React.FC<DnDSlotProps> = ({ id, data, children, className = '', isDraggable, isDroppable }) => {
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id, data, disabled: !isDroppable });
    const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({ id, data, disabled: !isDraggable });
    const setNodeRef = (node: HTMLElement | null) => { setDroppableRef(node); setDraggableRef(node); };

    const style = transform ? {
        transform: CSS.Translate.toString(transform), zIndex: 100, cursor: 'grabbing',
    } : { cursor: isDraggable ? 'grab' : 'default' };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (isDraggable && (event.key === 'Enter' || event.key === ' ')) {
            // Basic keyboard interaction placeholder
            console.log("Keyboard interaction on slot:", id);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative ${className} ${isOver ? 'outline outline-2 outline-sky-400' : ''} ${isDragging ? 'opacity-50' : ''}`}
            role="button"
            tabIndex={isDraggable || isDroppable ? 0 : -1}
            {...(isDraggable ? listeners : {})}
            {...(isDraggable ? attributes : {})}
            onKeyDown={handleKeyDown}
        >
            {children}
        </div>
    );
};