import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";

import { CRNumber, equals } from "./cr.js";

const outdir = "./cr";

// fetch
const content = await fetch("https://mtg-jp.com/gameplay/rules/docs/0006836/");
const $ = cheerio.load(await content.text());

// メイン部分HTML
const main = $(
    "body > div#wrap > main > article > div#contents > div.inner > div.reading-main > section > div.detail",
);

// 本文テキスト。1つの段落に\nなどで複数の項番が含まれているのでまず行で分割する
const lines: string[] = [];
main.children().each((i, e) => {
    if (e.type !== "style") {
        lines.push(
            ...$(e)
                .text()
                .split(/\n/g)
                .filter((p) => p !== "")
                .filter((p) => p.match(/^ +$/) === null),
        );
    }
});
writeFileSync(outdir + "/lines.txt", lines.join("\n") + "\n");
console.log("> " + outdir + "/lines.txt");

// 正規表現で内容を確認する
// 例
const parsed: (
    | { part: "header"; text: string }
    | { part: "toc"; text: string; crNumber: string; noNumberText: string }
    | { part: "body"; text: string; crNumber: CRNumber; noNumberText: string }
    | { part: "dict"; text: string; itemName: string; body: string }
)[] = [];
const ptn2 = /^ *例[:：][ 　]*(.*)$/;
let mode: "header" | "toc" | "body" | "dict" | "credit" | undefined = "header";
lines.forEach((l) => {
    if (mode === "header") {
        if (l === "もくじ") {
            mode = "toc";
            return;
        } else {
            parsed.push({ part: "header", text: l });
        }
    }
    if (mode === "toc") {
        if (l === "マジック：ザ・ギャザリング　総合ルール") {
            mode = "body";
            return;
        } else {
            parsed.push({
                part: "toc",
                text: l,
                crNumber: l.match(/^([0-9]+)\.? *(.*)/)?.[1] ?? "",
                noNumberText: l.match(/^([0-9]+)\.? *(.*)/)?.[2] ?? "",
            });
        }
    }
    if (mode === "body") {
        if (l === "用語集") {
            mode = "dict";
            return;
        } else {
            if (isNumberedLine(l)) {
                parsed.push({
                    part: "body",
                    text: l,
                    crNumber: parseCRNumber(l),
                    noNumberText: parseTextBody(l),
                });
            } else {
                const prevItem = parsed[parsed.length - 1];
                if (prevItem !== undefined && prevItem.part === "body") {
                    parsed.push({
                        part: "body",
                        text: l,
                        crNumber: prevItem.crNumber,
                        noNumberText: l,
                    });
                } else {
                    throw new Error();
                }
            }
        }
    }
    if (mode === "dict") {
        if (l === "クレジット") {
            mode = "credit";
        } else {
            // 辞書アイテム名
            if (l.match(/／[\x20-\x7E]+$/)) {
                parsed.push({
                    part: "dict",
                    text: l,
                    itemName: l,
                    body: "",
                });
            } else {
                // 説明文の場合は前に追加
                const prevItem = parsed[parsed.length - 1];
                if (prevItem !== undefined && prevItem.part === "dict") {
                    const body = l.replaceAll(/[ 　]/g, "");
                    parsed[parsed.length - 1] = {
                        part: "dict",
                        text: prevItem.text + "\n" + body,
                        itemName: prevItem.itemName,
                        body:
                            prevItem.body +
                            (prevItem.body.length > 0 ? "\n" : "") +
                            body,
                    };
                } else {
                    throw new Error();
                }
            }
        }
    }
});

