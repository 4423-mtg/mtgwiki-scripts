import * as fs from "node:fs";
import {
    ScryfallLayout,
    type ScryfallCard,
    type ScryfallCardFace,
    type ScryfallPromoType,
} from "@scryfall/api-types";
import * as mtgwiki from "../mtgwiki.js";
import * as scryfall from "../scryfall.js";
import { type DictEntry } from "../types/dict.js";

const file_oraclecards = "./data/oracle-cards-20250823211001.json";

function load_oraclecards(): ScryfallCard.Any[] {
    const text = fs.readFileSync(file_oraclecards, "utf-8");
    const oracles: ScryfallCard.Any[] = JSON.parse(text);
    return oracles;
}

/** 分割カードの日本語名を取るのにまず英語名が必要。 */
function get_primal_name(
    card: ScryfallCard.Any | ScryfallCardFace.Any
): string | undefined {
    if ("card_faces" in card) {
        if (card.layout === "split") {
            return mtgwiki.get_splitcard_name(
                card.card_faces
                    .map((f) => get_primal_name(f))
                    .filter((n) => n !== undefined)
            );
        } else {
            return card.card_faces[0]?.name;
        }
    } else {
        return card.name;
    }
}

async function get_dict_entries(
    card: ScryfallCard.Any | ScryfallCardFace.Any,
    option?: { playtest?: boolean; planar?: boolean }
): Promise<DictEntry[]> {
    if ("card_faces" in card) {
        if (card.layout == "split") {
            // split
            // 全体としてのentry
            const entry_all = await mtgwiki.get_jpname2(
                mtgwiki.get_splitcard_name(
                    card.card_faces
                        .map((f) => get_primal_name(f))
                        .filter((n) => n !== undefined)
                ),
                {
                    playtest: scryfall.is_playtest_card(card),
                    plane: scryfall.is_plane_card(card),
                }
            );
            // 各半分のentries
            const entries_in_each_half = await Promise.all(
                card.card_faces.map(async (face) =>
                    get_dict_entries(face, option)
                )
            );
            return [entry_all].concat(...entries_in_each_half);
        } else {
            // other multiface card
            return (
                await Promise.all(
                    card.card_faces.map((face) =>
                        get_dict_entries(face, option)
                    )
                )
            ).flat();
        }
    } else {
        // singleface & Face
        return [await mtgwiki.get_jpname2(card.name, option)];
    }
}

async function main() {
    const cards = load_oraclecards();
    const jpnames_cache: { [key: string]: string } = JSON.parse(
        fs.readFileSync("./data/jpname_20250920.json", "utf-8")
    );
    const jpnames: DictEntry[] = [];

    async function routine(card: ScryfallCard.Any) {
        let count = 0;
        const names = scryfall.get_cardnames(card);
        // キャッシュ
        const caches = names.map((n): DictEntry | undefined =>
            jpnames_cache[n] !== undefined && jpnames_cache[n] !== "undefined"
                ? { name: n, jpname: jpnames_cache[n] }
                : undefined
        );
        if (caches.every((c) => c !== undefined)) {
            // キャッシュがあれば使う
            caches.forEach((c) => jpnames.push(c));
            ++count;
        } else {
            // キャッシュがなければ取得する
            if (count !== 0) {
                console.log(`> ${count} cards are OK`);
                count = 0;
            }
            const entries = await get_dict_entries(card);
            jpnames.push(
                ...entries.map((e) => ({
                    name: e.name,
                    jpname: e.jpname ?? "undefined",
                    ...("info" in e ? { info: e.info } : {}),
                }))
            );
            entries.forEach((e) => console.log(`> ${e}`));
        }
        // すべて保存
        fs.writeFileSync(
            "./data/jpname.json",
            JSON.stringify(jpnames, null, 2)
        );
    }

    for await (const e of cards.map(routine)) {
    }
}
