export type DictEntry = {
    name: string;
    jpname: string | undefined;
    info: "error" | "nojpname" | "nopage" | "manypages" | undefined;
};

export class HTTPError extends Error {
    cause: Response;

    constructor(message: string | undefined, response: Response) {
        super(message, { cause: response });
        this.cause = response;
        this.name = `HTTP Error (${this.cause.status})`;
    }
}
