import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";

import { CRNumber, equals } from "./cr.js";

const outdir = "./cr";

// (1) 日本公式の総合ルールページをfetch
const content = await fetch("https://mtg-jp.com/gameplay/rules/docs/0006836/");
const $ = cheerio.load(await content.text());

// (2) メイン部分のDOMを切り出す
const main = $(
    "body > div#wrap > main > article > div#contents > div.inner > div.reading-main > section > div.detail",
);

// (3) 本文テキスト。1つの段落に\nなどで複数の項番が含まれているのでまず行で分割する
const lines: string[] = [];
main.children().each((i, e) => {
    if (e.type !== "style") {
        lines.push(
            ...$(e)
                .text()
                .split(/\n/g)
                .filter((p) => p !== "")
                .filter((p) => p.match(/^\s+$/) === null),
        );
    }
});
writeFileSync(outdir + "/lines.txt", lines.join("\n") + "\n");
console.log("> " + outdir + "/lines.txt");

// (4) 前書き・目次・ルール本文・用語集に分ける
const parsed: (
    | { part: "header"; text: string }
    | { part: "toc"; text: string; crNumber: string; noNumberText: string }
    | { part: "body"; text: string; crNumber: CRNumber; noNumberText: string }
    | { part: "dict"; text: string; itemName: string; body: string }
)[] = [];
let mode: "header" | "toc" | "body" | "dict" | "credit" | undefined = "header";

lines.forEach((l) => {
    // 前書き
    if (mode === "header") {
        parseHeader(l);
    }
    // 目次
    if (mode === "toc") {
        parseToc(l);
    }
    // 本文
    if (mode === "body") {
        parseBody(l);
    }
    // 用語集
    if (mode === "dict") {
        parseDict(l);
    }
});

function parseHeader(line: string) {
    if (line === "もくじ") {
        mode = "toc";
        return;
    }

    parsed.push({ part: "header", text: line });
}
function parseToc(line: string) {
    if (line === "マジック：ザ・ギャザリング　総合ルール") {
        mode = "body";
        return;
    }
    if (line === "もくじ") {
        return;
    }

    parsed.push({
        part: "toc",
        text: line,
        crNumber: line.match(/^([0-9]+)\.? *(.*)/)?.[1] ?? "",
        noNumberText: line.match(/^([0-9]+)\.? *(.*)/)?.[2] ?? "",
    });
}
function parseBody(line: string) {
    if (line === "用語集") {
        mode = "dict";
        return;
    }
    if (line === "マジック：ザ・ギャザリング　総合ルール") {
        return;
    }

    // 項番付きの行
    if (isNumberedLine(line)) {
        parsed.push({
            part: "body",
            text: line,
            crNumber: parseCRNumber(line),
            noNumberText: parseTextBody(line),
        });
    } else {
        // 項番のない行
        const prevItem = parsed[parsed.length - 1];
        if (prevItem !== undefined && prevItem.part === "body") {
            const body = line.replace(/^\s+/, "");
            parsed[parsed.length - 1] = {
                part: "body",
                text:
                    prevItem.text.length > 0
                        ? prevItem.text + "\n" + body
                        : body,
                crNumber: prevItem.crNumber,
                noNumberText:
                    prevItem.noNumberText.length > 0
                        ? prevItem.noNumberText + "\n" + body
                        : body,
            };
        } else {
            throw new Error();
        }
    }
}
function parseDict(line: string) {
    if (line === "クレジット") {
        mode = "credit";
        return;
    }
    if (line === "用語集") {
        return;
    }

    // 辞書項目名 末尾がスラッシュ＋英数字なら項目名と判定する
    if (line.match(/／[\x20-\x7E]+$/)) {
        parsed.push({
            part: "dict",
            text: line,
            itemName: line,
            body: "",
        });
    } else {
        // 説明文の場合は前の行に追加
        const prevItem = parsed[parsed.length - 1];
        if (prevItem !== undefined && prevItem.part === "dict") {
            const body = line.replace(/^\s+/, "");
            parsed[parsed.length - 1] = {
                part: "dict",
                text:
                    prevItem.text.length > 0
                        ? prevItem.text + "\n" + body
                        : body,
                itemName: prevItem.itemName,
                body:
                    prevItem.body.length > 0
                        ? prevItem.body + "\n" + body
                        : body,
            };
        } else {
            throw new Error();
        }
    }
}

