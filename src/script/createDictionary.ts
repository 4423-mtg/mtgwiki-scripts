import { ScryfallCard } from "@scryfall/api-types";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

import {
    getJapaneseNameOfNonSplitCardFromMtgWiki,
    getJapaneseNameOfSplitCardFromMtgWiki,
} from "../lib/mtgwiki.js";
import { fetchOracleCardsBulkData } from "../lib/scryfall.js";

type DictEntry = {
    japaneseName: string | undefined;
    choices: string[] | undefined;
    source: "mtgwiki" | "cache" | "annotation";
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
            c.layout !== "reversible_card" &&
            c.type_line !== "Card" &&
            c.name.match(/^A-/) === null && // アリーナ再調整カード
            !(c.games.length === 1 && c.games.includes("arena")) && // アリーナ限定カード
            c.set !== "unk" && // Unknown Event
            c.set !== "punk" && // Black Lotus Unknown Planechase
            c.set !== "pssc" && // Secret Lair Showcase Planes
            c.type_line.match(/\bToken\b/) === null, // 役割トークン
    );

    // 日付でソート
    const cards_sorted = cards_filtered.sort(
        (a, b) =>
            new Date(a.released_at).getTime() -
            new Date(b.released_at).getTime(),
    );
    // FIXME:
    // - 同日発売セット
    // - コレクター番号順にしておく

    // 日本語名キャッシュ
    const cache1 = readJpNameCache("./data/cardname-jp/cache1.json");
    // 辞書キャッシュ
    const dictCache = readDictionaryCache(
        "./data/cardname-jp/dictionary-cache.json",
    );
    // アノテーション
    const annotationsCache: Record<string, { japaneseName?: string }> =
        readAnnotation("./data/cardname-jp/annotation.json");

    // 各カードについて、日本語名を解決して辞書に追加する
    const dict: Record<string, DictEntry> = {};
    const toBeAnnotated: Record<string, { japaneseName?: string }> = {};
    for (let index = 0; index < cards_sorted.length; index++) {
        const card = cards_sorted[index];
        if (card === undefined) {
            continue;
        }

        let fetching: boolean = false;
        if (card.name === "Ratonhnhaké꞉ton") {
            dict[card.name] = {
                japaneseName: "ラドンハゲードン",
                choices: undefined,
                source: "annotation",
                info: undefined,
            };
            fetching = false;
        } else if (card.name === "Sticker sheet") {
            // skip
            fetching = false;
        } else if (!("card_faces" in card)) {
            // 通常カードの場合
            const ret = await resolveJapaneseNameOfSingleFaceCard(card, {
                japaneseNameCache: cache1,
                dictionaryCache: dictCache,
                annotation: annotationsCache,
            });
            console.log(
                `[${index}] "${card.name}" => ${JSON.stringify(ret.result)}`,
            );
            dict[card.name] = ret.result;
            if (
                ret.result.japaneseName === undefined &&
                ret.result.info !== undefined
            ) {
                toBeAnnotated[card.name] = {};
                console.warn(
                    `Have to Annotate: "${card.name}" (${ret.result.info})`,
                );
            }
            fetching = ret.fetched;
        } else {
            // マルチフェイスの場合
            const ret = await resolveJapaneseNameOfMultiFaceCard(card, {
                japaneseNameCache: cache1,
                dictionaryCache: dictCache,
                annotation: annotationsCache,
            });
            for (const e of ret.result) {
                console.log(
                    `[${index}] "${e.name}" => ${JSON.stringify(e.entry)}`,
                );
                dict[e.name] = e.entry;
                if (
                    e.entry.japaneseName === undefined &&
                    e.entry.info !== undefined
                ) {
                    toBeAnnotated[e.name] = {};
                    console.warn(
                        `Have to Annotate: "${e.name}" (${e.entry.info})`,
                    );
                }
            }
            fetching = ret.fetched;
        }

        if (fetching) {
            // 保存
            writeFileSync(
                "data/cardname-jp/dictionary.json",
                JSON.stringify(dict, undefined, 2),
            );
            writeFileSync(
                "data/cardname-jp/toBeAnnotated.json",
                JSON.stringify(toBeAnnotated, undefined, 2),
            );
            // フェッチした場合は5秒空ける
            await setTimeout(5 * 1000);

            fetching = false;
        }
    }
}

