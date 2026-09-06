import { describe, expect, it } from "vitest";
import { semanticSources } from "@shared/semanticSources";

describe("semantic source registry", () => {
  it("keeps intensity and roots attached to explicit upstream datasets", () => {
    expect(semanticSources.intensity.dataset).toBe("MULTI-SCALE");
    expect(semanticSources.intensity.url).toContain("ainagari/scalar_adjs");
    expect(semanticSources.roots.dataset).toBe("EtymDB");
    expect(semanticSources.roots.url).toContain("droher/etymology-db");
    expect(semanticSources.roots.license).toBe("CC BY-SA 3.0");
  });
});
