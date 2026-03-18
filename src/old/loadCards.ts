import { ScryfallCard } from "@scryfall/api-types";
import { readFileSync } from "node:fs";

// TODO:
// - バルクファイルDL
// - バルクファイルからカード選定するための各種条件
//   - 初出のみ
//   - 何らかのフォーマットでプレイ可能カード
//     - 見た目上はプレイできるが公式フォーマット使用不可のカード (Heros of RealmsやShichifukujin Dragonなど)
//   - 銀枠
//   - 分割や出来事を別カードとして切り出すかどうか
//   - アリーナ専用カード
//   - アリーナ再調整カード

/** Scryfallのバルクファイルからカードデータを読み込む */
export function loadCard(
    file: string,
    filter?: {
        // 再録
        excludesReprint?: boolean;
        // 非ゲーム用カード
        excludesUnplayable?: boolean;
        // 非公式カード
        includesUnofficialCards?: boolean;
        // アンカード
        includesUnCards?: boolean;
        // 分割カード等を分解する
        splitMultifaceCards?: boolean;
        // アリーナ専用カード
        includesArenaOnlyCards?: boolean;
    },
): ScryfallCard.Any[] {
    const text = readFileSync(file, "utf-8");
    let cards: ScryfallCard.Any[] = JSON.parse(text);
    return cards;
}

/** 再録カード */
export function isReprint(card: ScryfallCard.Any): boolean {
    return false;
}

/** ゲームルールに従ってプレイ可能なプレイ用カード */
export function isPlayableCard(
    card: ScryfallCard.Any,
    option?: {
        includesSticker?: boolean;
    },
): boolean {
    if (card.layout === "reversible_card") {
        return false;
    }

    const validCardTypes = [
        "Land",
        "Creature",
        "Artifact",
        "Enchantment",
        "Instant",
        "Sorcery",
        "Planeswalker",
        "Battle",
        "Dungeon",
        "Vanguard",
        "Plane",
        "Phenomenon",
        "Scheme",
        "Conspiracy",
        // "Summon",
        "Sticker",
    ] as const;
    return validCardTypes.some((t) => card.type_line.includes(t));
}

/** アンカード */
export function isUnCard(card: ScryfallCard.Any): boolean {
    return false;
}

/** マルチフェイスカード */
export function isMultiFaceCard(card: ScryfallCard.Any): boolean {
    return false;
}

/** アリーナ専用カード */
export function isArenaOnlyCard(card: ScryfallCard.Any): boolean {
    return false;
}

const valid_card_names = [
    "Arinlay Igpay",
    "capital offense",
    "Byode, Inverse Sun",
];
const invalid_set_name = [
    "Unknown Event",
    "Black Lotus Unknown Planechase",
    "Secret Lair Showcase Planes",
];
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