// (5) テキスト化
let text: string[] = [];
let toc: string[] = [];
parsed.forEach((p, i) => {
    if (p.part === "header") {
        text.push(p.text);
    }
    if (p.part === "toc") {
        if (parsed[i - 1]?.part === "header") {
            // header.txt
            writeFileSync(
                outdir + "/header.txt",
                text.join("\n") + "\n\n__NOTOC__\n",
            );
            console.log("> " + outdir + "/header.txt");
            text = [];
        }
        text.push(p.text);
    }
    if (p.part === "body") {
        // toc.txt
        if (parsed[i - 1]?.part === "toc") {
            writeFileSync(
                outdir + "/toc.txt",
                text.join("\n") + "\n\n__NOTOC__\n",
            );
            console.log("> " + outdir + "/toc.txt");
            text = [];
        }
        // body
        const prevItem = parsed[i - 1];
        if (prevItem?.part !== "body") {
            // bodyの最初の行 (はじめに)
            text.push(bodyToText(p));
            pushBodyToToc(toc, p);
        } else {
            const prevSection = prevItem.crNumber.major?.at(0);
            const currentSection = p.crNumber.major?.at(0);
            if (
                prevSection !== undefined &&
                currentSection !== undefined &&
                prevSection !== currentSection
            ) {
                // 新しいセクション (bodyはセクションごとにファイルを切り分ける)
                // ${major[0]}.txt
                writeFileSync(
                    outdir + `/${prevSection}.txt`,
                    [...toc, "", ...text, "", "__NOTOC__", ""].join("\n"),
                );
                console.log("> " + outdir + `/${prevSection}.txt`);
                text = [];
                toc = [];
            }
            text.push(bodyToText(p));
            pushBodyToToc(toc, p);
        }
    }
    if (p.part === "dict") {
        // toc.txt
        const prevItem = parsed[i - 1];
        if (prevItem !== undefined && prevItem.part === "body") {
            const prevSection = prevItem.crNumber.major?.at(0);
            if (prevSection === undefined) {
                throw new Error();
            }
            writeFileSync(
                outdir + `/${prevSection}.txt`,
                [...toc, "", ...text, "", "__NOTOC__", ""].join("\n"),
            );
            console.log("> " + outdir + `/${prevSection}.txt`);
            text = [];
        }
        text.push("=" + p.itemName + "=");
        text.push(p.body + "\n");
    }
});
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
    str += crNumber.patch ? crNumber.patch.toString() : "";
    return str;
}

function bodyToText(e: {
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
        ret += e.noNumberText.replaceAll(/\n/g, "\n\n");

        return ret;
    }
}
function pushBodyToToc(
    toc: string[],
    p: {
        part: "body";
        text: string;
        crNumber: CRNumber;
        noNumberText: string;
    },
): void {
    let tocLine: string;
    const level = getLevel(p.crNumber);

    if (level === 0) {
        tocLine = "*" + `[[#${crNumberToString(p.crNumber)}|${p.text}]]`;
    } else if (
        level === 1 &&
        p.crNumber.major !== undefined &&
        p.crNumber.major.length > 1
    ) {
        tocLine =
            "*".repeat(level) +
            `[[#${crNumberToString(p.crNumber)}|${p.text}]]`;
    } else if (
        (p.crNumber.major === "701" || p.crNumber.major === "702") &&
        level === 2
    ) {
        tocLine =
            "*".repeat(level) +
            (p.crNumber.minor !== "1"
                ? `[[#${crNumberToString(p.crNumber)}|${p.text}]]`
                : `[[#${crNumberToString(p.crNumber)}|${crNumberToString(p.crNumber)}]]`);
    } else {
        return;
    }

    toc.push(tocLine);
}
