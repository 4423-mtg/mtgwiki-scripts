import { ScryfallCard } from "@scryfall/api-types";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

import { CardName } from "../lib/commonTypes.js";
import { getJapaneseNameFromMtgWiki } from "../lib/mtgwiki.js";
import { fetchOracleCardsBulkData } from "../lib/scryfall.js";

type DictEntry = {
    japaneseName: string | undefined;
    choices: string[] | undefined;
    source: "mtgwiki" | "cache";
    info: string | undefined;
};
type Dictionary = Record<string, DictEntry>;

async function main() {
    // カードデータ
    const cards = await getCards(false);

    // 非対象カードを除外する (-> scryfall.ts, parseCardType)
    const cards_filtered = cards.filter(
        (c) =>
            c.layout !== "token" &&
            c.layout !== "emblem" &&
            c.layout !== "double_faced_token" &&
            c.layout !== "art_series" &&
            c.layout !== "reversible_card",
    );

    // 日付でソート
    const cards_sorted = cards_filtered.sort(
        (a, b) =>
            new Date(a.released_at).getTime() -
            new Date(b.released_at).getTime(),
    );

    // 日本語名キャッシュ
    const cache1 = readJpNameCache("./data/cardname-jp/cache1.json");
    // 辞書キャッシュ
    const dictCache = readDictionaryCache(
        "./data/cardname-jp/dictionary-cache.json",
    );

    // 各カードについて、日本語名を解決して辞書に追加する
    const dict: Record<string, DictEntry | undefined> = {};
    for (let index = 0; index < cards_sorted.length; index++) {
        const card = cards_sorted[index];
        if (card === undefined) {
            continue;
        }
        console.log(`[name: "${card.name}"]`);

        let fetching: boolean = false;
        if (!("card_faces" in card)) {
            // 通常カードの場合
            // 辞書キャッシュ確認
            if (dictCache[card.name] !== undefined) {
                dict[card.name] = dictCache[card.name];
            }
            // 日本語名解決。日本語名キャッシュ確認
            else if (
                cache1[card.name] !== undefined &&
                cache1[card.name] !== "undefined"
            ) {
                dict[card.name] = {
                    japaneseName: cache1[card.name],
                    choices: undefined,
                    source: "cache",
                    info: undefined,
                };
            } else {
                // mtgwikiから取得する
                const fetched = await getJapaneseNameFromMtgWiki(card.name);
                fetching = true;
                dict[card.name] = {
                    japaneseName: fetched.cardName.japaneseName,
                    choices: fetched.choices,
                    source: "mtgwiki",
                    info: fetched.info,
                };
            }
        } else {
            // マルチフェイスの場合
            const faceNames = card.card_faces.map((face) => face.name);
            // 辞書キャッシュ確認
            if (faceNames.every((name) => dictCache[name] !== undefined)) {
                faceNames.forEach((name) => (dict[name] = dictCache[name]));
            }
            // 日本語名キャッシュ確認
            else if (
                faceNames.every(
                    (name) =>
                        cache1[name] !== undefined &&
                        cache1[name] !== "undefined",
                )
            ) {
                faceNames.forEach(
                    (name) =>
                        (dict[name] = {
                            japaneseName: cache1[name],
                            choices: undefined,
                            source: "cache",
                            info: undefined,
                        }),
                );
            } else {
                // mtgwikiから取得する
                const fetched = await getJapaneseNameFromMtgWiki(faceNames);
                fetching = true;
                fetched.cardName.forEach(
                    (cardName) =>
                        (dict[cardName.englishName] = {
                            japaneseName: cardName.japaneseName,
                            choices: fetched.choices,
                            source: "mtgwiki",
                            info: fetched.info,
                        }),
                );
            }
        }

        // 保存
        writeFileSync(
            "data/cardname-jp/dictionary.json",
            JSON.stringify(dict, undefined, 2),
        );

        // フェッチした場合は5秒空ける
        if (fetching === true) {
            fetching = false;
            await setTimeout(5 * 1000);
        }
    }
}

/** カードデータ取得。
 * キャッシュを読むか、またはScryfallからオラクルカードデータを取得する */
async function getCards(
    useCache: boolean,
    cacheFile: string | undefined = undefined,
): Promise<ScryfallCard.Any[]> {
    if (useCache) {
        if (cacheFile === undefined) {
            throw new Error();
        }
        return JSON.parse(readFileSync(cacheFile, { encoding: "utf-8" }));
    } else {
        const data = await fetchOracleCardsBulkData();
        if (data === undefined) {
            throw new Error();
        }
        return data;
    }
}

/** 生成済みの辞書データを読む */
function readJpNameCache(filepath: string): Record<string, string> {
    const data = JSON.parse(readFileSync(filepath, { encoding: "utf-8" }));
    return data;
}

/** 辞書キャッシュ */
function readDictionaryCache(filepath: string): Dictionary {
    const data: Dictionary = JSON.parse(
        readFileSync(filepath, { encoding: "utf-8" }),
    );
    return data;
}

/** 辞書オブジェクトに含まれているカード名のリストを取得する */
function getAllCardNamesInDictionary(dict: Dictionary): string[] {
    let allKeys = [];
    for (const key in dict) {
        if (!Object.hasOwn(dict, key)) continue;
        if (dict[key] === undefined) {
            continue;
        }
        allKeys.push(key);
    }
    return allKeys;
}

/** 日本語名を解決する。キャッシュがあればそれを使い、なければmtgwikiから取得する */
async function resolveJpName(
    card: ScryfallCard.Any,
    cache: Record<string, string>,
): Promise<{
    cardName: CardName | CardName[];
    choices: string[] | undefined;
    source: "mtgwiki" | "cache";
    info: string | undefined;
}> {
    if (!("card_faces" in card)) {
        // 通常レイアウトの場合
        const cached = cache[card.name];
        // キャッシュがあれば使う
        if (cached !== undefined) {
            return {
                cardName: { englishName: card.name, japaneseName: cached },
                choices: undefined,
                source: "cache",
                info: undefined,
            };
        }
        // mtgwikiから日本語名を取得する
        const fetched = await getJapaneseNameFromMtgWiki(card.name);
        return {
            cardName: fetched.cardName,
            choices: fetched.choices,
            source: "mtgwiki",
            info: fetched.info,
        };
    } else {
        // マルチフェイスの場合
        // 英語名
        const faceNames = card.card_faces.map((f) => f.name);
        // キャッシュがあれば使う
        if (faceNames.every((n) => Object.keys(cache).includes(n))) {
            return {
                cardName: faceNames.map((en) => ({
                    englishName: en,
                    japaneseName: cache[en],
                })),
                choices: undefined,
                source: "cache",
                info: undefined,
            };
        }
        // mtgwikiから日本語名を取得する
        const fetched = await getJapaneseNameFromMtgWiki(faceNames);
        return {
            cardName: fetched.cardName,
            choices: fetched.choices,
            source: "mtgwiki",
            info: fetched.info,
        };
    }
}

await main();
