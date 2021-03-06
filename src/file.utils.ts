import {CrossbowConfiguration, EnvFile} from "./config";
import {InputFiles, InputErrorTypes, InputError} from "./task.utils";
import {readFileSync, writeFileSync, existsSync} from "fs";
import {resolve, parse, relative} from "path";
import {CrossbowInput} from "./index";
import {ParsedPath} from "path";
import {statSync} from "fs";
import {join} from "path";
import {readdirSync} from "fs";
import Rx = require("rx");
import {dirname} from "path";
import {createReadStream} from "fs";
import {createHash} from "crypto";
import {lstat, Stats} from "fs";

const hd = require("hash-dir");
const hashDirAsObservable = Rx.Observable.fromNodeCallback(hd);
const hashFileAsObservable = Rx.Observable.fromNodeCallback(hashFile);
const lstatAsObservable = Rx.Observable.fromNodeCallback(lstat);

const _ = require("../lodash.custom");

// todo windows support for .bat files etc
const supportedTaskFileExtensions = [".js", ".sh"];

export interface ExternalFile {
    rawInput: string;
    resolved: string;
    relative: string;
    errors: InputError[];
    parsed: ParsedPath;
}

export interface FileNotFoundError extends InputError {}

export interface BinDirectoryNotFoundError extends InputError {}

export interface ExternalFileContent extends ExternalFile {
    content: string;
    data?: any;
}

export interface ExternalFileInput extends ExternalFile {
    input: CrossbowInput|any;
}

/**
 * Try to auto-load configuration files
 * from the users CWD
 */
export function retrieveDefaultInputFiles(config: CrossbowConfiguration): InputFiles {
    const defaultConfigFiles = ["crossbow.yaml", "crossbow.js", "crossbow.yml", "crossbow.json"];
    return readInputFiles(defaultConfigFiles, config.cwd);
}

/**
 * Try to load cbfiles (like gulp) from the users
 * working directory
 * @param config
 * @returns {InputFiles}
 */
export function retrieveCBFiles(config: CrossbowConfiguration): InputFiles {
    const defaultCBFiles = ["cbfile.js", "crossbowfile.js"];
    const maybes = (function () {
        if (config.cbfile) {
            return [config.cbfile];
        }
        return defaultCBFiles;
    })();
    return readInputFiles(maybes, config.cwd);
}

/**
 * Try to retrieve input files from disk.
 * This is different from regular file reading as
 * we deliver errors with context
 */
export function readInputFiles(paths: string[], cwd: string): InputFiles {

    /**
     * Get files that exist on disk
     * @type {ExternalFile[]}
     */
    const inputFiles = readFilesFromDisk(paths, cwd);

    /**
     * Add parsed input keys to them
     * @type {}
     */
    const inputs = inputFiles.map(inputFile => {

        /**
         * If the file does not exist, change the error to be an InputFileNotFound error
         * as this will allow more descriptive logging when needed
         */
        if (inputFile.errors.length) {
            return _.assign({}, inputFile, {
                // here there may be any types of file error,
                // but we only care that was an error, and normalise it
                // here for logging. We can added nice per-error messages later.
                errors: [{type: InputErrorTypes.InputFileNotFound}],
                input: undefined
            });
        }

        /**
         * If the input file was yaml, load it & translate to JS
         */
        if (inputFile.parsed.ext.match(/ya?ml$/i)) {
            const yml = require("js-yaml");
            try {
                return _.assign(inputFile, {
                    input: yml.safeLoad(readFileSync(inputFile.resolved, "utf8"))
                });
            } catch (e) {
                return _.assign(inputFile, {
                    input: undefined,
                    errors: [{type: InputErrorTypes.InvalidYaml, error: e}]
                });
            }
        }

        /**
         * Finally assume a JS/JSON file and 'require' it as normal
         */
        try {
            return _.assign({}, inputFile, {
                input: require(inputFile.resolved)
            });
        } catch (e) {
            return _.assign(inputFile, {
                input: undefined,
                errors: [{type: InputErrorTypes.InvalidInput, error: e}]
            });
        }
    });

    return {
        all: inputs,
        valid: inputs.filter(x => x.errors.length === 0),
        invalid: inputs.filter(x => x.errors.length > 0)
    };
}

