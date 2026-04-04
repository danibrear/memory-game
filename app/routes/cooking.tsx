import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import { Box, Container, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import OpenMojiImg from "~/components/OpenMojiImg";
import {
  recipes,
  type CookingAction,
  type Ingredient,
  type Recipe,
} from "~/data/recipes";
import { clearStoredData, getStoredData, setStoredData } from "~/storage";
import type { Route } from "./+types/cooking";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Kitchen - Games by DaniB" },
    { name: "description", content: "Cook yummy food!" },
  ];
}

type GameState = "SELECT" | "COOKING" | "FINISHED";

function DraggableIngredient({
  ingredient,
  index,
  disabled,
}: {
  ingredient: Ingredient;
  index: number;
  disabled: boolean;
}) {
  const { ref, isDragging } = useDraggable({
    id: `ingredient-${index}-${ingredient.openmoji}`,
    disabled,
    data: { ingredient },
  });

  return (
    <div
      ref={ref}
      className={`cooking-ingredient ${isDragging ? "cooking-dragging" : ""} ${disabled ? "cooking-disabled" : ""}`}>
      <OpenMojiImg code={ingredient.openmoji} alt={ingredient.name} size={72} />
      <span className="cooking-ingredient-label">{ingredient.name}</span>
    </div>
  );
}

function CookingArea({
  recipe,
  addedIngredients,
}: {
  recipe: Recipe;
  addedIngredients: Ingredient[];
}) {
  const { ref, isDropTarget } = useDroppable({
    id: "cooking-area",
  });

  return (
    <div
      ref={ref}
      className={`cooking-dropzone ${isDropTarget ? "cooking-dropzone-active" : ""}`}>
      <OpenMojiImg
        code={recipe.cookwareIcon}
        alt={recipe.cookware}
        size={100}
        style={{ opacity: 0.3 }}
      />
      <div className="cooking-added-items">
        {addedIngredients.map((ing, i) => (
          <div key={i} className="cooking-added-item">
            <OpenMojiImg code={ing.openmoji} alt={ing.name} size={48} />
          </div>
        ))}
      </div>
      <Typography variant="body2" sx={{ mt: 1, opacity: 0.6, fontWeight: 500 }}>
        {isDropTarget ? "Drop it here!" : "Drag ingredients here!"}
      </Typography>
    </div>
  );
}

function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function RecipeSelect({ onSelect }: { onSelect: (recipe: Recipe) => void }) {
  return (
    <Container maxWidth="sm">
      <Typography variant="h4" sx={{ textAlign: "center", mb: 3 }}>
        🧑‍🍳 What shall we cook?
      </Typography>
      <div className="cooking-recipe-grid">
        {recipes.map((recipe) => (
          <button
            key={recipe.id}
            className="cooking-recipe-card"
            onClick={() => onSelect(recipe)}>
            <OpenMojiImg code={recipe.icon} alt={recipe.name} size={80} />
            <Typography variant="h6" sx={{ mt: 1 }}>
              {recipe.name}
            </Typography>
          </button>
        ))}
      </div>
    </Container>
  );
}

const ACTION_LABELS: Record<string, string> = {
  stir: "Keep stirring!",
  roll: "Keep rolling!",
  bake: "Wait for it to cook!",
  blend: "Keep blending!",
  chop: "Keep chopping!",
  flip: "Flip it!",
};

const ACTION_ANIMATIONS: Record<string, string> = {
  stir: "cooking-action-stir",
  roll: "cooking-action-roll",
  bake: "cooking-action-bake",
  blend: "cooking-action-blend",
  chop: "cooking-action-chop",
  flip: "cooking-action-flip",
};

