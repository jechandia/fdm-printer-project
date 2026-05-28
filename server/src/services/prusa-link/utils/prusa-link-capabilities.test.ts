import { describe, expect, it } from "vite-plus/test";
import type { VersionDto } from "@/services/prusa-link/dto/version.dto";
import {
  acceptsExtension,
  deriveCapabilities,
} from "@/services/prusa-link/utils/prusa-link-capabilities";

const version = (over: Partial<VersionDto>): VersionDto => ({
  api: "2.0.0",
  server: "2.1.2",
  nozzle_diameter: 0.4,
  text: "",
  hostname: "",
  capabilities: { "upload-by-put": true },
  ...over,
});

describe("deriveCapabilities", () => {
  it("derives a Buddy (XL) profile that prints bgcode over PUT", () => {
    const caps = deriveCapabilities(version({ text: "PrusaLink XL" }));
    expect(caps).toMatchObject({
      model: "XL",
      family: "XL",
      supportsBgcode: true,
      uploadTransport: "put",
      fileExtensions: [".gcode", ".bgcode"],
      apiVersion: "2.0.0",
      serverVersion: "2.1.2",
      versionText: "PrusaLink XL",
    });
  });

  it("forces legacy multipart + gcode-only for Einsy boards even when upload-by-put is advertised", () => {
    const caps = deriveCapabilities(
      version({ text: "PrusaLink 0.8.1", original: "PrusaLink I3MK3S" }),
    );
    expect(caps.supportsBgcode).toBe(false);
    expect(caps.uploadTransport).toBe("legacyMultipart");
    expect(caps.fileExtensions).toEqual([".gcode"]);
    expect(caps.uploadByPut).toBe(true);
  });

  it("fails open for unknown models (PUT + both extensions)", () => {
    const caps = deriveCapabilities(version({ text: "PrusaLink", capabilities: { "upload-by-put": false } }));
    expect(caps.model).toBeNull();
    expect(caps.supportsBgcode).toBeNull();
    expect(caps.uploadTransport).toBe("put");
    expect(caps.fileExtensions).toEqual([".gcode", ".bgcode"]);
    expect(caps.uploadByPut).toBe(false);
  });

  it("handles a null version payload", () => {
    const caps = deriveCapabilities(null);
    expect(caps).toMatchObject({
      model: null,
      uploadByPut: false,
      uploadTransport: "put",
      fileExtensions: [".gcode", ".bgcode"],
    });
  });
});

describe("acceptsExtension", () => {
  const xl = deriveCapabilities(version({ text: "PrusaLink XL" }));
  const mk3 = deriveCapabilities(version({ text: "PrusaLink 0.8.1", original: "PrusaLink I3MK3S" }));

  it("accepts bgcode on Buddy boards, case-insensitively", () => {
    expect(acceptsExtension(xl, "benchy.bgcode")).toBe(true);
    expect(acceptsExtension(xl, "BENCHY.BGCODE")).toBe(true);
    expect(acceptsExtension(xl, "benchy.gcode")).toBe(true);
  });

  it("rejects bgcode on Einsy boards", () => {
    expect(acceptsExtension(mk3, "benchy.bgcode")).toBe(false);
    expect(acceptsExtension(mk3, "benchy.gcode")).toBe(true);
  });

  it("rejects unrelated extensions", () => {
    expect(acceptsExtension(xl, "model.stl")).toBe(false);
    expect(acceptsExtension(xl, "noextension")).toBe(false);
  });
});