export function readFileFromDiskWithContent(path: string, cwd: string): ExternalFileContent {
    const files = readFilesFromDisk([path], cwd);
    return files
        .map((x: ExternalFileContent) => {
            if (x.errors.length) return x;
            x.content = readFileSync(x.resolved, "utf8");
            return x;
        })[0];
}
export function readFilesFromDiskWithContent(paths: string[], cwd: string): ExternalFileContent[] {
    const files = readFilesFromDisk(paths, cwd);
    return files
        .map((x: ExternalFileContent) => {
            if (x.errors.length) return x;
            x.content = readFileSync(x.resolved, "utf8");
            return x;
        });
}

export function readFileContent(file: ExternalFile): string {
    return readFileSync(file.resolved, "utf8");
}

export function writeFileToDisk(file: ExternalFile, content: string) {
    const mkdirp = require("mkdirp").sync;
    mkdirp(dirname(file.resolved));
    writeFileSync(file.resolved, content);
}

export function getStubFileWithContent(path: string, cwd: string): ExternalFileContent {
    const file: any = getStubFile(path, cwd);
    file.content = "";
    return file;
}

export function readOrCreateJsonFile(path: string, cwd: string): ExternalFileContent {
    const existing = readFilesFromDiskWithContent([path], cwd)[0];
    if (existing.errors.length) {
        if (existing.errors[0].type === InputErrorTypes.FileNotFound) {
            const stub = getStubFileWithContent(path, cwd);
            stub.content = "{}";
            stub.data = JSON.parse(stub.content);
            return stub;
        }
    } else {
        try {
            existing.data = JSON.parse(existing.content);
        } catch (e) {
            existing.data = {};
        }
    }
    return existing;
}

export function getStubFile(path: string, cwd: string): ExternalFile {
    const resolved = resolve(cwd, path);
    return {
        errors: [],
        rawInput: path,
        resolved,
        parsed: parse(resolved),
        relative: relative(cwd, resolved)
    };
}

/**
 * Take an array of paths and return file info + errors if they don't exist
 * @param paths
 * @param cwd
 * @returns {ExternalFile[]}
 */
export function readFilesFromDisk(paths: string[], cwd: string): ExternalFile[] {
    return paths
        .map(String)
        .map(x => getStubFile(x, cwd))
        .map((incoming): ExternalFile => {

            const {resolved} = incoming;

            /**
             * If the path does not exist, it's a FileNotFound error
             */
            if (!existsSync(resolved)) {
                return _.assign(incoming, {
                    errors: [{type: InputErrorTypes.FileNotFound}]
                });
            }

            /**
             * Not check it's a file & NOT a dir
             * @type {Stats}
             */
            const stat = statSync(resolved);
            if (!stat.isFile()) {
                return _.assign(incoming, {
                    errors: [{type: InputErrorTypes.NotAFile}],
                });
            }

            /**
             * At this point the file DOES exist
             */
            return incoming;
        });
}

/**
 * Attempt to use the LOCALLY installed crossbow version
 * first, this will ensure anything registered with .task etc
 * can be picked up by global installs too.
 * @param config
 * @returns {InputFiles}
 */
export function getRequirePaths(config: CrossbowConfiguration): InputFiles {
    const local = join("node_modules", "crossbow", "dist", "public", "create.js");
    const global = join(__dirname, "public", "create.js");
    return readInputFiles([local, global], config.cwd);
}

export function getExternalFiles(dirpaths: string[], cwd: string): ExternalFile[] {
    return dirpaths
        .map(dirpath => {
            return resolve(cwd, dirpath);
        })
        .filter(existsSync)
        .reduce(function (acc, dirPath) {
            return acc.concat(readdirSync(dirPath).map(filepath => {
                const resolved = join(dirPath, filepath);
                const parsed = parse(resolved);
                const output: ExternalFile = {
                    rawInput: filepath,
                    resolved,
                    relative: relative(cwd, resolved),
                    parsed,
                    errors: []
                };
                return output;
            }));
        }, []);
}

export function getPossibleTasksFromDirectories(dirpaths: string[], cwd: string): string[] {
    return getExternalFiles(dirpaths, cwd)
        .filter(x => supportedTaskFileExtensions.indexOf(x.parsed.ext) > -1)
        .map(x => {
            return x.relative;
        });
}

