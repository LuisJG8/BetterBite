import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("mobile configuration", () => {
  it("declares the Android permissions used by the app", () => {
    const manifest = projectFile("src-tauri/gen/android/app/src/main/AndroidManifest.xml");

    expect(manifest).toContain("android.permission.INTERNET");
    expect(manifest).toContain("android.permission.ACCESS_COARSE_LOCATION");
    expect(manifest).toContain("android.permission.ACCESS_FINE_LOCATION");
    expect(manifest).toContain('android.hardware.location.gps" android:required="false"');
    expect(manifest).not.toContain("LEANBACK_LAUNCHER");
  });

  it("allows the map resources required by the native webview", () => {
    const config = JSON.parse(projectFile("src-tauri/tauri.conf.json")) as {
      app: { security: { csp: string; devCsp: string } };
    };

    for (const policy of [config.app.security.csp, config.app.security.devCsp]) {
      expect(policy).toContain("https://tile.openstreetmap.org");
      expect(policy).toContain("worker-src 'self' blob:");

      for (const imageHost of [
        "https://i5.walmartimages.com",
        "https://drinkolipop.com",
        "https://hukitchen.com",
        "https://www.lesserevil.com",
        "https://images.unsplash.com",
      ]) {
        expect(policy).toContain(imageHost);
      }
    }
  });
});
