import { describe, expect, it } from "vite-plus/test";
import type { DigestAuthParams } from "@/services/prusa-link/utils/digest-auth.params";
import { generateDigestAuthHeader } from "@/services/prusa-link/utils/digest-auth.util";

// Canonical RFC 2617 §3.5 worked example.
const rfcParams: DigestAuthParams = {
  username: "Mufasa",
  password: "Circle Of Life",
  method: "GET",
  uri: "/dir/index.html",
  realm: "testrealm@host.com",
  nonce: "dcd98b7102dd2f0e8b11d0f600bfb0c093",
  qop: "auth",
  nc: "00000001",
  cnonce: "0a4f113b",
  algorithm: "MD5",
  opaque: "5ccc069c403ebaf9f0171e9517f40e41",
};

const fieldOf = (header: string, key: string): string | undefined =>
  header.match(new RegExp(`${key}=("?)([^",]*)\\1`))?.[2];

describe("generateDigestAuthHeader", () => {
  it("matches the canonical RFC 2617 response for qop=auth/MD5", () => {
    const header = generateDigestAuthHeader(rfcParams);
    expect(header.startsWith("Digest ")).toBe(true);
    expect(fieldOf(header, "response")).toBe("6629fae49393a05397450978507c4ef1");
    expect(fieldOf(header, "username")).toBe("Mufasa");
    expect(fieldOf(header, "realm")).toBe("testrealm@host.com");
    expect(fieldOf(header, "qop")).toBe("auth");
    expect(fieldOf(header, "nc")).toBe("00000001");
    expect(fieldOf(header, "cnonce")).toBe("0a4f113b");
    expect(fieldOf(header, "algorithm")).toBe("MD5");
    expect(fieldOf(header, "opaque")).toBe("5ccc069c403ebaf9f0171e9517f40e41");
  });

  it("produces a different response for MD5-sess (the MK3 case)", () => {
    const md5 = generateDigestAuthHeader(rfcParams);
    const sess = generateDigestAuthHeader({ ...rfcParams, algorithm: "MD5-sess" });
    expect(fieldOf(sess, "algorithm")).toBe("MD5-sess");
    expect(fieldOf(sess, "response")).not.toBe(fieldOf(md5, "response"));
  });

  it("omits qop/nc/cnonce when no qop is offered (RFC 2069 fallback)", () => {
    const header = generateDigestAuthHeader({
      ...rfcParams,
      qop: undefined,
      nc: undefined,
      cnonce: undefined,
    });
    expect(header).not.toContain("qop=");
    expect(header).not.toContain("nc=");
    expect(header).not.toContain("cnonce=");
    expect(fieldOf(header, "response")).toBeDefined();
  });

  it("omits algorithm and opaque from the header when the challenge did not send them", () => {
    const header = generateDigestAuthHeader({ ...rfcParams, algorithm: undefined, opaque: undefined });
    expect(header).not.toContain("algorithm=");
    expect(header).not.toContain("opaque=");
  });
});
