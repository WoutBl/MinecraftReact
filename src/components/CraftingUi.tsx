// CraftingUI.tsx
import React, { useState } from 'react';

export default function CraftingUI({ onClose }: { onClose: () => void }) {
  const [grid, setGrid] = useState<(string | null)[]>(Array(9).fill(null));
  const [result, setResult] = useState<string | null>(null);

  const handlePlaceItem = (index: number, item: string) => {
    const newGrid = [...grid];
    newGrid[index] = item;
    setGrid(newGrid);
    checkCraftingResult(newGrid);
  };

  const checkCraftingResult = (grid: (string | null)[]) => {
    // Simple recipe: if wood is anywhere in grid → planks
    if (grid.includes('wood')) {
      setResult('planks');
    } else {
      setResult(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white p-6 rounded-xl shadow-xl flex flex-col gap-4 items-center">
        <div className="grid grid-cols-3 gap-2">
          {grid.map((slot, i) => (
            <div
              key={i}
              className="w-16 h-16 bg-gray-700 rounded-lg flex justify-center items-center cursor-pointer hover:bg-gray-600 transition"
              onClick={() => handlePlaceItem(i, 'wood')}
            >
              {slot || ''}
            </div>
          ))}
        </div>
        <div className="text-lg">
          ➡ {result || ''}
        </div>
        <button
          onClick={onClose}
          className="bg-red-500 hover:bg-red-600 transition px-4 py-2 rounded-md"
        >
          Close
        </button>
      </div>
    </div>
  );
}
