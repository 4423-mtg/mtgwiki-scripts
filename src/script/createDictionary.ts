import { ScryfallCard } from "@scryfall/api-types";
import { writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

import { getJapaneseNameFromMtgWiki } from "../lib/mtgwiki.js";
import {
    DictEntry,
    Dictionary,
    getOracleCards,
    readAnnotation,
    readDictionaryCache,
} from "../lib/dictionary.js";
import { CardName } from "../lib/commonTypes.js";

// MARK: main
async function main() {
    // カードデータ
    const cards = await getOracleCards(false);

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
            c.type_line.match(/\bToken\b/) === null && // 役割トークン
            c.name !== "Sticker sheet",
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
        // 英語名誤り
        if (card.name === "Ratonhnhaké꞉ton") {
            dict[card.name] = {
                japaneseName: "ラドンハゲードン",
                choices: undefined,
                source: "annotation",
                info: undefined,
            };
            fetching = false;
        } else {
            // 日本語名を解決する
            const ret = await resolveJapaneseName(card, {
                cache: dictCache,
                annotation: annotationsCache,
            });
            for (const e of ret.result) {
                console.log(
                    `[${index}] "${e.name}" => ${JSON.stringify(e.entry)}`,
                );
                // 辞書に追加する
                dict[e.name] = e.entry;
                // アノテーションが必要なカードのリストに追加する
                if (
                    e.entry.japaneseName === undefined &&
                    e.entry.info !== undefined
                ) {
                    toBeAnnotated[e.name] = {};
                    console.warn(
                        `Annotation needed: "${e.name}" (${e.entry.info})`,
                    );
                }
            }
            fetching = ret.fetched;
        }

        // フェッチした場合のみ保存
        if (fetching) {
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
        }
    }
}

/** 日本語名を解決する */
async function resolveJapaneseName(
    card: ScryfallCard.Any,
    options?: {
        cache?: Dictionary;
        annotation?: Record<string, { japaneseName?: string }>;
    },
): Promise<{ result: { name: string; entry: DictEntry }[]; fetched: boolean }> {
    const names: string[] = !("card_faces" in card)
        ? [card.name]
        : card.card_faces.map((face) => face.name);

    // アノテーションがあればそれを返す
    const annotation = names.map((name) => ({
        name: name,
        annotation: options?.annotation?.[name],
    }));
    if (annotation.every((a) => a.annotation !== undefined)) {
        return {
            result: annotation.map((a) => ({
                name: a.name,
                entry: {
                    japaneseName: a.annotation?.japaneseName,
                    choices: undefined,
                    source: "annotation",
                    info: undefined,
                },
            })),
            fetched: false,
        };
    }

    // 辞書キャッシュがあればそれを返す
    const cache = names.map((name) => ({
        name: name,
        cache: options?.cache?.[name],
    }));
    if (cache.every((c) => c.cache !== undefined)) {
        return {
            result: (cache as { name: string; cache: DictEntry }[]).map(
                (c) => ({
                    name: c.name,
                    entry: c.cache,
                }),
            ),
            fetched: false,
        };
    }

    // mtgwikiから取得する
    const _getOption = { retry: true, maxRetry: 100 };
    const fetched = await getJapaneseNameFromMtgWiki(card, _getOption);
    if (!Array.isArray(fetched)) {
        const _cardNames: CardName[] = Array.isArray(fetched.cardName)
            ? fetched.cardName
            : [fetched.cardName];
        return {
            result: _cardNames.map((cardName) => ({
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
        return {
            result: fetched.map((f) => ({
                name: f.cardName.englishName,
                entry: {
                    japaneseName: f.cardName.englishName,
                    choices: f.choices,
                    source: "mtgwiki",
                    info: f.info,
                },
            })),
            fetched: true,
        };
    }
}

await main();
