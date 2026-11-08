import { describe, expect, it } from "vitest";
import { isInAppBrowser } from "@/lib/in-app-browser";

// Real user-agent strings, shortened only where a long device list adds nothing.
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const UA = {
  safari: `${IPHONE} Version/17.5 Mobile/15E148 Safari/604.1`,
  instagram: `${IPHONE} Mobile/21F90 Instagram 340.0.0.28.115 (iPhone15,4; iOS 17_5; en_US; en-US; scale=3.00; 1179x2556)`,
  facebook: `${IPHONE} Mobile/21F90 [FBAN/FBIOS;FBAV/450.0.0.38.108;FBBV/565247013;FBDV/iPhone15,4;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]`,
  messenger: `${IPHONE} Mobile/21F90 [FBAN/MessengerForiOS;FBAV/448.0.0.30.114;FBBV/560172433;FBDV/iPhone15,4;FBMD/iPhone;FBSN/iOS;FBSV/17.5]`,
  tiktok: `${IPHONE} Mobile/15E148 musical_ly_34.4.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US BytedanceWebview/d8a21c6`,
  snapchat: `${IPHONE} Mobile/15E148 Snapchat/12.80.0.40 (like Safari/8617.1.17.10.9, iPhone15,4; iOS 17.5; gzip)`,
  line: `${IPHONE} Mobile/15E148 Safari Line/14.7.0`,
  wechat: `${IPHONE} Mobile/15E148 MicroMessenger/8.0.50(0x18003237) NetType/WIFI Language/en`,
  linkedin: `${IPHONE} Mobile/15E148 [LinkedInApp]/9.30.2124`,
  pinterest: `${IPHONE} Mobile/15E148 [Pinterest/iOS]`,
  chromeIos: `${IPHONE} CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1`,
  edgeDesktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0",
  firefoxDesktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
};

describe("isInAppBrowser", () => {
  it("is true inside the Instagram app", () => {
    expect(isInAppBrowser(UA.instagram)).toBe(true);
  });

  it("is false in plain iPhone Safari", () => {
    expect(isInAppBrowser(UA.safari)).toBe(false);
  });

  it.each([
    ["Facebook", UA.facebook],
    ["Messenger", UA.messenger],
    ["TikTok", UA.tiktok],
    ["Snapchat", UA.snapchat],
    ["LINE", UA.line],
    ["WeChat", UA.wechat],
    ["LinkedIn", UA.linkedin],
    ["Pinterest", UA.pinterest],
  ])("is true inside %s", (_name, agent) => {
    expect(isInAppBrowser(agent)).toBe(true);
  });

  it.each([
    ["Chrome on iPhone", UA.chromeIos],
    ["Edge on a laptop", UA.edgeDesktop],
    ["Firefox on a laptop", UA.firefoxDesktop],
  ])("is false in %s, which are real browsers", (_name, agent) => {
    expect(isInAppBrowser(agent)).toBe(false);
  });

  it("is false for an empty user agent", () => {
    expect(isInAppBrowser("")).toBe(false);
  });
});
