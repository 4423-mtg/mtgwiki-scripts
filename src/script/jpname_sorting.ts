import * as fs from "node:fs";
import { type ScryfallCard, type ScryfallCardFace } from "@scryfall/api-types";
import * as scryfall from "../scryfall.js";

const file_oraclecards = "./data/oracle-cards-20250823211001.json";
const file_jpname = "./data/jpname.json";
type DictEntry = {
    name: string;
    jpname: string | undefined;
    info: "error" | "nojpname" | "nopage" | "manypages" | undefined;
};

function load_oraclecards(): ScryfallCard.Any[] {
    const text = fs.readFileSync(file_oraclecards, "utf-8");
    const oracles: ScryfallCard.Any[] = JSON.parse(text);
    return oracles;
}

function load_jpname(): DictEntry[] {
    const text = fs.readFileSync(file_jpname, "utf-8");
    const jpnames: DictEntry[] = JSON.parse(text);
    return jpnames;
}

function main() {
    const oracle = load_oraclecards().filter((card) =>
        scryfall.is_valid_cards(card)
    );
    const jpnames = load_jpname();

    function get_jpname(name: string): string | undefined {
        const samename = jpnames.filter((j) => j.name == name);
        if (
            samename.length > 0 &&
            samename.every((entry) => entry.jpname == samename[0]?.jpname)
        ) {
            return samename[0]?.jpname ?? undefined;
        } else {
            return undefined;
        }
    }

    let oracle_with_jpname: { card: ScryfallCard.Any; jpnames: string[] }[] =
        oracle
            .map((card) => {
                if (card.layout == "split") {
                    return {
                        card: card as ScryfallCard.Any,
                        jpnames: card.card_faces.map((f) => get_jpname(f.name)),
                    };
                } else {
                    return {
                        card: card as ScryfallCard.Any,
                        jpnames: [get_jpname(card.name)],
                    };
                }
            })
            .filter((tuple) =>
                tuple.jpnames.every((e) => e !== undefined && e !== "undefined")
            ) as {
            card: ScryfallCard.Any;
            jpnames: string[];
        }[];
    const sorted = oracle_with_jpname.sort((c1, c2) => {
        const f = (strarray: string[]) =>
            strarray.reduce(
                (n, s) => n + s.replace(/[・、 　:：]/g, "").length,
                0
            );
        return -(f(c1.jpnames) - f(c2.jpnames));
    });
    const ret = sorted.map((tuple) => {
        const _jp = tuple.jpnames.reduce((a, b) => a + "+" + b);
        const _en =
            tuple.card.layout == "split"
                ? tuple.card.card_faces
                      .map((f) => f.name)
                      .reduce((a, b) => a + "+" + b)
                : tuple.card.name;
        return {
            length: tuple.jpnames.reduce(
                (n, s) => n + s.replace(/[・、 　:：]/g, "").length,
                0
            ),
            jpname: _jp,
            enname: _en,
            name: _jp + "/" + _en,
        };
    });
    console.log("");
}

main();
