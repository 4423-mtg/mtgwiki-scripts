import {
    ScryfallCard,
    ScryfallCardFace,
    ScryfallPromoType,
    type ScryfallList,
} from "@scryfall/api-types";

type BulkDataInfo = {
    object: "bulk_data";
    id: string;
    type: string;
    updated_at: string;
    uri: string;
    name: string;
    description: string;
    size: number;
    download_uri: string;
    content_type: string;
    content_encoding: string;
};

/** Scryfallからオラクルカードのバルクデータをフェッチする */
export async function fetchOracleCardsBulkData(): Promise<
    ScryfallCard.Any[] | undefined
> {
    console.info("Fetching oracle cards...");
    // バルクファイル情報のフェッチ
    const url_bulkDataInfo = new URL("https://api.scryfall.com/bulk-data");
    const info: ScryfallList.List<BulkDataInfo> = await fetch(
        url_bulkDataInfo,
    ).then((response) => response.json());

    // ダウンロードURL
    const oracleCardBulkDataInfo = info.data.filter(
        (i) => i.type === "oracle_cards",
    );
    const downloadUrl = oracleCardBulkDataInfo[0]?.download_uri;
    if (downloadUrl == undefined) {
        return undefined;
    }

    // ダウンロード
    const bulkData: ScryfallCard.Any[] = await fetch(downloadUrl).then(
        (response) => response.json(),
    );
    console.info(`Fetched from ${downloadUrl}`);
    return bulkData;
}

// TODO:
// - カードタイプのパース (GET /catalog/card-types)

/** プレイテストカードの判定 */
export function isPlaytestCard(card: ScryfallCard.Any): boolean {
    return card.promo_types?.includes("playtest" as ScryfallPromoType) ?? false;
}

/**  */
export function isPlaneCard(card: ScryfallCard.Any): boolean {
    // "Plane — Dominaria"
    const expr = /^[^—]*\bPlane\b/;
    return "type_line" in card && expr.test(card.type_line);
}

// ====================================
export type ValidCard = Exclude<
    ScryfallCard.Any,
    | ScryfallCard.ArtSeries
    | ScryfallCard.DoubleFacedToken
    | ScryfallCard.Emblem
    | ScryfallCard.ReversibleCard
    | ScryfallCard.Token
>;
export type ValidFace = Exclude<
    ScryfallCardFace.Any,
    ScryfallCardFace.Reversible
>;
// - 処理対象カードの判定
//   - カード名の場合
// - 入れたい
//   - 通常ルールの範囲内のカード
//     - カードタイプがあれば通常ルール内とみなす。旧表記("Summon ...")は入れる
//     - 以下のカードは入れる
//       - Shichifukujin Dragon (Summon Dragon)
//       - 1996 World Champion (Summon Legend)
//       - "Astral Cards"
//       - Arinlay Igpay (Unhinged)
//       - Old Fogey
//       - capital offense (Unstable) (instant)
//       - Throat Wolf (Mystery Booster Playtest Cards 2019)
//       - Xyru Specter (Mystery Booster Playtest Cards 2019) ("Summon - Spector")
//       - Byode, Inverse Sun (2021 Heroes of the Realm) ("Legendary Universewalker")
//       - Flanking Licid (Mystery Booster 2) ("Summon Licid")
//   - 銀枠は入れる
//   - 通常ルール用だが特殊仕様のカード（リバーシブル等）
//     - リバーシブルカード
//     - 一部プロモカード
// - 微妙
//   - 拡張ルール内だが通常のカードタイプを持たないもの
//     - ステッカー
//     - 英雄
//   - アリーナ専用カード
// - 除外したい
//   - 通常のカードタイプを持たないもの
//   - チェックリスト、ミニゲーム、広告、アート等ゲーム用でないもの
//   - Morph
//   - Manifest
