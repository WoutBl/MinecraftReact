import * as THREE from 'three';

// Load textures
const textureLoader = new THREE.TextureLoader();

export const textures = {
  dirt: {
    all: textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_dirt.png'),
  },
  stone: {
    all: textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_cobble.png'),
  },
  grass: {
    top: textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/OldGrassTop.png'),
    side: textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/OldGrass.png'),
    bottom: textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_dirt.png'),
  },
  sand: {
    all: textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_sand.png'),
  },
  wood: {
    top: textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_tree_top.png'),
    side: textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_tree.png'),
    bottom: textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_tree_top.png'),
  },
  planks: {
    all: textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_wood.png')
  },
  crafting_table:{
    top: textureLoader.load('https://raw.githubusercontent.com/WoutBl/MinecraftReact/refs/heads/main/assets/Crafting_Table_%2028top_texture%2029_JE2_BE2.png'),
    side: textureLoader.load('https://raw.githubusercontent.com/WoutBl/MinecraftReact/refs/heads/main/assets/Crafting_Table_%2028side_texture%2029_JE4.png'),
    front: textureLoader.load('https://raw.githubusercontent.com/WoutBl/MinecraftReact/refs/heads/main/assets/Crafting_Table_%2028front_texture%2029_JE4.png'),
    bottom: textureLoader.load('https://raw.githubusercontent.com/nebulimity/MoreLikeMinecraft/refs/heads/main/default/default_wood.png'),

  }
};

// Apply nearest filter to all textures
Object.values(textures).forEach((block) => {
  Object.values(block).forEach((texture) => {
    texture.magFilter = THREE.NearestFilter;
  });
});

// Block types
export type BlockType = 'dirt' | 'grass' | 'stone' | 'wood' | 'sand' | 'crafting_table' | 'planks';


export const getTexture = (type: BlockType | null, face: string) => {
  
  switch (type) {
    case 'grass':
      if (face === 'top') return textures.grass.top;
      if (face === 'bottom') return textures.grass.bottom;
      return textures.grass.side; // Default to side texture
    case 'wood':
        if (face === 'top') return textures.wood.top;
        if (face === 'bottom') return textures.wood.bottom;
        return textures.wood.side; // Default to side texture
    case 'crafting_table':
        if (face === 'top') return textures.crafting_table.top;
        if (face === 'bottom') return textures.crafting_table.bottom;
        if (face == 'front') return textures.crafting_table.front
        return textures.crafting_table.side; // Default to side texture
    case 'sand':
        return textures.sand.all;
    case 'dirt':
      return textures.dirt.all;
    case 'stone':
      return textures.stone.all;
    case 'planks':
      return textures.planks.all;
    default:
      return textures.dirt.all;
  }
};