// テキスト化
let text: string[] = [];
parsed.forEach((e, i) => {
    if (e.part === "header") {
        text.push(e.text);
    }
    if (e.part === "toc") {
        if (parsed[i - 1]?.part === "header") {
            // header.txt
            writeFileSync(outdir + "/header.txt", text.join("\n") + "\n");
            console.log("> " + outdir + "/header.txt");
            text = [];
        }
        text.push(e.text);
    }
    if (e.part === "body") {
        // toc.txt
        if (parsed[i - 1]?.part === "toc") {
            writeFileSync(outdir + "/toc.txt", text.join("\n") + "\n");
            console.log("> " + outdir + "/toc.txt");
            text = [];
        }
        // body
        const prevItem = parsed[i - 1];
        if (prevItem?.part !== "body") {
            text.push(toText(e));
        } else {
            // ファイル切り分け
            const prevSection = prevItem.crNumber.major?.at(0);
            const currentSection = e.crNumber.major?.at(0);
            const flgNewSection =
                prevSection !== undefined &&
                currentSection !== undefined &&
                prevSection !== currentSection;
            if (flgNewSection) {
                // ${major[0]}.txt
                writeFileSync(
                    outdir + `/${prevSection}.txt`,
                    text.join("\n") + "\n",
                );
                console.log("> " + outdir + `/${prevSection}.txt`);
                text = [];
            }
            // body
            if (equals(e.crNumber, prevItem.crNumber)) {
                text.push(e.text);
            } else {
                text.push(toText(e));
            }
        }
    }
    if (e.part === "dict") {
        // toc.txt
        const prevItem = parsed[i - 1];
        if (prevItem !== undefined && prevItem.part === "body") {
            const prevSection = prevItem.crNumber.major?.at(0);
            if (prevSection === undefined) {
                throw new Error();
            }
            writeFileSync(
                outdir + `/${prevSection}.txt`,
                text.join("\n") + "\n",
            );
            console.log("> " + outdir + `/${prevSection}.txt`);
            text = [];
        }
        text.push("=" + e.itemName + "=");
        text.push(e.body + "\n");
    }
});

// 保存
writeFileSync(outdir + "/dict.txt", text.join("\n"));
console.log("> " + outdir + "/dict.txt");

console.log("hello");

// ==================================================================
/** 番号付きの項番かどうか */
function isNumberedLine(text: string): boolean {
    const ptn = /^([0-9]+)(\.(([0-9]+)(\.|([a-z]))?)?)?/;
    return text.match(ptn) !== null;
}
/** 項番行の頭から項番をキャプチャする */
function parseCRNumber(text: string): CRNumber {
    const ptn = /^([0-9]+)(\.(([0-9]+)(\.|([a-z]))?)?)?/;
    const m = text.match(ptn);
    if (m === null) {
        return {
            major: undefined,
            minor: undefined,
            patch: undefined,
        };
    } else {
        return {
            major: m[1],
            minor: m[4],
            patch: m[6],
        };
    }
}
/** 項番を除いたテキスト */
function parseTextBody(text: string): string {
    const ptn = /^([0-9]+)(\.(([0-9]+)(\.|([a-z]))?)?)?/;
    return text.replace(ptn, "").replace(/^ */, "");
}

/** 項番の階層レベル */
function getLevel(crNumber: CRNumber): number {
    if (
        crNumber.major === undefined &&
        crNumber.minor === undefined &&
        crNumber.patch === undefined
    ) {
        return 0;
    } else if (
        crNumber.major !== undefined &&
        crNumber.minor === undefined &&
        crNumber.patch === undefined
    ) {
        return 1;
    } else if (
        crNumber.major !== undefined &&
        crNumber.minor !== undefined &&
        crNumber.patch === undefined
    ) {
        return 2;
    } else if (
        crNumber.major !== undefined &&
        crNumber.minor !== undefined &&
        crNumber.patch !== undefined
    ) {
        return 3;
    } else {
        return 0;
    }
}

/** 各レベルの結合した項番文字列 */
function crNumberToString(crNumber: CRNumber): string {
    let str = "";
    str += crNumber.major ? crNumber.major.toString() : "";
    str += crNumber.minor ? "." + crNumber.minor.toString() : "";
    str += crNumber.patch ? "." + crNumber.patch.toString() : "";
    return str;
}

function toText(e: {
    part: "body";
    text: string;
    crNumber: CRNumber;
    noNumberText: string;
}): string {
    if (e.crNumber.major !== undefined && parseInt(e.crNumber.major) < 100) {
        return `<!-- ${e.text} -->`;
    } else {
        let ret = "";
        const headingMark = "=".repeat(getLevel(e.crNumber));
        if (getLevel(e.crNumber) === 1) {
            ret += "\n";
        }
        ret += headingMark;
        ret += crNumberToString(e.crNumber);
        ret += headingMark;
        ret += "\n";
        ret += e.noNumberText;

        return ret;
    }
}
