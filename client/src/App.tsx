import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import ThemeToggle from "./components/ThemeToggle";
import TextureToggle from "./components/TextureToggle";
import VisualEditorRuntime from "./components/VisualEditorRuntime";
import PageNavigationAids from "./components/PageNavigationAids";
import SystemBanner from "./components/SystemBanner";
import GrimoireTrigger from "./components/GrimoireTrigger";
import DefinitionMatch from "./pages/DefinitionMatch";
import DefinitionSetup from "./pages/DefinitionSetup";
import DailyGame from "./pages/DailyGame";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import MotusGame from "./pages/MotusGame";
import MotusSetup from "./pages/MotusSetup";
import MultiplayerRoom from "./pages/MultiplayerRoom";
import MultiplayerSetup from "./pages/MultiplayerSetup";
import MultiplayerAccess from "./pages/MultiplayerAccess";
import QuizGame from "./pages/QuizGame";
import QuizSetup from "./pages/QuizSetup";
import VisualEditor from "./pages/VisualEditor";
import CodeEditor from "./pages/CodeEditor";
import AdminPortal from "./pages/AdminPortal";
import HerbariumPage from "./pages/HerbariumPage";
import "./paper-grid.css";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/jeu-du-jour"}>{() => <DailyGame />}</Route>
      <Route path={"/jeu-du-jour/mystere"}>
        {() => <DailyGame modeOverride="mystery" />}
      </Route>
      <Route path={"/jeu-du-jour/pyramide"}>
        {() => <DailyGame modeOverride="pyramid" />}
      </Route>
      <Route path={"/jeu-du-jour/encheres"}>
        {() => <DailyGame modeOverride="auction" />}
      </Route>
      <Route path={"/definitions/jouer"} component={DefinitionMatch} />
      <Route path={"/definitions"} component={DefinitionSetup} />
      <Route path={"/definitions/multijoueur"}>
        {() => <MultiplayerAccess gameMode="definition" />}
      </Route>
      <Route path={"/definitions/multijoueur/creer"}>
        {() => <MultiplayerSetup gameMode="definition" flow="create" />}
      </Route>
      <Route path={"/definitions/multijoueur/rejoindre"}>
        {() => <MultiplayerSetup gameMode="definition" flow="join" />}
      </Route>
      <Route path={"/quiz"} component={QuizSetup} />
      <Route path={"/quiz/jouer"} component={QuizGame} />
      <Route path={"/quiz/multijoueur"}>
        {() => <MultiplayerAccess gameMode="quiz" />}
      </Route>
      <Route path={"/quiz/multijoueur/creer"}>
        {() => <MultiplayerSetup gameMode="quiz" flow="create" />}
      </Route>
      <Route path={"/quiz/multijoueur/rejoindre"}>
        {() => <MultiplayerSetup gameMode="quiz" flow="join" />}
      </Route>
      <Route path={"/motus"} component={MotusSetup} />
      <Route path={"/motus/jouer"} component={MotusGame} />
      <Route path={"/motus/multijoueur"}>
        {() => <MultiplayerAccess gameMode="motus" />}
      </Route>
      <Route path={"/motus/multijoueur/creer"}>
        {() => <MultiplayerSetup gameMode="motus" flow="create" />}
      </Route>
      <Route path={"/motus/multijoueur/rejoindre"}>
        {() => <MultiplayerSetup gameMode="motus" flow="join" />}
      </Route>
      <Route path={"/arbre"} component={HerbariumPage} />
      <Route path={"/multijoueur/:code"} component={MultiplayerRoom} />
      <Route path={"/atelier"} component={VisualEditor} />
      <Route path={"/editor"} component={CodeEditor} />
      <Route path={"/administration"} component={AdminPortal} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <VisualEditorRuntime />
          <SystemBanner />
          <GrimoireTrigger />
          <a className="skip-link" href="#main-content">
            Aller directement au contenu
          </a>
          <div className="global-controls" aria-label="Réglages d’affichage">
            <TextureToggle />
            <ThemeToggle />
          </div>
          <div id="main-content" className="app-shell" tabIndex={-1}>
            <PageNavigationAids />
            <Router />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
