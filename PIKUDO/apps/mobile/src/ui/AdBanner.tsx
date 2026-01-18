import Constants from "expo-constants";
import { Platform, View } from "react-native";

const TEST_ADMOB_PREFIX = "ca-app-pub-3940256099942544/";

function isExpoGo() {
  return Constants.executionEnvironment === "storeClient" || Constants.appOwnership === "expo";
}

function getBannerUnitId() {
  const expoConfig = Constants.expoConfig ?? (Constants.manifest as { extra?: Record<string, unknown> } | null);
  const extra = expoConfig?.extra as { admob?: { androidBannerUnitId?: string; iosBannerUnitId?: string } } | undefined;
  const admob = extra?.admob;

  return Platform.OS === "android" ? admob?.androidBannerUnitId : admob?.iosBannerUnitId;
}

export function AdBanner() {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return null;
  }

  if (isExpoGo()) {
    return null;
  }

  const unitId = getBannerUnitId();

  if (!unitId) {
    return null;
  }

  if (!__DEV__ && unitId.startsWith(TEST_ADMOB_PREFIX)) {
    return null;
  }

  let BannerAd: ((props: { unitId: string; size: string }) => JSX.Element) | undefined;
  let BannerAdSize: { BANNER: string } | undefined;

  try {
    const ads = require("react-native-google-mobile-ads");
    BannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
  } catch {
    return null;
  }

  if (!BannerAd || !BannerAdSize) {
    return null;
  }

  return (
    <View style={{ alignItems: "center", paddingTop: 4, paddingBottom: 6 }}>
      <BannerAd unitId={unitId} size={BannerAdSize.BANNER} />
    </View>
  );
}
