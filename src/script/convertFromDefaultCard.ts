import * as fs from "node:fs";
import * as path from "node:path";
import { type ScryfallCard } from "@scryfall/api-types";
import { loadBulkFile } from "../scryfall.js";

const defaultCardsFilePath = "data/default-cards-20251024211655.json";
const dirname = path.dirname(defaultCardsFilePath);
const basename = path.basename(
    defaultCardsFilePath,
    path.extname(defaultCardsFilePath)
);

main();

function main() {
    // デフォルトカードをロード
    const cards: ScryfallCard.Any[] = loadBulkFile(defaultCardsFilePath);
    console.log("cards.length=" + cards.length);

    let cardsFirstPrinted: ScryfallCard.Any[] = [];
    if (true) {
        // 新規生成
        // 初出以外を消去
        cardsFirstPrinted = filterIntoFirstPrinted(cards);
        // ソート
        cardsFirstPrinted.sort(compareInDateAndName);
        // ファイル書き出し
        fs.writeFileSync(
            path.join(dirname, basename + "_firstPrintOnly.json"),
            JSON.stringify(cardsFirstPrinted)
        );
    } else {
        // 既存ファイルを読み込む
        cardsFirstPrinted = loadBulkFile(
            path.join(dirname, basename + "_firstPrintOnly.json")
        );
        // ソート
        cardsFirstPrinted.sort(compareInDateAndName);
    }

    const valid_card_types = [
        "Land",
        "Creature",
        "Artifact",
        "Enchantment",
        "Instant",
        "Sorcery",
        "Planeswalker",
        "Battle",
        "Dungeon",
        "Vanguard",
        "Plane",
        "Phenomenon",
        "Scheme",
        "Conspiracy",
        "Summon",
        "Sticker",
    ];
    const valid_card_names = [
        "Arinlay Igpay",
        "capital offense",
        "Byode, Inverse Sun",
    ];
    const invalid_set_name = [
        "Unknown Event",
        "Black Lotus Unknown Planechase",
        "Secret Lair Showcase Planes",
    ];
    const cardsFirstPrintedPlayable = cardsFirstPrinted.filter(
        (c) =>
            !invalid_set_name.includes(c.set_name) &&
            (("type_line" in c &&
                valid_card_types.some((t) => c.type_line.match(t) !== null)) ||
                valid_card_names.includes(c.name))
    );
    fs.writeFileSync(
        path.join(dirname, basename + "_firstPrintOnly_excludeUnplayable.json"),
        JSON.stringify(cardsFirstPrintedPlayable)
    );

    // - 入れたい
    //   - 通常ルールの範囲内のカード
    //     - カードタイプがあれば通常ルール内とみなす。旧表記("Summon ...")は入れる
    //     - 以下のカードは入れる
    //       - Shichifukujin Dragon (Summon Dragon)
    //       - 1996 World Champion (Summon Legend)
    //       - "Astral Cards"
    //       - Arinlay Igpay (Unhinged)
    //       - Old Fogey
    //       - capital offense (Unstable) (instant)
    //       - Throat Wolf (Mystery Booster Playtest Cards 2019)
    //       - Xyru Specter (Mystery Booster Playtest Cards 2019) ("Summon - Spector")
    //       - Byode, Inverse Sun (2021 Heroes of the Realm) ("Legendary Universewalker")
    //       - Flanking Licid (Mystery Booster 2) ("Summon Licid")
    //   - 銀枠は入れる
    //   - 通常ルール用だが特殊仕様のカード（リバーシブル等）
    //     - リバーシブルカード
    //     - 一部プロモカード
    // - 微妙
    //   - 拡張ルール内だが通常のカードタイプを持たないもの
    //     - ステッカー
    //     - 英雄
    //   - アリーナ専用カード
    // - 除外したい
    //   - 通常のカードタイプを持たないもの
    //   - チェックリスト、ミニゲーム、広告、アート等ゲーム用でないもの
    //   - Morph
    //   - Manifest
}

/** 重複カードを初出以外除外する */
function filterIntoFirstPrinted(cards: ScryfallCard.Any[]) {
    // 再録を除外
    const filtered1: ScryfallCard.Any[] = [...cards].filter((c) => !c.reprint);

    // オラクルテキストのあるカードは名前とテキスト一致、ないカードは名前一致で同じカードとみなす
    const filtered2: ScryfallCard.Any[] = [];
    for (let i = 0; i < filtered1.length; i++) {
        const card = filtered1[i] as ScryfallCard.Any;
        if (i % 100 == 0) {
            console.log(`current index = ${i} / ${filtered1.length}`);
        }

        const count = filtered2.filter((c) => {
            if ("oracle_text" in card) {
                return (
                    "oracle_text" in c &&
                    c.name === card.name &&
                    c.oracle_text === card.oracle_text
                );
            } else {
                c.name === card.name;
            }
        }).length;
        if (count === 0) {
            filtered2.push(card);
        }
    }
    return filtered2;
}

/** 日付文字列を比較するだけの関数 */
function compareDateString(a: string, b: string) {
    return new Date(a).getTime() - new Date(b).getTime();
}

/** 日付→セット名→名前の順でソート */
function compareInDateAndName(a: ScryfallCard.Any, b: ScryfallCard.Any) {
    const x = compareDateString(a.released_at, b.released_at);
    if (x !== 0) {
        return x;
    }
    const y = a.set_name.localeCompare(b.set_name);
    if (y !== 0) {
        return y;
    } else {
        return a.name.localeCompare(b.name);
    }
}
