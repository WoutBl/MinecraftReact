// src/config/craftingRecipes.ts
import { BlockType } from './Textures'; // Adjust path as needed

// --- Types ---
export interface InventoryItem {
    type: BlockType | null;
    count: number;
}
export type CraftingGridState = (InventoryItem | null)[];
export type RecipePattern = (Partial<InventoryItem> | null)[];

export interface CraftingRecipe {
    shapeless?: boolean;
    pattern: RecipePattern;
    result: BlockType;
    count: number; // Output count for ONE craft
}

// --- Define Recipes (Base Crafts) ---
export const recipes: CraftingRecipe[] = [
    {
        shapeless: true,
        pattern: [{ type: 'wood', count: 1 }], // Requires 1 wood total
        result: 'planks',
        count: 4,
    },
    {
        pattern: [
            null, { type: 'planks' }, null,
            null, { type: 'planks' }, null,
            null, null, null
        ],
        result: 'wood', // Placeholder: 'stick'
        count: 4,
    },
    {
        pattern: [
            { type: 'planks' }, { type: 'planks' }, null,
            { type: 'planks' }, { type: 'planks' }, null,
            null, null, null
        ],
        result: 'crafting_table',
        count: 1,
    },
    // Add more recipes here...
];

// --- Helper Functions ---

// Compares grid for SHAPED recipes (Checks if AT LEAST required count is present for ONE craft)
const compareShapedGrid = (recipePattern: RecipePattern, currentGrid: CraftingGridState): boolean => {
    if (recipePattern.length !== currentGrid.length || recipePattern.length !== 9) return false;
    for (let i = 0; i < 9; i++) {
        const required = recipePattern[i];
        const provided = currentGrid[i];
        if (required === null) {
            if (provided !== null) return false;
        } else {
            if (!provided) return false; // Slot is empty, but item required
            if (provided.type !== required.type) return false; // Wrong item type
            const requiredCount = required.count ?? 1;
            if (provided.count < requiredCount) return false; // Not enough items for one craft
        }
    }
    return true;
};

// Checks SHAPELESS recipes (Strict check: Grid must contain EXACTLY the items for ONE craft)
const checkShapelessGrid = (recipePattern: RecipePattern, currentGrid: CraftingGridState): boolean => {
    // 1. Map required ingredients for ONE craft
    const requiredMap = new Map<BlockType, number>();
    let totalRequiredCount = 0;
    recipePattern.forEach(req => {
        if (req?.type) {
            const count = req.count ?? 1;
            requiredMap.set(req.type, (requiredMap.get(req.type) ?? 0) + count);
            totalRequiredCount += count;
        }
    });
    if (requiredMap.size === 0) return false; // Recipe requires nothing?

    // 2. Map provided ingredients and count total items in grid
    const providedMap = new Map<BlockType, number>();
    let totalProvidedCount = 0;
    currentGrid.forEach(prov => {
        if (prov?.type) {
            providedMap.set(prov.type, (providedMap.get(prov.type) ?? 0) + prov.count);
            totalProvidedCount++;
        }
    });

    // 3. Strict Comparison for ONE craft match
    // Check if total item counts match exactly
    if (totalProvidedCount !== totalRequiredCount) {
        console.log(`checkShapeless fail: total count mismatch (Grid: ${totalProvidedCount}, Recipe: ${totalRequiredCount})`);
        return false;
    }
    // Check if the distinct item types match exactly
    if (requiredMap.size !== providedMap.size) {
        console.log(`checkShapeless fail: distinct type mismatch (Grid: ${providedMap.size}, Recipe: ${requiredMap.size})`);
        return false;
    }
    // Check if the counts for each required type match exactly
    for (const [type, requiredCount] of requiredMap.entries()) {
        if ((providedMap.get(type) ?? 0) < requiredCount) {
            console.log(`checkShapeless fail: count mismatch for type ${type} (Grid: ${providedMap.get(type) ?? 0}, Recipe: ${requiredCount})`);
            return false;
        }
    }

    console.log("checkShapeless SUCCESS");
    return true; // Exact match for one craft
}

// --- findMatchingRecipe Function ---
// Matches based on the possibility of crafting AT LEAST ONE item
export const findMatchingRecipe = (currentGrid: CraftingGridState): CraftingRecipe | null => {
    for (const recipe of recipes) {
        if (recipe.shapeless) {
            // For shapeless, we *still* need to check if the exact ingredients for ONE craft are present
            // The scaling happens later in handleCraft.
            if (checkShapelessGrid(recipe.pattern, currentGrid)) {
                return recipe;
            }
        } else {
            // Shaped compares using >= for counts, checking if one craft is possible
            if (compareShapedGrid(recipe.pattern, currentGrid)) {
                return recipe;
            }
        }
    }
    return null; // No recipe matched
};