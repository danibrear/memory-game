export interface Ingredient {
  name: string;
  /** OpenMoji unicode hex code, e.g. "1F355" for pizza */
  openmoji: string;
}

export interface RecipeStep {
  instruction: string;
  correctIngredient: Ingredient;
  distractors: Ingredient[];
}

export type CookingActionType =
  | "stir"
  | "roll"
  | "bake"
  | "blend"
  | "chop"
  | "flip";

export interface CookingAction {
  type: CookingActionType;
  instruction: string;
  /** OpenMoji hex code for the tool icon */
  toolIcon: string;
  /** Number of taps/drags required to complete */
  tapsRequired: number;
}

export interface Recipe {
  id: string;
  name: string;
  /** OpenMoji hex code for finished dish */
  icon: string;
  /** Visual for the cooking area: "bowl", "pan", "plate", "blender", "pot" */
  cookware: string;
  /** OpenMoji hex code for the cookware */
  cookwareIcon: string;
  steps: RecipeStep[];
  /** Actions to perform after all ingredients are added */
  actions: CookingAction[];
}

// OpenMoji hex codes for food & cooking items
// Reference: https://openmoji.org/library/
const INGREDIENTS = {
  // Fruits & Veggies
  tomato: { name: "Tomato", openmoji: "1F345" },
  lettuce: { name: "Lettuce", openmoji: "1F96C" },
  carrot: { name: "Carrot", openmoji: "1F955" },
  broccoli: { name: "Broccoli", openmoji: "1F966" },
  corn: { name: "Corn", openmoji: "1F33D" },
  potato: { name: "Potato", openmoji: "1F954" },
  onion: { name: "Onion", openmoji: "1F9C5" },
  garlic: { name: "Garlic", openmoji: "1F9C4" },
  mushroom: { name: "Mushroom", openmoji: "1F344" },
  avocado: { name: "Avocado", openmoji: "1F951" },
  cucumber: { name: "Cucumber", openmoji: "1F952" },
  hotPepper: { name: "Hot Pepper", openmoji: "1F336" },
  banana: { name: "Banana", openmoji: "1F34C" },
  strawberry: { name: "Strawberry", openmoji: "1F353" },
  blueberry: { name: "Blueberries", openmoji: "1FAD0" },
  watermelon: { name: "Watermelon", openmoji: "1F349" },
  apple: { name: "Apple", openmoji: "1F34E" },
  peach: { name: "Peach", openmoji: "1F351" },
  cherry: { name: "Cherries", openmoji: "1F352" },
  lemon: { name: "Lemon", openmoji: "1F34B" },

  // Dairy & Protein
  egg: { name: "Egg", openmoji: "1F95A" },
  cheese: { name: "Cheese", openmoji: "1F9C0" },
  milk: { name: "Milk", openmoji: "1F95B" },
  butter: { name: "Butter", openmoji: "1F9C8" },

  // Bread & Grains
  bread: { name: "Bread", openmoji: "1F35E" },
  rice: { name: "Rice", openmoji: "1F35A" },
  croissant: { name: "Croissant", openmoji: "1F950" },

  // Meat & Fish
  meat: { name: "Meat", openmoji: "1F969" },
  bacon: { name: "Bacon", openmoji: "1F953" },
  shrimp: { name: "Shrimp", openmoji: "1F990" },
  fish: { name: "Fish", openmoji: "1F41F" },

  // Condiments & Extras
  salt: { name: "Salt", openmoji: "1F9C2" },
  honey: { name: "Honey", openmoji: "1F36F" },
  chocolate: { name: "Chocolate", openmoji: "1F36B" },
  iceCream: { name: "Ice Cream", openmoji: "1F368" },
  cookie: { name: "Cookie", openmoji: "1F36A" },
  candy: { name: "Candy", openmoji: "1F36C" },
} as const;

