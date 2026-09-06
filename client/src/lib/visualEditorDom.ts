import type { VisualBlockConfig, VisualEditorPage } from "../../../shared/visualEditor";

export const VISUAL_EDITOR_SELECTORS: Record<VisualEditorPage, Record<string, string>> = {
  home: { "home.copy": ".launcher-copy", "home.daily": ".daily-home-link", "home.quiz": ".quiz-choice-card", "home.motus": ".motus-choice-card", "home.definitions": ".definition-choice-card", "home.cta": ".chapter-howto" },
  quiz: { "quiz.heading": ".quiz-main h1", "quiz.prompt": ".quiz-context", "quiz.answers": ".answer-bands", "quiz.trace": ".quiz-trace" },
  motus: { "motus.heading": ".motus-title", "motus.grid": ".motus-grid", "motus.keyboard": ".keyboard", "motus.actions": ".motus-entry-actions" },
  definitions: { "definitions.heading": ".definition-intro", "definitions.board": ".definition-board", "definitions.actions": ".definition-links" },
  multiplayer: { "multiplayer.rail": ".room-meta-rail", "multiplayer.lobby": ".room-primary", "multiplayer.share": ".lobby-share", "multiplayer.ready": ".room-players", "multiplayer.activity": ".player-activity", "multiplayer.jokers": ".joker-dock", "multiplayer.result": ".final-leaderboard" },
};

export const TEXT_SELECTORS: Partial<Record<string, string>> = {
  "home.copy": ".launcher-copy h1",
  "home.daily": ".daily-home-link span",
  "home.quiz": ".quiz-choice-card h2",
  "home.motus": ".motus-choice-card h2",
  "home.definitions": ".definition-choice-card h2",
  "home.cta": ".chapter-howto",
  "quiz.heading": ".quiz-main h1",
  "motus.heading": ".motus-title h1",
  "definitions.heading": ".definition-intro h1",
};

export const NON_HIDEABLE_VISUAL_BLOCKS = new Set(["quiz.answers", "motus.grid", "motus.keyboard", "definitions.board", "multiplayer.lobby", "multiplayer.ready"]);

function cssContent(value: string) { return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\A "); }

function declarations(config: VisualBlockConfig, canHide: boolean, viewport?: "desktop" | "mobile") {
  const spacing = config.spacing;
  const appearance = config.appearance;
  const responsive = viewport ? config.responsive?.[viewport] : undefined;
  const layout = responsive ?? config.layout;
  const fontFamily = appearance?.font === "serif" ? '"DM Serif Display",Georgia,serif' : appearance?.font === "sans" ? '"Space Grotesk",sans-serif' : appearance?.font === "mono" ? '"IBM Plex Mono",monospace' : appearance?.font === "hand" ? "Caveat,cursive" : "";
  const values = [
    canHide && (responsive?.hidden || config.visible === false) ? "display:none!important" : "",
    config.order !== undefined ? `order:${config.order}` : "",
    config.align ? `text-align:${config.align}` : "",
    spacing?.marginTop !== undefined ? `margin-top:${spacing.marginTop}px` : "",
    spacing?.marginRight !== undefined ? `margin-right:${spacing.marginRight}px` : "",
    spacing?.marginBottom !== undefined ? `margin-bottom:${spacing.marginBottom}px` : "",
    spacing?.marginLeft !== undefined ? `margin-left:${spacing.marginLeft}px` : "",
    spacing?.padding !== undefined ? `padding:${spacing.padding}px` : "",
    layout?.x || layout?.y ? `transform:translate(${layout?.x ?? 0}px,${layout?.y ?? 0}px)` : "",
    layout?.width !== undefined ? `width:${layout.width}%` : "",
    responsive?.height !== undefined || config.layout?.minHeight !== undefined ? `min-height:${responsive?.height ?? config.layout?.minHeight}px` : "",
    appearance?.backgroundColor ? `background-color:${appearance.backgroundColor}` : "",
    appearance?.textColor ? `color:${appearance.textColor}` : "",
    appearance?.borderColor ? `border-color:${appearance.borderColor}` : "",
    appearance?.fontSize !== undefined ? `font-size:${appearance.fontSize}px` : "",
    fontFamily ? `font-family:${fontFamily}` : "",
  ].filter(Boolean);
  return values.join(";");
}

export function buildVisualEditorPageCss(page: VisualEditorPage, blocks: Record<string, VisualBlockConfig>, previewViewport?: "desktop" | "mobile") {
  const selectors = VISUAL_EDITOR_SELECTORS[page];
  return Object.entries(selectors).flatMap(([blockId, selector]) => {
    const config = blocks[blockId];
    if (!config) return [];
    const canHide = !NON_HIDEABLE_VISUAL_BLOCKS.has(blockId);
    const rules = [`${selector}{${declarations(config, canHide, previewViewport ?? "desktop")}}`];
    if (!previewViewport && config.responsive?.mobile) rules.push(`@media(max-width:760px){${selector}{${declarations(config, canHide, "mobile")}}}`);
    const textSelector = TEXT_SELECTORS[blockId];
    if (textSelector && config.text) {
      const directSize = blockId.startsWith("home.") ? "inherit" : "clamp(32px,4vw,58px)";
      rules.push(`${textSelector}{font-size:0!important}${textSelector}::before{content:"${cssContent(config.text)}";font:inherit;font-size:${directSize};white-space:pre-line}`);
    }
    return rules;
  }).join("\n");
}

export function pageForVisualEditorPath(pathname: string): VisualEditorPage | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/quiz")) return "quiz";
  if (pathname.startsWith("/motus")) return "motus";
  if (pathname.startsWith("/definitions")) return "definitions";
  if (pathname.startsWith("/multijoueur/")) return "multiplayer";
  return null;
}