function ActionStep({
  action,
  recipe,
  stepLabel,
  onComplete,
}: {
  action: CookingAction;
  recipe: Recipe;
  stepLabel: string;
  onComplete: () => void;
}) {
  const [taps, setTaps] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [done, setDone] = useState(false);

  const progress = Math.min(taps / action.tapsRequired, 1);

  useEffect(() => {
    if (taps >= action.tapsRequired && !done) {
      setDone(true);
      setTimeout(onComplete, 800);
    }
  }, [taps, action.tapsRequired, done, onComplete]);

  const handleTap = () => {
    if (done) return;
    setTaps((t) => t + 1);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <>
      <div
        className={`cooking-instruction ${done ? "cooking-instruction-correct" : ""}`}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {action.instruction}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.6, mt: 0.5 }}>
          {stepLabel}
        </Typography>
      </div>

      {/* Action area */}
      <div className="cooking-action-area">
        {/* Cookware in center */}
        <div
          className={`cooking-action-cookware ${isAnimating ? ACTION_ANIMATIONS[action.type] : ""}`}>
          <OpenMojiImg
            code={recipe.cookwareIcon}
            alt={recipe.cookware}
            size={120}
          />
        </div>

        {/* Tappable tool */}
        <button
          className={`cooking-action-tool ${isAnimating ? "cooking-action-tool-active" : ""} ${done ? "cooking-disabled" : ""}`}
          onClick={handleTap}
          disabled={done}>
          <OpenMojiImg code={action.toolIcon} alt={action.type} size={80} />
          <span className="cooking-ingredient-label">
            {done ? "Done! ✅" : ACTION_LABELS[action.type]}
          </span>
        </button>

        {/* Progress bar */}
        <div className="cooking-action-progress-bar">
          <div
            className="cooking-action-progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <Typography variant="body2" sx={{ opacity: 0.5, mt: 0.5 }}>
          {done
            ? "Great job!"
            : `Tap ${action.tapsRequired - taps} more time${action.tapsRequired - taps !== 1 ? "s" : ""}!`}
        </Typography>
      </div>
    </>
  );
}

function CookingScreen({
  recipe,
  onFinish,
}: {
  recipe: Recipe;
  onFinish: () => void;
}) {
  const [phase, setPhase] = useState<"ingredients" | "actions">("ingredients");
  const [currentStep, setCurrentStep] = useState(0);
  const [currentAction, setCurrentAction] = useState(0);
  const [addedIngredients, setAddedIngredients] = useState<Ingredient[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  const step = recipe.steps[currentStep];
  const totalDots = recipe.steps.length + recipe.actions.length;

  const shuffledOptions = useMemo(() => {
    if (!step) return [];
    return shuffle([step.correctIngredient, ...step.distractors]);
  }, [currentStep, recipe.id]);

  // Transition from ingredients → actions → finished
  useEffect(() => {
    if (phase === "ingredients" && currentStep >= recipe.steps.length) {
      if (recipe.actions.length > 0) {
        setPhase("actions");
        setCurrentAction(0);
      } else {
        const timer = setTimeout(onFinish, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [
    phase,
    currentStep,
    recipe.steps.length,
    recipe.actions.length,
    onFinish,
  ]);

  useEffect(() => {
    if (phase === "actions" && currentAction >= recipe.actions.length) {
      const timer = setTimeout(onFinish, 600);
      return () => clearTimeout(timer);
    }
  }, [phase, currentAction, recipe.actions.length, onFinish]);

  const handleDragEnd = useCallback(
    (event: any) => {
      if (event.canceled) return;
      const target = event.operation.target;
      if (!target || target.id !== "cooking-area") return;

      const draggedIngredient = event.operation.source?.data?.ingredient as
        | Ingredient
        | undefined;
      if (!draggedIngredient || !step) return;

      if (draggedIngredient.openmoji === step.correctIngredient.openmoji) {
        setFeedback("correct");
        setAddedIngredients((prev) => [...prev, draggedIngredient]);
        setTimeout(() => {
          setFeedback(null);
          setCurrentStep((s) => s + 1);
        }, 800);
      } else {
        setFeedback("wrong");
        setTimeout(() => setFeedback(null), 600);
      }
    },
    [step],
  );

  const handleActionComplete = useCallback(() => {
    setCurrentAction((a) => a + 1);
  }, []);

  if (phase === "actions" && currentAction < recipe.actions.length) {
    const completedDots = recipe.steps.length + currentAction;
    const activeDot = recipe.steps.length + currentAction;
    return (
      <Container maxWidth="sm" sx={{ textAlign: "center" }}>
        {/* Progress */}
        <div className="cooking-progress">
          {Array.from({ length: totalDots }).map((_, i) => (
            <div
              key={i}
              className={`cooking-progress-dot ${i < completedDots ? "done" : ""} ${i === activeDot ? "active" : ""}`}
            />
          ))}
        </div>
        <ActionStep
          key={currentAction}
          action={recipe.actions[currentAction]}
          recipe={recipe}
          stepLabel={`Step ${recipe.steps.length + currentAction + 1} of ${totalDots}`}
          onComplete={handleActionComplete}
        />
      </Container>
    );
  }

  if (!step) return null;

  const activeDot = currentStep;
  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <Container maxWidth="sm" sx={{ textAlign: "center" }}>
        {/* Progress */}
        <div className="cooking-progress">
          {Array.from({ length: totalDots }).map((_, i) => (
            <div
              key={i}
              className={`cooking-progress-dot ${i < currentStep ? "done" : ""} ${i === activeDot ? "active" : ""}`}
            />
          ))}
        </div>

        {/* Instruction */}
        <div
          className={`cooking-instruction ${feedback === "correct" ? "cooking-instruction-correct" : ""} ${feedback === "wrong" ? "cooking-instruction-wrong" : ""}`}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {step.instruction}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.6, mt: 0.5 }}>
            Step {currentStep + 1} of {totalDots}
          </Typography>
        </div>

        {/* Drop target */}
        <CookingArea recipe={recipe} addedIngredients={addedIngredients} />

        {/* Draggable ingredients */}
        <div className="cooking-options">
          {shuffledOptions.map((ingredient, i) => (
            <DraggableIngredient
              key={`${currentStep}-${ingredient.openmoji}-${i}`}
              ingredient={ingredient}
              index={i}
              disabled={feedback !== null}
            />
          ))}
        </div>
      </Container>
    </DragDropProvider>
  );
}

function FinishedScreen({
  recipe,
  onPlayAgain,
  onNewRecipe,
}: {
  recipe: Recipe;
  onPlayAgain: () => void;
  onNewRecipe: () => void;
}) {
  return (
    <Container maxWidth="sm" sx={{ textAlign: "center" }}>
      <div className="cooking-celebration">
        <div className="cooking-stars">⭐ 🎉 ⭐</div>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Yummy! You made {recipe.name}!
        </Typography>
        <div className="cooking-finished-dish">
          <OpenMojiImg code={recipe.icon} alt={recipe.name} size={140} />
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginTop: 24,
          }}>
          <button className="btn" onClick={onPlayAgain}>
            Cook Again! 🔁
          </button>
          <button className="btn" onClick={onNewRecipe}>
            New Recipe! 📖
          </button>
        </div>
      </div>
    </Container>
  );
}

