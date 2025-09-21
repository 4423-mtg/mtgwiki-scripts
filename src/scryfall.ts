import {
    type ScryfallCard,
    type ScryfallCardFace,
    type ScryfallPromoType,
} from "@scryfall/api-types";

export function is_valid_cards(card: ScryfallCard.Any): boolean {
    return !(
        card.layout == "art_series" ||
        card.layout == "double_faced_token" ||
        card.layout == "emblem" ||
        card.layout == "reversible_card" ||
        card.layout == "token"
    );
    // TODO: "Card", "Unknown Event"
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

export function get_cardnames(card: ScryfallCard.Any): string[] {
    return "card_faces" in card
        ? card.card_faces.map((f) => f.name)
        : [card.name];
}

export function is_playtest_card(card: ScryfallCard.Any): boolean {
    return card.promo_types?.includes("playtest" as ScryfallPromoType) ?? false;
}
export function is_plane_card(card: ScryfallCard.Any): boolean {
    // "Plane — Dominaria"
    const expr = new RegExp("^[^—]*\bPlane\b");
    return "type_line" in card && expr.test(card.type_line);
}

// function isKind<T extends string>(
//     obj: any,
//     kind: T
// ): obj is Extract<ScryfallCard.Any, { kind: T }> {
//     return typeof obj === "object" && obj.kind === kind;
// }
