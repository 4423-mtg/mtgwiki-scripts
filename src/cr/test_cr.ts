import * as cheerio from "cheerio";
import { mkdirSync, writeFileSync } from "node:fs";

import {
    BodyItem,
    bodyItemToText,
    crNumberToSectionNumber,
    DictItem,
    HeaderItem,
    isNumberedLine,
    parseCRNumber,
    parseTextBody,
    bodyItemToTocText,
    TocItem,
} from "./cr.js";

// console.log(`process.argv=[${process.argv.join(", ")}]`);
const argv2 = process.argv[2];
const outdir = argv2 === undefined || argv2 === "" ? "./data/cr" : argv2;
console.log(`ourdir=${outdir}`);

function saveFile(filename: string, text: string): void {
    const path = outdir + `/${filename}`;
    mkdirSync(outdir, { recursive: true });
    if (text.length > 0 && text.at(-1) !== "\n") {
        writeFileSync(path, text + "\n");
    } else {
        writeFileSync(path, text);
    }
    console.log(`=> ${path}`);
}
type Mode = "header" | "toc" | "body" | "dict" | "credit" | undefined;

// MARK: main
async function main() {
    // (1) 日本公式の総合ルールページをfetch
    const url = "https://mtg-jp.com/gameplay/rules/docs/0006836/";
    console.log(`Fetching from ${url}`);

    const content = await fetch(url);
    const $ = cheerio.load(await content.text());

    // (2) メイン部分のDOMを切り出す
    console.info("Processing DOM...");
    const main = $(
        "body > div#wrap > main > article > div#contents > div.inner > div.reading-main > section > div.detail",
    );

    // (3) 本文テキスト。1つの段落に\nなどで複数の項番が含まれているのでまず行で分割する
    console.info("Parsing into lines...");
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
    console.info(`  => ${lines.length} lines`);
    saveFile("lines.txt", lines.join("\n"));

    // MARK: main/パース
    // (4) 各行の内容を見て前書き・目次・ルール本文・用語集を判定しつつ段落ごとにまとめる
    const items: (HeaderItem | TocItem | BodyItem | DictItem)[] = [];
    let mode: Mode = "header";
    console.log(`Parsing ${mode}...`);

    for (const _line of lines) {
        // モード切替
        if (mode === "header" && _line === "もくじ") {
            mode = "toc";
            console.log(`Parsing ${mode}...`);
            continue;
        } else if (
            mode === "toc" &&
            _line === "マジック：ザ・ギャザリング　総合ルール"
        ) {
            mode = "body";
            console.log(`Parsing ${mode}...`);
            continue;
        } else if (mode === "body" && _line === "用語集") {
            mode = "dict";
            console.log(`Parsing ${mode}...`);
            continue;
        } else if (mode === "dict" && _line === "クレジット") {
            mode = "credit";
            console.log(`Parsing ${mode}...`);
            continue;
        }

        // 前書き
        if (mode === "header") {
            items.push(parseAsHeader(_line));
            continue;
        }
        // 目次
        if (mode === "toc") {
            const parsed = parseAsToc(_line);
            if (parsed !== undefined) {
                items.push(parsed);
            } else {
                throw new Error(`Parse error: ${_line}`);
            }
            continue;
        }
        // 本文
        if (mode === "body") {
            const parsed = parseAsBody(_line);
            // 項番がある行
            if (typeof parsed === "object") {
                items.push(parsed);
            }
            // 項番がない行
            else if (typeof parsed === "string") {
                const prevItem = items.at(-1);
                // 前の行が BodyItem ならそれに追加する
                if (prevItem !== undefined && prevItem.part === "body") {
                    if (prevItem.text.length === 0) {
                        prevItem.text = parsed;
                        prevItem.noNumberText = parsed;
                    }
                    // 前の行が "例：" で終わる場合は改行なしで追加する
                    else if (prevItem.text.match(/例[:：]\s*$/) !== null) {
                        prevItem.text += parsed;
                        prevItem.noNumberText += parsed;
                    }
                    // 「0. はじめに」の場合は独立したアイテムとして追加する
                    else if (prevItem.crNumber.major === "0") {
                        items.push({
                            part: "body",
                            text: parsed,
                            crNumber: {
                                major: prevItem.crNumber.major,
                                minor: undefined,
                                patch: undefined,
                            },
                            noNumberText: parsed,
                        });
                    }
                    // 改行付きで追加する
                    else {
                        prevItem.text += "\n" + parsed;
                        prevItem.noNumberText += "\n" + parsed;
                    }
                }
                // 前の行が BodyItem でないならエラー
                else {
                    throw new Error();
                }
            } else {
                throw new Error(`Parse error: ${_line}`);
            }
            continue;
        }
        // 用語集
        if (mode === "dict") {
            const parsed = parseAsDict(_line);
            // 用語名の行
            if (typeof parsed === "object") {
                items.push(parsed);
            }
            // 説明の行
            else if (typeof parsed === "string") {
                const prev = items.at(-1);
                // 前の行が DictItem ならそれに追加する
                if (prev !== undefined && prev.part === "dict") {
                    prev.text += (prev.text.length > 0 ? "\n" : "") + parsed;
                    prev.body += (prev.body.length > 0 ? "\n" : "") + parsed;
                } else {
                    throw new Error();
                }
            } else {
                throw new Error(`Parse error: ${_line}`);
            }
            continue;
        }
    }

    // MARK: main/テキスト化
    // (5) テキスト化
    const notice = [
        "このページの内容は、[https://mtg-jp.com/gameplay/rules マジック日本公式サイト]に掲載されているマジック総合ルール（和訳 20260116.0 版）を転記したものです。最新の総合ルールは公式サイトを参照してください。",
        "----",
    ].join("\n");

    // header
    const headerItems = items.filter((i) => i.part === "header");
    const headerText: string[] = [
        notice,
        "",
        ...headerItems.map((item) => item.text),
        "",
        "__NOTOC__",
    ];
    saveFile("header.txt", headerText.join("\n"));

    // toc
    const tocItems = items.filter((i) => i.part === "toc");
    const tocText: string[] = [
        notice,
        "",
        ...tocItems.map((item) => item.text),
        "",
        "__NOTOC__",
    ];
    saveFile("toc.txt", tocText.join("\n"));

    // body
    const sections: string[] = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
    ];
    for (const section of sections) {
        const bodyItems = items
            .filter((item) => item.part === "body")
            .filter((item) => item.crNumber.major?.at(0) === section);
        // 目次
        const toc: string[] = [];
        for (const item of bodyItems) {
            const _t = bodyItemToTocText(item);
            if (false) {
                console.debug(`${item.text} => ${_t}`);
            }
            if (_t !== undefined) {
                toc.push(_t);
            }
            if (section === "0") {
                break;
            }
        }
        // 本文
        const bodyText: string[] = [];
        for (const item of bodyItems) {
            bodyText.push(bodyItemToText(item));
        }

        const sectionText = [
            notice,
            "",
            ...toc,
            "",
            "----",
            "",
            ...bodyText,
            "",
            "__NOTOC__",
        ];
        saveFile(`section${section}.txt`, sectionText.join("\n"));
    }

    // dict
    const dictItems = items.filter((i) => i.part === "dict");
    const dictText = [notice, ""];
    for (const item of dictItems) {
        dictText.push(`=${item.itemName}=`);
        dictText.push(item.body);
        dictText.push("");
    }
    dictText.push(...["", "__NOTOC__"]);
    saveFile("dict.txt", dictText.join("\n"));

    console.log("ok");
}

