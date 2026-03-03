import * as fs from "node:fs";
import { type ScryfallCard } from "@scryfall/api-types";
import { isValidCard, loadBulkFile, ValidCard } from "../old/scryfall.js";

// 名前に記号を含むカード
const file_oraclecards =
    "data/default-cards-20251024211655_firstPrintOnly_excludeUnplayable.json";

function main() {
    // ファイル読み込み
    const oracles = loadBulkFile(file_oraclecards);

    // 変換
    let cardnames: {
        name: string;
        set_name: string;
        card: ScryfallCard.Any;
    }[] = [];
    oracles.forEach((card) => {
        if ("card_faces" in card) {
            card.card_faces.forEach((face) =>
                cardnames.push({
                    name: face.name,
                    set_name: card.set_name,
                    card: card,
                }),
            );
        } else {
            cardnames.push({
                name: card.name,
                set_name: card.set_name,
                card: card,
            });
        }
    });

    // 抽出
    const pattern = new RegExp(/[^a-zA-Z0-9,'. -]/);
    const cardnamesContainingMark = cardnames.filter((obj) =>
        pattern.test(obj.name),
    );
    console.log(cardnamesContainingMark);
    ("");
}

main();

// 初出順 > 名前順 にする
// 日本語名と合わせてWiki表記にする
