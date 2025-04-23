import React, { useEffect, useState } from 'react';
import { BlockType, getTexture } from '../Textures';
import { InventoryItem } from './SharedUI';

interface InventoryBarProps {
  inventory: InventoryItem[];
  selectedSlot: number;
  setSelectedSlot: (slot: number) => void;
}


const InventoryBar: React.FC<InventoryBarProps> = ({ inventory, selectedSlot, setSelectedSlot }) => {
  const handleScroll = (e: WheelEvent) => {
    setSelectedSlot((prevSlot: number) => {
      const newSlot = (prevSlot + (e.deltaY > 0 ? 1 : -1) + inventory.length) % inventory.length; // Wrap around
      return newSlot;
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key >= '1' && e.key <= '9') {
      setSelectedSlot(parseInt(e.key, 10) - 1); // Map keys 1–9 to slots 0–8
    }
  };

  useEffect(() => {
    window.addEventListener('wheel', handleScroll);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2">
      {inventory.map((item, index) => (
        <div
          key={index}
          className={`w-12 h-12 border-2 ${selectedSlot === index ? 'border-yellow-400' : 'border-gray-400'} bg-gray-800 flex justify-center items-center relative`}
        >
          <img
            src={getTexture(item.type, 'all').image.src}
            alt={item.type ?? ""}
            className="w-10 h-10"
          />
          <span className="absolute bottom-0 right-0 text-xs text-white bg-opacity-75 px-1">
            {item.count}
          </span>
        </div>
      ))}
    </div>
    
  );
};

export default InventoryBar;