// MARK: parseAsHeader
/** 前書き行のパース */
function parseAsHeader(line: string): HeaderItem {
    return { part: "header", text: line };
}

// MARK: parseAsToc
/** 目次行のパース */
function parseAsToc(line: string): TocItem | undefined {
    if (line === "もくじ") {
        return undefined;
    }
    return {
        part: "toc",
        text: line,
        crNumber: line.match(/^([0-9]+)\.? *(.*)/)?.[1] ?? "",
        noNumberText: line.match(/^([0-9]+)\.? *(.*)/)?.[2] ?? "",
    };
}

// MARK: parseAsBody
/** 項番行のパース。行の先頭に項番がある場合は BodyItem にパースして返す。ない場合は元のテキストを返す。 */
function parseAsBody(line: string): BodyItem | string | undefined {
    if (line === "マジック：ザ・ギャザリング　総合ルール") {
        return undefined;
    }
    // 項番付きの行
    if (isNumberedLine(line)) {
        // FIXME: isNumberedLine で undefined を返す
        return {
            part: "body",
            text: line,
            crNumber: parseCRNumber(line),
            noNumberText: parseTextBody(line),
        } as const;
    } else {
        // 項番のない行
        const text = line.replace(/^\s+/, "");
        return text;
    }
}

// MARK: parseAsDict
/** 辞書行のパース */
function parseAsDict(line: string): DictItem | string | undefined {
    if (line === "用語集") {
        return undefined;
    }
    // 辞書項目名 末尾がスラッシュ＋英数字なら項目名と判定する
    if (line.match(/／[\x20-\x7E]+$/)) {
        return {
            part: "dict",
            text: line,
            itemName: line,
            body: "",
        };
    } else {
        // 説明文の場合は前の行に追加
        const text = line.replace(/^\s+/, "");
        return text;
    }
}

// ==================================================================
main();