/** シングルフェイスカードの日本語名を取得する */
async function resolveJapaneseNameOfSingleFaceCard(
    card: ScryfallCard.Any,
    options?: {
        japaneseNameCache?: Record<string, string>;
        dictionaryCache?: Dictionary;
        annotation?: Record<string, { japaneseName?: string }>;
    },
): Promise<{ result: DictEntry; fetched: boolean }> {
    // アノテーション確認
    const annotation = options?.annotation?.[card.name];
    if (annotation !== undefined) {
        return {
            result: {
                japaneseName: annotation?.japaneseName,
                choices: undefined,
                source: "annotation",
                info: undefined,
            },
            fetched: false,
        };
    }

    // 日本語名解決。日本語名キャッシュ確認
    const jpcache = options?.japaneseNameCache?.[card.name];
    if (jpcache !== undefined && jpcache !== "undefined") {
        return {
            result: {
                japaneseName: jpcache,
                choices: undefined,
                source: "cache",
                info: undefined,
            },
            fetched: false,
        };
    }

    // 辞書キャッシュ確認
    const dictCache = options?.dictionaryCache?.[card.name];
    if (dictCache !== undefined && dictCache.info === undefined) {
        return { result: dictCache, fetched: false };
    }

    // mtgwikiから取得する
    const _getOption = { retry: true, maxRetry: 100 };
    const fetched = await getJapaneseNameOfNonSplitCardFromMtgWiki(
        card.name,
        _getOption,
    );
    // console.log(JSON.stringify(fetched));
    return {
        result: {
            japaneseName: fetched.cardName.japaneseName,
            choices: fetched.choices,
            source: "mtgwiki",
            info: fetched.info,
        },
        fetched: true,
    };
}

/** マルチフェイスカードの日本語名を取得する */
async function resolveJapaneseNameOfMultiFaceCard(
    card: ScryfallCard.Any,
    options?: {
        japaneseNameCache?: Record<string, string>;
        dictionaryCache?: Dictionary;
        annotation?: Record<string, { japaneseName?: string }>;
    },
): Promise<{ result: { name: string; entry: DictEntry }[]; fetched: boolean }> {
    if (!("card_faces" in card)) {
        throw new Error("no card_faces in the card");
    }
    const faceNames = card.card_faces.map((face) => face.name);

    // アノテーション確認
    const annotations = faceNames.map((name) => options?.annotation?.[name]);
    if (annotations.every((ant) => ant !== undefined)) {
        return {
            result: faceNames.map((name, index) => ({
                name: name,
                entry: {
                    japaneseName: annotations[index]?.japaneseName,
                    choices: undefined,
                    source: "annotation",
                    info: undefined,
                },
            })),
            fetched: false,
        };
    }

    // 日本語名キャッシュ確認
    const jpcaches = faceNames.map(
        (name) => options?.japaneseNameCache?.[name],
    );
    if (
        jpcaches.every((jpname) => jpname !== undefined) &&
        jpcaches.every((jpname) => jpname !== "undefined")
    ) {
        return {
            result: faceNames.map((name, index) => ({
                name: name,
                entry: {
                    japaneseName: jpcaches[index],
                    choices: undefined,
                    source: "cache",
                    info: undefined,
                },
            })),
            fetched: false,
        };
    }

    // 辞書キャッシュ確認
    const dictCache = faceNames.map((name) => options?.dictionaryCache?.[name]);
    if (
        dictCache.every((dc) => dc !== undefined) &&
        dictCache.every((dc) => dc.info === undefined)
    ) {
        return {
            result: faceNames.map((name, index) => {
                if (dictCache[index] === undefined) {
                    throw new Error();
                }
                return {
                    name: name,
                    entry: dictCache[index],
                };
            }),
            fetched: false,
        };
    }

    // mtgwikiから取得する
    const _getOption = { retry: true, maxRetry: 100 };
    if (card.layout == "split") {
        // 分割カードの場合
        // 結合して1回で取得
        const fetched = await getJapaneseNameOfSplitCardFromMtgWiki(
            faceNames,
            _getOption,
        );
        // console.log(JSON.stringify(fetched));
        return {
            result: fetched.cardName.map((cardName) => ({
                name: cardName.englishName,
                entry: {
                    japaneseName: cardName.japaneseName,
                    choices: fetched.choices,
                    source: "mtgwiki",
                    info: fetched.info,
                },
            })),
            fetched: true,
        };
    } else {
        // 分割カード以外の場合
        // 各面別々に取得
        return {
            result: await Promise.all(
                faceNames.map(async (name) => {
                    const fetched =
                        await getJapaneseNameOfNonSplitCardFromMtgWiki(
                            name,
                            _getOption,
                        );
                    // console.log(JSON.stringify(fetched));
                    return {
                        name: name,
                        entry: {
                            japaneseName: fetched.cardName.japaneseName,
                            choices: fetched.choices,
                            source: "mtgwiki",
                            info: fetched.info,
                        },
                    };
                }),
            ),
            fetched: true,
        };
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

/** 既存の `Record<[英語名], [日本語名]>` 形式のデータを読む */
function readJpNameCache(filepath: string): Record<string, string> {
    const data = JSON.parse(readFileSync(filepath, { encoding: "utf-8" }));
    return data;
}

/** 既存の辞書データを読む */
function readDictionaryCache(filepath: string): Dictionary {
    const data: Dictionary = JSON.parse(
        readFileSync(filepath, { encoding: "utf-8" }),
    );
    return data;
}

/** アノテーションを読む */
function readAnnotation(filepath: string) {
    const data: Record<string, { japaneseName?: string }> = JSON.parse(
        readFileSync(filepath, { encoding: "utf-8" }),
    );
    return data;
}

await main();
