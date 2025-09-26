import { load } from "cheerio";
import * as fs from "node:fs";

const file_jpname = "./data/jpname.json";
const file_jpname_manypages = "./data/jpname_manypages.json";

type DictEntry = {
    name: string;
    jpname: string | undefined;
    info: "error" | "nojpname" | "nopage" | "manypages" | undefined;
};

function load_jpname(): DictEntry[] {
    const text = fs.readFileSync(file_jpname, "utf-8");
    const jpnames: DictEntry[] = JSON.parse(text);
    return jpnames;
}

function main() {
    const jpnames = load_jpname();
    const manypages = jpnames.filter((entry) => entry.info == "manypages");
    fs.writeFileSync(file_jpname_manypages, JSON.stringify(manypages));
}

main();
