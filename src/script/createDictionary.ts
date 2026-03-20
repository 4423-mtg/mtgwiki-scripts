import { ScryfallCard } from "@scryfall/api-types";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

import { CardName, isCardName } from "../lib/commonTypes.js";
import { getJapaneseName } from "../lib/mtgwiki.js";
import { fetchOracleCardsBulkData } from "../lib/scryfall.js";

type DictEntry = { japaneseName: string | undefined; info?: string };
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
    console.log("Sorting...");
    const cards_sorted = cards_filtered.sort(
        (a, b) =>
            new Date(a.released_at).getTime() -
            new Date(b.released_at).getTime(),
    );

    // 日本語名キャッシュを読む
    const cache = readDictionaryCache1("./data/jpname_20250920.json");

    // 各カードについて、日本語名を解決して辞書に追加する
    const dict: Dictionary = {};
    for (let index = 0; index < cards_sorted.length; index++) {
        const c = cards_sorted[index];
        if (c === undefined) {
            continue;
        }
        console.log(`[name: "${c.name}"]`);

        // 日本語名を解決する
        const ret = await resolveJpName(c, cache);
        console.log(JSON.stringify(ret));

        // 辞書に追加
        const _dictEntry = (cardName: CardName): DictEntry =>
            ret.info === undefined
                ? { japaneseName: cardName.japaneseName }
                : { japaneseName: cardName.japaneseName, info: ret.info };
        if (Array.isArray(ret.cardName)) {
            ret.cardName.forEach((cardName) => {
                dict[cardName.englishName] = _dictEntry(cardName);
            });
        } else {
            dict[ret.cardName.englishName] = _dictEntry(ret.cardName);
        }

        // 保存
        writeFileSync(
            "data/cardname-jp/dictionary.json",
            JSON.stringify(dict, undefined, 2),
        );

        // フェッチした場合は5秒空ける
        if (ret.fetched) {
            await setTimeout(5 * 1000);
        }
    }

    // TODO: 人力で確認し、特別リストを作る
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
function readDictionaryCache1(filepath: string): Record<string, string> {
    return {}; // TODO:
}

/** 日本語名を解決する。キャッシュがあればそれを使い、なければmtgwikiから取得する */
async function resolveJpName(
    card: ScryfallCard.Any,
    cache: Record<string, string>,
): Promise<{
    cardName: CardName | CardName[];
    info?: string;
    fetched: boolean;
}> {
    const cached_ennames = Object.keys(cache);

    if (!("card_faces" in card)) {
        // 通常レイアウトの場合
        const cached = cache[card.name];
        // キャッシュがあれば使う
        if (cached !== undefined) {
            return {
                cardName: { englishName: card.name, japaneseName: cached },
                fetched: false,
            };
        }
        // mtgwikiから日本語名を取得する
        const fetched = await getJapaneseName(card.name);
        return isCardName(fetched)
            ? {
                  cardName: fetched,
                  fetched: true,
              }
            : {
                  cardName: { englishName: card.name, japaneseName: undefined },
                  info: fetched.info,
                  fetched: true,
              };
    } else {
        // マルチフェイスの場合
        // 英語名
        const faceNames = card.card_faces.map((f) => f.name);
        // 判定
        if (faceNames.every((n) => cached_ennames.includes(n))) {
            return {
                cardName: faceNames.map((en) => ({
                    englishName: en,
                    japaneseName: cache[en],
                })),
                fetched: false,
            };
        }
        // mtgwikiから日本語名を取得する
        const fetched = await getJapaneseName(faceNames);
        return Array.isArray(fetched)
            ? {
                  cardName: fetched,
                  fetched: true,
              }
            : {
                  cardName: faceNames.map((en) => ({
                      englishName: en,
                      japaneseName: undefined,
                  })),
                  info: fetched.info,
                  fetched: true,
              };
    }
}

await main();
