/// <reference path="../typings/main.d.ts" />
import {isPlainObject} from './task.utils';
const merge     = require('lodash.merge');
const blacklist = ['options', 'bs-config', 'before'];

var watcherUID = 1;

import {WatchOptions} from "chokidar";
import {WatchTrigger} from "./command.watch";
import {preprocessWatchTask} from "./watch.preprocess";
import {gatherWatchTaskErrors} from "./watch.errors";
import {WatchTaskError, WatchTaskErrorTypes} from "./watch.errors";

export const reservedTaskNames = ['before', 'options', 'bs-config'];
export const defaultWatchOptions = <CBWatchOptions>{
    ignoreInitial: true,
    block: true,
    throttle: 0
};

export interface CBWatchOptions extends WatchOptions {
    throttle: number
    block: boolean
}

export interface WatchTask {
    before: string[]
    options: CBWatchOptions
    watchers: Watcher[]
    name: string
    errors: WatchTaskError[]
}

export interface Watcher {
    patterns: string[]
    tasks: string[]
    options: any
    watcherUID: any
}

/**
 * Create a single watch task item consisting of
 *  - patterns
 *  - tasks
 *  - options
 * @param {object} item
 * @param {object} itemOptions
 * @param {object} globalOptions
 * @returns {*}
 */
function createOne (item, itemOptions, globalOptions) : Watcher {
    if (isPlainObject(item)) {
        if (item.patterns && item.tasks) {
            return {
                patterns:   [].concat(item.patterns).reduce((a, x) => a.concat(x.split(':')), []),
                tasks:      [].concat(item.tasks),
                options:    merge({}, defaultWatchOptions, globalOptions, itemOptions),
                watcherUID: watcherUID++
            };
        }
        // todo: Add error handling for incorrect formats ie: user error
    }
    return item;
}

/**
 * @param watchTaskParent
 * @param globalOptions
 * @returns {*}
 */
function getFormattedTask (watchTaskParent: WatchTask, globalOptions: CBWatchOptions) : Watcher[] {
    /**
     * Look at each key provided to decide if it can
     * be transformed into a watcher obj
     */
    return Object.keys(watchTaskParent)
        /**
         * Exclude black listed keys that cannot be watcher
         * names such as `options` or `before`
         */
        .filter(x => blacklist.indexOf(x) === -1)
        .reduce((all: Watcher[], item: string) => {
            /**
             * Here we assume the long-hand version is being
             * used where the watchers property is provided.
             * If it is, that means we can create a watcher
             * object for each item in the 'watchers' array
             * eg:
             *
             * default:
             *   options:
             *     exclude: '*.html'
             *   before: ['bs']
             *   watchers:
             *     - patterns: ['test/fixtures']
             *       tasks:    ['1', '2']
             *     - patterns: ['*.css']
             *       tasks:    '3'
             */
            if (item === 'watchers') {

                /**
                 * If the `watcher` property is an Array, it must
                 * be an Array of Objects, so process each one individually.
                 * eg:
                 *  default:
                 *      watchers: [
                 *          {
                 *              patterns: ["scss/**", "css/*.scss"],
                 *              tasks:    ["$npm node-sass"],
                 *          }
                 *      ]
                 */
                if (Array.isArray(watchTaskParent.watchers)) {
                    return all.concat(
                        watchTaskParent.watchers.map(watcher => {
                            return createOne(watcher, watchTaskParent.options, globalOptions);
                        })
                    );
                }

                /**
                 * If the `watchers` property is a plain object,
                 * use it's keys as watch patterns and the values as
                 * tasks.
                 * eg:
                 *  default:
                 *      watchers: {
                 *          "*.js":   ["$npm eslint"],
                 *          "*.scss": ["$npm node-sass"]
                 *      }
                 */
                if (isPlainObject(watchTaskParent.watchers)) {
                    return Object.keys(watchTaskParent.watchers)
                        .map(key => createOne({
                            patterns: key,
                            tasks: watchTaskParent.watchers[key]
                        }, watchTaskParent.options, globalOptions));
                }
            }

            /**
             * At this point assume that the short-hard pattern <pattern>:<tasks>
             *  eg:
             *      "*.js": ['uglify']
             */
            return all.concat(createOne({
                patterns: item,        // key as the pattern
                tasks: watchTaskParent[item] // value as the tasks array
            }, watchTaskParent.options, globalOptions));
        }, []);
}

function createFlattenedWatchTask (taskName: string, trigger: WatchTrigger): WatchTask {

    const incoming  = preprocessWatchTask(taskName);
    const selection = trigger.input.watch[incoming.taskName] || {};
    const watchers  = getFormattedTask(selection, trigger.input.watch.options || {});

    const errors    = gatherWatchTaskErrors(
        incoming,
        trigger.input
    );

    return {
        name:     taskName,
        before:   selection.before   || [],
        options:  selection.options || {},
        watchers: watchers,
        errors:   errors
    }
}

export interface WatchTasks {
    valid: WatchTask[]
    invalid: WatchTask[],
    all: WatchTask[]
}

function validateTask (task:WatchTask, trigger: WatchTrigger): boolean {
    return task.errors.length === 0;
}

export function resolveWatchTasks (taskNames: string[], trigger: WatchTrigger): WatchTasks {

    const taskList = taskNames
        .map(taskName => {
            return createFlattenedWatchTask(taskName, trigger);
        });

    /**
     * Return both valid & invalid tasks. We want to let consumers
     * handle errors/successes
     * @type {{valid: Array, invalid: Array}}
     */
    const output = {
        valid: taskList.filter(x => validateTask(x, trigger)),
        invalid: taskList.filter(x => !validateTask(x, trigger)),
        all: taskList
    };

    return output;
}