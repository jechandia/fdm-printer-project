import { describe, expect, it } from "vite-plus/test";
import type { VersionDto } from "@/services/prusa-link/dto/version.dto";
import {
  arePrusaModelsCompatible,
  getPrusaPrinterFamily,
  parsePrusaLinkModel,
} from "@/services/prusa-link/utils/prusa-link-model.util";

const version = (over: Partial<VersionDto>): VersionDto => ({
  api: "2.0.0",
  server: "2.1.2",
  nozzle_diameter: 0.4,
  text: "",
  hostname: "",
  capabilities: { "upload-by-put": true },
  ...over,
});

describe("parsePrusaLinkModel", () => {
  it("classifies Buddy boards as bgcode-capable", () => {
    expect(parsePrusaLinkModel(version({ text: "PrusaLink XL" }))).toMatchObject({
      model: "XL",
      supportsBgcode: true,
      raw: "PrusaLink XL",
    });
    expect(parsePrusaLinkModel(version({ text: "PrusaLink MINI" }))).toMatchObject({
      model: "MINI",
      supportsBgcode: true,
    });
  });

  it("prefers the longest matching token (MK4S over MK4)", () => {
    expect(parsePrusaLinkModel(version({ text: "PrusaLink MK4S" })).model).toBe("MK4S");
    expect(parsePrusaLinkModel(version({ text: "PrusaLink MK4" })).model).toBe("MK4");
  });

  it("classifies legacy Einsy boards as not bgcode-capable", () => {
    expect(parsePrusaLinkModel(version({ text: "PrusaLink MK3S+" }))).toMatchObject({
      model: "MK3S+",
      supportsBgcode: false,
    });
  });

  it("normalizes Core One casing", () => {
    expect(parsePrusaLinkModel(version({ text: "PrusaLink Core One" })).model).toBe("Core One");
  });

  it("falls back to the `original` field for legacy MK3 firmware", () => {
    const v = version({ text: "PrusaLink 0.8.1", original: "PrusaLink I3MK3S" });
    expect(parsePrusaLinkModel(v)).toMatchObject({
      model: "MK3S",
      supportsBgcode: false,
      raw: "PrusaLink 0.8.1",
    });
  });

  it("returns nulls when nothing recognisable is present", () => {
    expect(parsePrusaLinkModel(version({ text: "PrusaLink" }))).toMatchObject({
      model: null,
      supportsBgcode: null,
      raw: "PrusaLink",
    });
  });

  it("handles null/undefined input without throwing", () => {
    expect(parsePrusaLinkModel(null)).toEqual({ model: null, supportsBgcode: null, raw: null });
    expect(parsePrusaLinkModel(undefined)).toEqual({ model: null, supportsBgcode: null, raw: null });
  });
});

describe("getPrusaPrinterFamily", () => {
  it("maps models to coarse families", () => {
    expect(getPrusaPrinterFamily("XL")).toBe("XL");
    expect(getPrusaPrinterFamily("MK4S")).toBe("MK4");
    expect(getPrusaPrinterFamily("MK3S+")).toBe("MK3");
    expect(getPrusaPrinterFamily("Core One")).toBe("CORE_ONE");
    expect(getPrusaPrinterFamily("MINI+")).toBe("MINI");
    expect(getPrusaPrinterFamily("MK3.9S")).toBe("MK3.9");
  });

  it("returns null for unknown or empty input", () => {
    expect(getPrusaPrinterFamily("totally-unknown")).toBeNull();
    expect(getPrusaPrinterFamily(null)).toBeNull();
    expect(getPrusaPrinterFamily(undefined)).toBeNull();
  });
});

describe("arePrusaModelsCompatible", () => {
  it("matches within the same family", () => {
    expect(arePrusaModelsCompatible("MK4S", "MK4")).toBe(true);
    expect(arePrusaModelsCompatible("XL", "XL")).toBe(true);
  });

  it("rejects across families", () => {
    expect(arePrusaModelsCompatible("XL", "MK4")).toBe(false);
    expect(arePrusaModelsCompatible("MK3S", "MINI")).toBe(false);
  });

  it("fails open when either side is unknown", () => {
    expect(arePrusaModelsCompatible(null, "XL")).toBe(true);
    expect(arePrusaModelsCompatible("XL", null)).toBe(true);
    expect(arePrusaModelsCompatible("totally-unknown", "XL")).toBe(true);
  });
});
