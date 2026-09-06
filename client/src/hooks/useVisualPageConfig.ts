import { trpc } from "@/lib/trpc";
import {
  EMPTY_VISUAL_EDITOR_CONFIG,
  type VisualBlockConfig,
  type VisualEditorPage,
} from "../../../shared/visualEditor";

export function useVisualPageConfig(page: VisualEditorPage) {
  const query = trpc.visualEditor.page.useQuery({ page }, { staleTime: 60_000 });
  const config = query.data?.config ?? EMPTY_VISUAL_EDITOR_CONFIG;
  return {
    ...query,
    config,
    block: (blockId: string): VisualBlockConfig | undefined => config.blocks[blockId],
  };
}
