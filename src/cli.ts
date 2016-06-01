const merge = require('../lodash.custom').merge;
const common = require('../opts/common.json');
const runcommon = require('../opts/run-common.json');
const pkg = require('../package.json');

export default function (cb) {
    var yargs  = require("yargs")
        .command("run", "Run a task(s)")
        .command("watch", "Run a watcher(s)")
        .command("tasks", "See your available top-level tasks")
        .command("watchers", "See your available watchers")
        .command("init", "Create a configuration file")
        .version(function () {
            return pkg.version;
        })
        .example("$0 run task1 task2", "Run 2 tasks in sequence")
        .example("$0 tasks", "List your available tasks")
        .epilogue("For help running a certain command, type <command> --help\neg: $0 run --help");

    var argv    = yargs.argv;
    var command = argv._[0];
    var valid   = ["run", "watch", "watchers", "tasks", "init"];

    if (valid.indexOf(command) > -1) {
        handleIncoming(command, yargs.reset(), cb);
    } else {
        yargs.showHelp();
    }
}

function handleIncoming(command, yargs, cb) {
    let out;
    if (command === "run") {
        out = yargs
            .usage("Usage: $0 run [tasknames..]")
            .options(merge({}, runcommon, common, require('../opts/command.run.opts.json')))
            .example("$0 run task1 task2 task3", "Run 3 tasks in sequence")
            .example("$0 run task1 task2 -p", "Run 2 tasks in parallel")
            .example("$0 run -i", "Run in interactive mode (aso you can select tasks")
            .example("$0 run some-task -c .cb.yaml", "Run 'some-task' as defined in a configuration file")
            .help()
            .argv;
    }
    if (command === "watch") {
        out = yargs
            .usage("Usage: $0 watch [watchers..]")
            .options(merge({}, runcommon, common, require('../opts/command.watch.opts.json')))
            .example("$0 watch default docker", "Run 2 watchers (default+docker)")
            .example("$0 watch", "Runs the 'default' watcher if available")
            .example("$0 watch -i", "Choose a watcher interactively")
            .example("$0 watch '*.js -> @npm webpack'", "Use the short hand watch syntax")
            .help()
            .argv;
    }
    if (command === "tasks") {
        out = yargs
            .usage("Usage: $0 tasks\nShows a list of top-level task names that can be run")
            .options(merge({}, common, require('../opts/command.tasks.opts.json')))
            .example("$0 tasks", "Shows tasks with minimal info")
            .example("$0 tasks -v", "Shows tasks with maximum info")
            .help()
            .argv;
    }
    if (command === "watchers") {
        out = yargs
            .usage("Usage: $0 tasks\nShows a list of top-level task names that can be run")
            .options(merge({}, common, require('../opts/command.tasks.opts.json')))
            .example("$0 watchers", "Show available Watchers")
            .example("$0 watchers -v", "Shows tasks with maximum info")
            .help()
            .argv;
    }
    if (command === "init") {
        out = yargs
            .usage("Usage: $0 init")
            .options(merge({}, common, require('../opts/command.init.opts.json')))
            .example("$0 init", "Creates the default crossbow.yaml file")
            .example("$0 init --type cbfile", "Create a 'cbfile.js'")
            .example("$0 init --type js", "Create a module.exports style config")
            .help()
            .argv;
    }
    cb({flags: stripUndefined(out), input: out._});
}

/**
 * Incoming undefined values are problematic as
 * they interfere with Immutable.Map.mergeDeep
 * @param subject
 * @returns {*}
 */
function stripUndefined (subject) {
    return Object.keys(subject).reduce(function (acc, key) {
        if (key === '_') {
            return acc;
        }
        var value = subject[key];
        if (typeof value === "undefined") {
            return acc;
        }
        acc[key] = value;
        return acc;
    }, {});
}
