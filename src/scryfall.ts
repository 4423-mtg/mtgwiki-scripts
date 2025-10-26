import * as fs from "node:fs";

import {
    type ScryfallCard,
    type ScryfallCardFace,
    type ScryfallPromoType,
} from "@scryfall/api-types";

/** バルクファイルロード */
export function loadBulkFile(path: string): ScryfallCard.Any[] {
    const text = fs.readFileSync(path, "utf-8");
    const cards: ScryfallCard.Any[] = JSON.parse(text);
    return cards;
}

/** 調査対象判定。紋章、トークン、アートカード等を除外 */
export function isValidCard(card: ScryfallCard.Any): card is ValidCard {
    if (
        card.layout == "art_series" ||
        card.layout == "double_faced_token" ||
        card.layout == "emblem" ||
        card.layout == "reversible_card" ||
        card.layout == "token" ||
        card.set_name == "Unknown Event" ||
        card.set_name == "Jumpstart Front Cards" ||
        card.set_name == "Jumpstart 2022 Front Cards" ||
        card.set_name == "Dominaria United Jumpstart Front Cards"
    ) {
        return false;
    } else {
        return true;
    }
    // TODO: "Card", Arena Card
}

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

export function is_playtest_card(card: ScryfallCard.Any): boolean {
    return card.promo_types?.includes("playtest" as ScryfallPromoType) ?? false;
}
export function is_plane_card(card: ScryfallCard.Any): boolean {
    // "Plane — Dominaria"
    const expr = /^[^—]*\bPlane\b/;
    return "type_line" in card && expr.test(card.type_line);
}

// function isKind<T extends string>(
//     obj: any,
//     kind: T
// ): obj is Extract<ScryfallCard.Any, { kind: T }> {
//     return typeof obj === "object" && obj.kind === kind;
// }
