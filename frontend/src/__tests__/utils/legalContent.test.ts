// @ts-nocheck
import { describe, it, expect } from "vitest";
import { LEGAL_DOCUMENTS, LEGAL_DOC_ORDER, normalizeLegalDoc } from "../../utils/legalContent";

describe("legalContent utils", () => {
  it("exports terms and privacy documents", () => {
    expect(LEGAL_DOCUMENTS.terms).toBeDefined();
    expect(LEGAL_DOCUMENTS.privacy).toBeDefined();
  });

  it("terms document has correct structure", () => {
    const terms = LEGAL_DOCUMENTS.terms;
    expect(terms.key).toBe("terms");
    expect(terms.label).toBe("Terms of Service");
    expect(terms.effectiveDate).toBeTruthy();
    expect(terms.sections.length).toBeGreaterThanOrEqual(5);
    expect(terms.sections[0].title).toContain("Acceptance");
    expect(terms.sections[0].paragraphs.length).toBeGreaterThan(0);
  });

  it("privacy document has correct structure", () => {
    const privacy = LEGAL_DOCUMENTS.privacy;
    expect(privacy.key).toBe("privacy");
    expect(privacy.label).toBe("Privacy Policy");
    expect(privacy.sections.length).toBeGreaterThanOrEqual(5);
  });

  it("terms document section 2 has bullets", () => {
    const section = LEGAL_DOCUMENTS.terms.sections[1];
    expect(section.bullets).toBeDefined();
    expect(section.bullets.length).toBeGreaterThan(0);
  });

  it("privacy document section 4 has bullets", () => {
    const section = LEGAL_DOCUMENTS.privacy.sections[3];
    expect(section.bullets).toBeDefined();
    expect(section.bullets.length).toBeGreaterThan(0);
  });

  it("LEGAL_DOC_ORDER is ['terms', 'privacy']", () => {
    expect(LEGAL_DOC_ORDER).toEqual(["terms", "privacy"]);
  });

  it("normalizeLegalDoc returns 'privacy' for 'privacy' input", () => {
    expect(normalizeLegalDoc("privacy")).toBe("privacy");
  });

  it("normalizeLegalDoc defaults to 'terms' for null/undefined", () => {
    expect(normalizeLegalDoc(null)).toBe("terms");
    expect(normalizeLegalDoc(undefined)).toBe("terms");
  });

  it("normalizeLegalDoc defaults to 'terms' for unknown values", () => {
    expect(normalizeLegalDoc("invalid")).toBe("terms");
    expect(normalizeLegalDoc("")).toBe("terms");
  });

  it("documents have summaries", () => {
    expect(LEGAL_DOCUMENTS.terms.summary).toBeTruthy();
    expect(LEGAL_DOCUMENTS.privacy.summary).toBeTruthy();
  });
});
