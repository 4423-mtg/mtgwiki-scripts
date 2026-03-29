import { writeFileSync } from "node:fs";
import { getOracleCards, readDictionaryCache } from "../lib/dictionary.js";
import { CardName } from "../lib/commonTypes.js";

async function main() {
    const oracleCards = await getOracleCards(false);
    const dictionary = readDictionaryCache(
        "data/cardname-jp/dictionary-cache.json",
    );

    const cards_filtered = oracleCards.filter(
        (c) =>
            c.layout !== "token" &&
            c.layout !== "emblem" &&
            c.layout !== "double_faced_token" &&
            c.layout !== "art_series" &&
            c.layout !== "reversible_card" &&
            c.type_line !== "Card" &&
            c.name.match(/^A-/) === null && // アリーナ再調整カード
            c.set !== "unk" && // Unknown Event
            c.set !== "punk" && // Black Lotus Unknown Planechase
            c.set !== "pssc" && // Secret Lair Showcase Planes
            c.type_line.match(/\bToken\b/) === null, // 役割トークン
    );

    let list: {
        name: CardName | CardName[];
        length_en: number;
        length_jp: number | undefined;
    }[] = [];
    const marks = /[ ,'.:&・、：-]/g;
    const getLengthEn = (name: string) => name.replaceAll(marks, "").length;
    const getLengthJp = (name: string | undefined) =>
        name === undefined ? undefined : name.replaceAll(marks, "").length;

    for (const card of cards_filtered) {
        // 通常レイアウト
        if (!("card_faces" in card)) {
            const english = card.name;
            const japanese = dictionary[card.name]?.japaneseName;
            list.push({
                name: { englishName: english, japaneseName: japanese },
                length_en: getLengthEn(english),
                length_jp: getLengthJp(japanese),
            });
        }
        // 分割カード
        else if (card.layout === "split") {
            const names = card.card_faces.map((face) => ({
                englishName: face.name,
                japaneseName: dictionary[face.name]?.japaneseName,
            }));
            list.push({
                name: names,
                length_en: names
                    .map((n) => getLengthEn(n.englishName))
                    .reduce((a, b) => a + b),
                length_jp: names
                    .map((n) => getLengthJp(n.japaneseName))
                    .reduce((a, b) => (a ?? 0) + (b ?? 0)),
            });
        }
        // その他、両面・出来事など
        else {
            const cardNames: CardName[] = card.card_faces.map((face) => ({
                englishName: face.name,
                japaneseName: dictionary[face.name]?.japaneseName,
            }));
            for (const cardName of cardNames) {
                list.push({
                    name: cardName,
                    length_en: getLengthEn(cardName.englishName),
                    length_jp: getLengthJp(cardName.japaneseName),
                });
            }
        }
    }

    // 英語名ソート
    const sortByEnglish = list.toSorted((a, b) => b.length_en - a.length_en);
    const sortByJapanese = list.toSorted(
        (a, b) => (b.length_jp ?? 0) - (a.length_jp ?? 0),
    );
    console.log(`English name: ${sortByEnglish.length}`);
    console.log(`Japanese name: ${sortByJapanese.length}`);

    writeFileSync(
        "data/cardname-jp/sortedEnglishNames.json",
        JSON.stringify(sortByEnglish, undefined, 2),
    );
    writeFileSync(
        "data/cardname-jp/sortedJapaneseNames.json",
        JSON.stringify(sortByJapanese, undefined, 2),
    );
}

main();