export default function Cooking() {
  const [gameState, setGameState] = useState<GameState>("SELECT");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore state
  useEffect(() => {
    const stored = getStoredData("cooking-game-state");
    if (stored?.recipeId && stored?.gameState) {
      const recipe = recipes.find((r) => r.id === stored.recipeId);
      if (recipe) {
        setSelectedRecipe(recipe);
        setGameState(stored.gameState);
      }
    }
    setIsLoading(false);
  }, []);

  // Persist state
  useEffect(() => {
    if (isLoading) return;
    if (gameState === "SELECT") {
      clearStoredData("cooking-game-state");
    } else if (selectedRecipe) {
      setStoredData("cooking-game-state", {
        gameState,
        recipeId: selectedRecipe.id,
      });
    }
  }, [gameState, selectedRecipe, isLoading]);

  const handleSelectRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setGameState("COOKING");
  };

  const handleFinish = useCallback(() => {
    setGameState("FINISHED");
    clearStoredData("cooking-game-state");
  }, []);

  const handlePlayAgain = () => {
    setGameState("COOKING");
  };

  const handleNewRecipe = () => {
    setSelectedRecipe(null);
    setGameState("SELECT");
  };

  if (isLoading) return null;

  return (
    <Box sx={{ pb: 4 }}>
      {gameState === "SELECT" && <RecipeSelect onSelect={handleSelectRecipe} />}
      {gameState === "COOKING" && selectedRecipe && (
        <CookingScreen
          key={selectedRecipe.id + "-" + gameState}
          recipe={selectedRecipe}
          onFinish={handleFinish}
        />
      )}
      {gameState === "FINISHED" && selectedRecipe && (
        <FinishedScreen
          recipe={selectedRecipe}
          onPlayAgain={handlePlayAgain}
          onNewRecipe={handleNewRecipe}
        />
      )}
      <Typography
        variant="caption"
        sx={{
          display: "block",
          textAlign: "center",
          mt: 4,
          opacity: 0.5,
        }}>
        Emoji graphics by{" "}
        <a
          href="https://openmoji.org/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit" }}>
          OpenMoji
        </a>{" "}
        — CC BY-SA 4.0
      </Typography>
    </Box>
  );
}
