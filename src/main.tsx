import { createRoot } from "react-dom/client";
import App from "./App.tsx";
/* Leaflet: 반드시 Tailwind보다 먼저 로드 (@import 순서 제약 회피) */
import "leaflet/dist/leaflet.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
