import type { Route } from "../+types/root";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Games by DaniB" },
    {
      name: "description",
      content: "These are games that I made for my family and friends",
    },
  ];
}

export default function Dashboard() {
  return (
    <div>
      <a href="/memory" className="btn">
        Play Memory Game
      </a>
    </div>
  );
}
