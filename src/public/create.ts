import {CommandTrigger} from "../command.run";
import {CBWatchOptions} from "../watch.resolve";
import {CrossbowConfiguration} from "../config";
import {getRawOutputStream} from "../watch.file-watcher";
import {defaultWatchOptions} from "../watch.resolve";
import watchCommand from '../command.watch';
import {CLI} from "../index";
import {isPlainObject} from "../task.utils";
const merge = require('../../lodash.custom').merge;
import {WatchEvent} from '../watch.file-watcher';

type returnFn = (opts: {}, trigger: CommandTrigger) => any;

let fncount            = 0;
let inlineWatcherCount = 0;

function incomingTask (taskname: string, inlineLiteral: {}): {}
function incomingTask (taskname: string, inlineLiteral: {}, fn?: returnFn): {}
function incomingTask (taskname: string, fn: returnFn): {}
function incomingTask (taskname: string, deps: string[], fn?: returnFn): {}
function incomingTask (taskname: string, deps: any, fn?:any): any {

    // only 2 params given (function last);
    if (typeof deps === 'function') {
        fn = deps;
        deps = [];
    }

    const outgoing = {};

    if (isPlainObject(deps) && deps.tasks) {
        if (deps.tasks) {
            outgoing[taskname] = deps;
        } else {
            throw new Error('Object literally must contain at least a "tasks" key');
        }
        if (fn) {
            const fnname = `${taskname}_internal_fn_${fncount++}`;
            outgoing[fnname] = fn;
            outgoing[taskname].tasks.push(fn);
        }
        return outgoing;
    }

    deps = [].concat(deps).filter(Boolean);

    if (deps.length) {
        if (!fn) {
            outgoing[taskname] = deps;
        } else {
            const fnname = `${taskname}_internal_fn_${fncount}`;
            outgoing[fnname] = fn;
            outgoing[taskname] = deps.concat(fnname);
        }
    } else {
        if (fn) {
            outgoing[taskname] = fn;
        }
    }
    return outgoing;
}

var input = {
    tasks: {},
    watch: {},
    options: {},
    env: {},
    config: <CrossbowConfiguration>{}, // to be set by lib
    cli: <CLI>{}, // to be set by lib
    reporter: ()=>{} // to be set by lib
};

function incomingOptions (taskname: string, hash?:any): {} {
    const outgoing = {};
    if (typeof taskname === 'string') {
        outgoing[taskname] = hash;
        return outgoing;
    }
    return taskname;
}

export const api = {
    input: input,
    env: function (obj: any) {
        input.env = merge(input.env, obj);
    },
    config: function (obj: any) {
        input.config = merge(input.config, obj);
    },
    task: function (taskname: string) {
        const res = incomingTask.apply(null, arguments);
        input.tasks = merge(input.tasks, res);
        return {
            options: function (hash: any) {
                const res = incomingOptions(taskname, hash);
                input.options = merge(input.options, res);
            }
        }
    },
    options: function (incoming: {}) {
        const res = incomingOptions.apply(null, arguments);
        input.options = merge(input.options, res);
    },
    watch: function (patterns: string[], tasks: string[], options?: CBWatchOptions) {
        const identifer = `_inline_watcher_${inlineWatcherCount++}`;
        patterns = [].concat(patterns);
        tasks = [].concat(tasks);
        input.watch[identifer] = {
            options: options,
            watchers: [
                {
                    patterns: patterns,
                    tasks: tasks
                }
            ]
        };
        const cliInput = ['watch', identifer];
        const output   = watchCommand({input: cliInput, flags:{}}, input, input.config, input.reporter);
        return output;
    },
    watcher: function (patterns: string[], options: CBWatchOptions) {
        const num = inlineWatcherCount++;
        const identifer = `_inline_watcher_${num}`;
        const watcher = {
            patterns: patterns,
            tasks: [],
            name: identifer,
            options: merge({}, defaultWatchOptions, options),
            watcherUID: num
        };
        return getRawOutputStream(watcher, input.reporter);
    }
};

export default input;
