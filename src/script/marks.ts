import * as fs from "node:fs";
import { type ScryfallCard } from "@scryfall/api-types";
import { getOracleCards, readDictionaryCache } from "../lib/dictionary.js";

async function main() {
    // // ファイル読み込み
    const oracleCards = await getOracleCards(false);

    // 非対象カードを除外する (-> scryfall.ts, parseCardType)
    const cards_filtered = oracleCards.filter(
        (c) =>
            c.layout !== "token" &&
            c.layout !== "emblem" &&
            c.layout !== "double_faced_token" &&
            c.layout !== "art_series" &&
            c.layout !== "reversible_card" &&
            c.type_line !== "Card" &&
            c.name.match(/^A-/) === null && // アリーナ再調整カード
            !(c.games.length === 1 && c.games.includes("arena")) && // アリーナ限定カード
            c.set !== "unk" && // Unknown Event
            c.set !== "punk" && // Black Lotus Unknown Planechase
            c.set !== "pssc" && // Secret Lair Showcase Planes
            c.type_line.match(/\bToken\b/) === null && // 役割トークン
            c.name !== "Sticker sheet" &&
            c.name !== '"Name Sticker" Goblin',
    );

    // 日付でソート
    const cards_sorted = cards_filtered.sort(
        (a, b) =>
            new Date(a.released_at).getTime() -
            new Date(b.released_at).getTime(),
    );

    // カード名リスト
    const names: { name: string; card: ScryfallCard.Any }[] = [];
    for (const card of cards_sorted) {
        if (!("card_faces" in card)) {
            names.push({ name: card.name, card: card });
        } else {
            for (const face of card.card_faces) {
                names.push({ name: face.name, card: card });
            }
        }
    }

    const pattern = new RegExp(/[^a-zA-Z0-9,'. -]/);
    const namesIncludingMark = names.filter((e) => pattern.test(e.name));

    const dictionary = readDictionaryCache(
        "data/cardname-jp/dictionary-cache.json",
    );

    const output = namesIncludingMark.map((e) => {
        const entry = dictionary[e.name];
        if (entry === undefined) {
            console.warn(`"${e.name}" is not included in the dictionary`);
            return e.name;
        } else {
            return entry.japaneseName !== undefined
                ? entry.japaneseName + "/" + e.name
                : e.name;
        }
    });

    console.log(`${namesIncludingMark.length} cards`);
    fs.writeFileSync(
        "data/cardname-mark/cards.json",
        JSON.stringify(output, undefined, 2),
    );
}

await main();
