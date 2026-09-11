import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
describe("request detail lifecycle controls", () => {
  const source = readFileSync(
    join(process.cwd(), "src/pages/RequestDetail.tsx"),
    "utf8",
  );
  it("uses a plain-language quote action and separate decline dialog", () => {
    expect(source).toContain("Set quote");
    expect(source).toContain("Decline request");
    expect(source).toContain("Choose what to do with this request.");
    expect(source).toContain("DeclineDialog");
    expect(source).not.toContain("Approve &amp; prepare payment");
  });
  it("shows Complete Ride only for a paid confirmed or in-progress ride", () => {
    expect(source).toContain("request.paymentStatus==='paid'");
    expect(source).toContain(
      "new Set(['confirmed','in_progress']).has(request.status)",
    );
    expect(source).toContain("CompleteRideDialog");
    expect(source).toContain("Complete Ride");
  });
  it("labels current final-total drafts without reinterpreting legacy base-fare drafts", () => {
    expect(source).toContain("manual-quote-draft");
    expect(source).toContain("Final customer price");
    expect(source).toContain("Historic base fare");
    expect(source).toContain("Saved quote — email delivery unconfirmed.");
    expect(source).toContain("formatMoney(request.quoteAmount)");
  });
  it("keeps manual draft saving distinct from the final customer email release review", () => {
    expect(source).toContain("Review quote");
    expect(source).toContain("QuoteReleaseDialog");
    expect(source).toContain("releaseManualQuoteForPayment");
    expect(source).toContain("before anything is released");
  });
  it("keeps system receipts and guarded Wix reconciliation behind system status", () => {
    expect(source).toContain("RequestProgress");
    expect(source).toContain("LifecyclePanel");
    expect(source).toContain("requestWixProviderReconciliation");
  });
  it("keeps mileage explicit, retryable, and usable through a tab-session/manual fallback", () => {
    expect(source).toContain("Calculate mileage");
    expect(source).toContain("ManualMileageEditor");
    expect(source).toContain("readRouteEstimateSession");
    expect(source).not.toContain("pxpress-mileage-attempt");
    expect(source).not.toContain("automaticRouteEstimate");
    expect(source).toContain("async function mileage()");
  });
  it("keeps received time as quiet request-header metadata instead of a fourth detail fact", () => {
    expect(source).toContain("detail-received");
    expect(source).toContain("detail-title-row");
    expect(source).not.toContain("<dt>Received</dt>");
    expect(source).not.toContain("formatDateTime(request.createdAt)} Eastern");
  });
  it("keeps hourly timing outside the connected pickup and destination stop list", () => {
    expect(source).toContain('className="route-stops"');
    expect(source).toContain('className="hourly-reservation"');
    expect(source).toContain("Reserved time");
  });
  it("does not fetch optional Finder review or dump Finder evidence into the manual quote view", () => {
    expect(source).not.toContain("readOhioFinderReview(");
    expect(source).not.toContain("lookupOhioFinderRate(");
    expect(source).not.toContain("reviewOhioFinderResult(");
    expect(source).not.toContain("Finder evidence");
    expect(source).not.toContain(
      "No verified per-ride tax projection is attached",
    );
  });
  it("keeps direct owner actions wired", () => {
    expect(source).toContain("mailto:");
    expect(source).toContain("tel:");
    expect(source).toContain("NavigationLauncher");
    expect(source).toContain('to="/calendar"');
  });
  it("preserves the request component and release outcome during background refresh",()=>{
    expect(source).toContain('requests.loading&&!request');
    expect(source).toContain('<DetailContent key={request.id}');
    expect(source).not.toContain('if(requests.loading)return');
  });
});
