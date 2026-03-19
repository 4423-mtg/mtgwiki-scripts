import { type ScryfallCard } from "@scryfall/api-types";

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
