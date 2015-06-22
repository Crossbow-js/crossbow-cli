var exists  = require('fs').existsSync;
var resolve    = require('path').resolve;
var _cli = require('./command.run.js');
var logger  = require('./logger');

/**
 * @param cli
 * @param opts
 */
function runWatcher (cli, opts) {

    var crossbow = opts.pkg.crossbow;
    var bs = require('./browserSync')(crossbow, opts);

    logger.debug('Start Browsersync with %', config);

    /**
     * Local Server from app root
     */
    bs.init(config);

    if (!tasks.length) {
        return;
    }

    //opts.pkg.crossbow.watch.tasks.forEach(function (item) {
    //
    //    Object.keys(item).forEach(function (key) {
    //
    //        if (typeof item[key] === "string") {
    //
    //            var match = item[key].match(/^bs:(.+?)$/);
    //
    //            if (typeof bs[match[1]] === "function") {
    //
    //                logger.info('watching {yellow:%s} -> {cyan:%s}', key, bs[match[1]]);
    //                bs.watch(key, watchConfig, bs[match[1]]);
    //            }
    //
    //        } else { // array of tasks given
    //
    //            var locked       = false;
    //            var tasks        = item[key];
    //            var regularTasks = tasks[0];
    //            var bsTask;
    //
    //            if (tasks.length > 1) {
    //                regularTasks = tasks.slice(0, -1);
    //                bsTask       = tasks[tasks.length - 1];
    //            } else {
    //                regularTasks = [regularTasks];
    //            }
    //
    //            var bsMethod;
    //            var bsArgs;
    //
    //            if (bsTask && bsTask.match(/^bs:/)) {
    //                bsMethod = bsTask.split(":")[1];
    //                bsArgs   = bsTask.split(":").slice(2);
    //            }
    //
    //            var watchPatterns = getKey(key, opts);
    //
    //            logger.info('watching {yellow:%s} -> {cyan:%s}', watchPatterns, regularTasks);
    //
    //            bs.watch(watchPatterns, watchConfig, function (event, file) {
    //
    //                if (locked) {
    //                    return;
    //                }
    //
    //                locked = true;
    //                var start = new Date().getTime();
    //
    //                opts._ctx.trigger = {
    //                    type: 'watcher',
    //                    pattern: watchPatterns,
    //                    file: file,
    //                    event: event
    //                };
    //
    //                _cli({input: ['run'].concat(regularTasks)}, opts)
    //                    .then(function () {
    //                        logger.info('{yellow:%s} {cyan:::} %sms', regularTasks.join(' -> '), new Date().getTime() - start);
    //
    //                        if (typeof bs[bsMethod] === 'function') {
    //                            if (bsArgs.length) {
    //                                bs[bsMethod].apply(bs, bsArgs);
    //                            } else {
    //                                bs[bsMethod].apply(bs);
    //                            }
    //                        }
    //                        locked = false;
    //                    })
    //                    .progress(function (obj) {
    //                        logger[obj.level].apply(logger, obj.msg);
    //                    })
    //                    .catch(function (err) {
    //                        locked = false;
    //                        if (!err.crossbow_silent) {
    //                            console.log(err.message);
    //                            console.log(err.stack);
    //                        }
    //                        bs.notify(err.message);
    //                    }).done();
    //            })
    //        }
    //    });
    //});
}

module.exports = function (cli, opts) {

    var beforeTasks   = opts.pkg.crossbow.watch.before || [];
    opts.handoff = true;

    logger.info('running {cyan:%s} before watcher starts', beforeTasks);

    if (beforeTasks.length) {

        opts._ctx.trigger = {
            type:  'before',
            tasks: beforeTasks
        };
        _cli({input: ['run'].concat(beforeTasks)}, opts)
            .then(function () {
                logger.info('{ok: } {cyan:%s} completed', beforeTasks);
                runWatcher(cli, opts);
            }).catch(function (err) {
                console.log(err.message);
                console.log(err.stack);
            }).done();
    } else {
        runWatcher(cli, opts);
    }
};