export interface IHashItem {
    userInput: string;
    resolved: string;
    hash: string;
    changed: boolean;
}
export interface IHashInput {
    userInput: string;
    pathObj: ExternalFile;
}

export interface IHashResults {
    output: IHashItem[];
    markedHashes: IHashItem[];
}

export enum HashDirErrorTypes  {
    HashNotADirectory = <any>"HashNotADirectory",
    HashPathNotFound = <any>"HashPathNotFound"
}

export interface HashDirError extends Error {
    code: string;
    path: string;
    syscall: string;
}

export function hashItems(dirs: string[], cwd: string, existingHashes: IHashItem[]): Rx.Observable<IHashResults> {
    return Rx.Observable
        .from(dirs)
        .map((x): IHashInput => {
            return {
                userInput: x,
                pathObj: getStubFile(x, cwd)
            };
        })
        .distinct(x => x.pathObj.resolved)
        .flatMap(hashFileOrDir)
        .toArray()
        .map((x: IHashItem[]) => {
            return markHashes(x, existingHashes);
        });
}

function hashFile(filepath: string, fn: any) {
    const hash = createHash("sha256");
    createReadStream(filepath)
        .on("data", function (chunk) {
            hash.update(chunk);
        })
        .on("end", function () {
            fn(null, hash.digest("hex"));
        })
        .on("error", fn);
}

function hashFileOrDir(input: IHashInput) {
    return lstatAsObservable(input.pathObj.resolved).flatMap(function (stats: Stats) {
        if (stats.isDirectory()) {
            return hashDirAsObservable(input.pathObj.resolved).map((tree: {hash: string}) => {
                return {
                    userInput: input.userInput,
                    resolved: input.pathObj.resolved,
                    hash: tree.hash
                };
            });
        }
        if (stats.isFile()) {
            return hashFileAsObservable(input.pathObj.resolved).map((hash: string) => {
                return {
                    userInput: input.userInput,
                    resolved: input.pathObj.resolved,
                    hash
                };
            });
        }
        return Rx.Observable.empty();
    });
}

function markHashes(newHashes: IHashItem[], existingHashes: IHashItem[]): IHashResults {

    const newHashPaths = newHashes.map(x => x.resolved);
    const markedHashes = newHashes.map(function (newHash) {
        const match = existingHashes.filter(x => x.resolved === newHash.resolved);
        newHash.changed = (function () {
            if (match.length) {
                return match[0].hash !== newHash.hash;
            }
            return true; // return true by default so that new entries always run
        })();
        return newHash;
    });

    const otherHashes = existingHashes.filter(function (hash) {
        return newHashPaths.indexOf(hash.resolved) === -1;
    });

    const output = [...otherHashes, ...newHashes].filter(Boolean);

    return {
        output,
        markedHashes
    };
}

/**
 * Thanks to https://github.com/motdotla/dotenv
 * @param src
 * @returns {{}}
 */
export function parseEnv (src: string): {[index: string]: string} {
    const obj = {}

    // convert Buffers before splitting into lines and processing
    src.toString().split('\n').forEach(function (line) {
        // matching "KEY' and 'VAL' in 'KEY=VAL'
        const keyValueArr = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
        // matched?
        if (keyValueArr != null) {
            const key = keyValueArr[1];

            // default undefined or missing values to empty string
            let value = keyValueArr[2] ? keyValueArr[2] : '';

            // expand newlines in quoted values
            let len = value ? value.length : 0;
            if (len > 0 && value.charAt(0) === '"' && value.charAt(len - 1) === '"') {
                value = value.replace(/\\n/gm, '\n');
            }

            // remove any surrounding quotes and extra spaces
            value = value.replace(/(^['"]|['"]$)/g, '').trim();

            obj[key] = value;
        }
    });

    return obj
}



export const Right = (x) => ({
    chain: f => f(x),
    map: f => Right(f(x)),
    fold: (f, g) => g(x),
    inspect: () => `Right(${x})`
});

export const Left = (x) => ({
    chain: f => Left(x),
    map: f => Left(x),
    fold: (f, g) => f(x),
    inspect: () => `Left(${x})`
});

export const tryCatch = f => {
    try {
        return Right(f())
    } catch(e) {
        return Left(e)
    }
};
