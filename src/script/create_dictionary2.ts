import * as fs from "node:fs";
import { setTimeout as sleep } from "timers/promises";
import { type ScryfallCard, type ScryfallCardFace } from "@scryfall/api-types";
import * as mtgwiki from "../mtgwiki.js";
import * as scryfall from "../scryfall.js";
import { type DictEntry } from "../types/dict.js";
import { time } from "node:console";

const file_oraclecards = "./data/oracle-cards-20250823211001.json";

function load_oraclecards(): ScryfallCard.Any[] {
    const text = fs.readFileSync(file_oraclecards, "utf-8");
    const oracles: ScryfallCard.Any[] = JSON.parse(text);
    return oracles;
}

function stringify_entries(entries: DictEntry[]): string {
    let ret = "[\n";
    entries.forEach(
        (e, i) =>
            (ret +=
                "  " +
                JSON.stringify(e) +
                (i < entries.length - 1 ? "," : "") +
                "\n")
    );
    ret += "]\n";
    return ret;
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
            const name = mtgwiki.get_splitcard_name(
                card.card_faces
                    .map((f) => get_primal_name(f))
                    .filter((n) => n !== undefined)
            );
            sleep(3000);
            const entry_all = await mtgwiki.get_jpname2(name, {
                playtest: scryfall.is_playtest_card(card),
                plane: scryfall.is_plane_card(card),
            });
            // 各半分のentries
            const entries_of_each_half: DictEntry[][] = [];
            for (const face of card.card_faces) {
                sleep(3000);
                entries_of_each_half.push(await get_dict_entries(face, option));
            }
            return [entry_all].concat(...entries_of_each_half);
        } else {
            // other multiface card
            const entries_of_each_face: DictEntry[][] = [];
            for (const face of card.card_faces) {
                sleep(3000);
                entries_of_each_face.push(await get_dict_entries(face, option));
            }
            return entries_of_each_face.flat();
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

    let count = 0;
    for (const card of cards.filter((c) => scryfall.is_valid_cards(c))) {
        // console.log(`> "${card.name}"`);
        const names = scryfall.get_cardnames(card);

        // キャッシュ
        const caches = names.map((n): DictEntry | undefined =>
            jpnames_cache[n] !== undefined && jpnames_cache[n] !== "undefined" // FIXME: 英語名の無いカードはinfoに書いておく
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
                console.log(`>> ${count} cards are cached`);
                count = 0;
            }
            let entries: DictEntry[] = [];
            try {
                entries = await get_dict_entries(card, {
                    playtest: scryfall.is_playtest_card(card),
                    planar: scryfall.is_plane_card(card),
                });
            } catch (e) {
                console.error(`>> "${card.name}": ${e}`);
                entries = [
                    {
                        name: get_primal_name(card) ?? "undefined",
                        jpname: "undefined",
                        info: "Error (403 Forbidden)",
                    },
                ];
            }
            jpnames.push(
                ...entries.map((e) => ({
                    name: e.name,
                    jpname: e.jpname ?? "undefined",
                    ...("info" in e ? { info: e.info } : {}),
                }))
            );
            entries.forEach((e, i) =>
                console.log(`>> "${card.name}": [$${i}]: ${JSON.stringify(e)}`)
            );
        }
        // すべて保存
        fs.writeFileSync("./data/jpname.json", stringify_entries(jpnames));
        sleep(3000);
    }
}

main();
