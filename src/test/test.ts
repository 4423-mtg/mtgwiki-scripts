import * as mtgwiki from "../mtgwiki.js";

function test_get_name() {
    const names = ["Forest", "Life+Death", "SP//dr, Piloted by Peni"];

    (async function () {
        for await (const jpname of names
            .concat(names, names, names, names, names, names, names)
            .map((n) => mtgwiki.get_jpname(n))) {
            console.log(" => " + jpname);
        }
    })();

    // for (let i = 0; i < names.length; i++) {
    //     mtgwiki
    //         .get_jpname(names[i] as string)
    //         .then((jpname) => console.log(names[i] + " => " + jpname));
    // }
}

test_get_name();