export const recipes: Recipe[] = [
  {
    id: "pizza",
    name: "Pizza",
    icon: "1F355",
    cookware: "pan",
    cookwareIcon: "1F373",
    steps: [
      {
        instruction: "Start with the bread dough! 🍞",
        correctIngredient: INGREDIENTS.bread,
        distractors: [INGREDIENTS.rice, INGREDIENTS.cookie, INGREDIENTS.banana],
      },
      {
        instruction: "Add the tomato sauce! 🍅",
        correctIngredient: INGREDIENTS.tomato,
        distractors: [
          INGREDIENTS.lemon,
          INGREDIENTS.blueberry,
          INGREDIENTS.avocado,
        ],
      },
      {
        instruction: "Sprinkle the cheese! 🧀",
        correctIngredient: INGREDIENTS.cheese,
        distractors: [
          INGREDIENTS.chocolate,
          INGREDIENTS.butter,
          INGREDIENTS.honey,
        ],
      },
      {
        instruction: "Add the mushrooms! 🍄",
        correctIngredient: INGREDIENTS.mushroom,
        distractors: [INGREDIENTS.shrimp, INGREDIENTS.candy, INGREDIENTS.peach],
      },
    ],
    actions: [
      {
        type: "roll",
        instruction: "Roll out the dough! 🤌",
        toolIcon: "1F4CF",
        tapsRequired: 5,
      },
      {
        type: "bake",
        instruction: "Put it in the oven! 🔥",
        toolIcon: "1F525",
        tapsRequired: 4,
      },
    ],
  },
  {
    id: "smoothie",
    name: "Smoothie",
    icon: "1F964",
    cookware: "blender",
    cookwareIcon: "1F964",
    steps: [
      {
        instruction: "Pour in the milk! 🥛",
        correctIngredient: INGREDIENTS.milk,
        distractors: [INGREDIENTS.salt, INGREDIENTS.garlic, INGREDIENTS.meat],
      },
      {
        instruction: "Add a banana! 🍌",
        correctIngredient: INGREDIENTS.banana,
        distractors: [INGREDIENTS.potato, INGREDIENTS.onion, INGREDIENTS.bread],
      },
      {
        instruction: "Drop in the strawberries! 🍓",
        correctIngredient: INGREDIENTS.strawberry,
        distractors: [
          INGREDIENTS.hotPepper,
          INGREDIENTS.corn,
          INGREDIENTS.fish,
        ],
      },
      {
        instruction: "Add some blueberries! 🫐",
        correctIngredient: INGREDIENTS.blueberry,
        distractors: [INGREDIENTS.mushroom, INGREDIENTS.bacon, INGREDIENTS.egg],
      },
    ],
    actions: [
      {
        type: "blend",
        instruction: "Blend it all together! 🌀",
        toolIcon: "1F300",
        tapsRequired: 6,
      },
    ],
  },
  {
    id: "salad",
    name: "Salad",
    icon: "1F957",
    cookware: "bowl",
    cookwareIcon: "1F963",
    steps: [
      {
        instruction: "Start with the lettuce! 🥬",
        correctIngredient: INGREDIENTS.lettuce,
        distractors: [
          INGREDIENTS.chocolate,
          INGREDIENTS.bread,
          INGREDIENTS.iceCream,
        ],
      },
      {
        instruction: "Chop up a tomato! 🍅",
        correctIngredient: INGREDIENTS.tomato,
        distractors: [
          INGREDIENTS.banana,
          INGREDIENTS.cookie,
          INGREDIENTS.candy,
        ],
      },
      {
        instruction: "Slice the cucumber! 🥒",
        correctIngredient: INGREDIENTS.cucumber,
        distractors: [
          INGREDIENTS.bacon,
          INGREDIENTS.butter,
          INGREDIENTS.cherry,
        ],
      },
      {
        instruction: "Add the carrot! 🥕",
        correctIngredient: INGREDIENTS.carrot,
        distractors: [
          INGREDIENTS.shrimp,
          INGREDIENTS.honey,
          INGREDIENTS.croissant,
        ],
      },
    ],
    actions: [
      {
        type: "stir",
        instruction: "Mix the salad with a spoon! 🥄",
        toolIcon: "1F944",
        tapsRequired: 5,
      },
    ],
  },
  {
    id: "pancakes",
    name: "Pancakes",
    icon: "1F95E",
    cookware: "pan",
    cookwareIcon: "1F373",
    steps: [
      {
        instruction: "Crack the eggs! 🥚",
        correctIngredient: INGREDIENTS.egg,
        distractors: [
          INGREDIENTS.tomato,
          INGREDIENTS.fish,
          INGREDIENTS.avocado,
        ],
      },
      {
        instruction: "Pour in the milk! 🥛",
        correctIngredient: INGREDIENTS.milk,
        distractors: [
          INGREDIENTS.lemon,
          INGREDIENTS.mushroom,
          INGREDIENTS.rice,
        ],
      },
      {
        instruction: "Add some butter! 🧈",
        correctIngredient: INGREDIENTS.butter,
        distractors: [
          INGREDIENTS.broccoli,
          INGREDIENTS.shrimp,
          INGREDIENTS.watermelon,
        ],
      },
      {
        instruction: "Drizzle with honey! 🍯",
        correctIngredient: INGREDIENTS.honey,
        distractors: [INGREDIENTS.garlic, INGREDIENTS.salt, INGREDIENTS.onion],
      },
    ],
    actions: [
      {
        type: "stir",
        instruction: "Stir the batter! 🥄",
        toolIcon: "1F944",
        tapsRequired: 5,
      },
      {
        type: "flip",
        instruction: "Flip the pancake! 🥞",
        toolIcon: "1F95E",
        tapsRequired: 3,
      },
    ],
  },
  {
    id: "soup",
    name: "Soup",
    icon: "1F372",
    cookware: "pot",
    cookwareIcon: "1F372",
    steps: [
      {
        instruction: "Add the potato! 🥔",
        correctIngredient: INGREDIENTS.potato,
        distractors: [
          INGREDIENTS.chocolate,
          INGREDIENTS.iceCream,
          INGREDIENTS.banana,
        ],
      },
      {
        instruction: "Chop the carrot! 🥕",
        correctIngredient: INGREDIENTS.carrot,
        distractors: [
          INGREDIENTS.candy,
          INGREDIENTS.strawberry,
          INGREDIENTS.cookie,
        ],
      },
      {
        instruction: "Add the onion! 🧅",
        correctIngredient: INGREDIENTS.onion,
        distractors: [
          INGREDIENTS.peach,
          INGREDIENTS.croissant,
          INGREDIENTS.cheese,
        ],
      },
      {
        instruction: "Add some corn! 🌽",
        correctIngredient: INGREDIENTS.corn,
        distractors: [INGREDIENTS.bacon, INGREDIENTS.cherry, INGREDIENTS.bread],
      },
      {
        instruction: "Season with salt! 🧂",
        correctIngredient: INGREDIENTS.salt,
        distractors: [
          INGREDIENTS.honey,
          INGREDIENTS.watermelon,
          INGREDIENTS.blueberry,
        ],
      },
    ],
    actions: [
      {
        type: "stir",
        instruction: "Stir the soup! 🥄",
        toolIcon: "1F944",
        tapsRequired: 6,
      },
      {
        type: "bake",
        instruction: "Let it simmer on the stove! 🔥",
        toolIcon: "1F525",
        tapsRequired: 4,
      },
    ],
  },
  {
    id: "sandwich",
    name: "Sandwich",
    icon: "1F96A",
    cookware: "plate",
    cookwareIcon: "1F37D",
    steps: [
      {
        instruction: "Start with the bread! 🍞",
        correctIngredient: INGREDIENTS.bread,
        distractors: [INGREDIENTS.rice, INGREDIENTS.potato, INGREDIENTS.corn],
      },
      {
        instruction: "Add the cheese! 🧀",
        correctIngredient: INGREDIENTS.cheese,
        distractors: [
          INGREDIENTS.chocolate,
          INGREDIENTS.iceCream,
          INGREDIENTS.candy,
        ],
      },
      {
        instruction: "Put on the lettuce! 🥬",
        correctIngredient: INGREDIENTS.lettuce,
        distractors: [
          INGREDIENTS.banana,
          INGREDIENTS.lemon,
          INGREDIENTS.cherry,
        ],
      },
      {
        instruction: "Add a tomato slice! 🍅",
        correctIngredient: INGREDIENTS.tomato,
        distractors: [
          INGREDIENTS.mushroom,
          INGREDIENTS.fish,
          INGREDIENTS.garlic,
        ],
      },
    ],
    actions: [
      {
        type: "chop",
        instruction: "Cut the sandwich in half! 🔪",
        toolIcon: "1F52A",
        tapsRequired: 3,
      },
    ],
  },
];
