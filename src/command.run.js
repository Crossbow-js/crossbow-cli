var prom    = require('prom-seq');
var resolve = require('path').resolve;
var objPath = require('object-path');
var logger  = require('./logger');
var copy    = require('./command.copy');
var fs      = require('fs');
var Rx      = require('rx');
var exists  = Rx.Observable.fromNodeCallback(fs.exists);
var utils   = require('./utils');

module.exports = function (cli, input, trigger) {

    var cliInput   = cli.input.slice(1);
    var crossbow   = input.crossbow || {};
    crossbow.tasks = crossbow.tasks || {};
    var config     = trigger.config;
    var cb         = config.get('cb');

    if (!cliInput.length) {
        logger.error('Please provide a command for {magenta:Crossbow} to run');
        return;
    }

    if (!input.ctx.trigger.type) {
        input.ctx.trigger = trigger;
    }

    var taskResolver = require('./tasks')(crossbow, config);
    var tasks        = taskResolver.gather(cliInput);
    var sequence     = taskResolver.createRunSequence(tasks.valid);
    var success      = 0;
    var seq = sequence.reduce(function (all, seq) {
        return all.concat(seq.fns.map(function (fn) {
            return Rx.Observable.create(x => {
                success += 1;
                fn(x, seq.opts, input.ctx);
            });
        }));
    }, []);

    if (config.get('runMode') === 'sequence') {
        runInSequence(seq);
    } else {
        runInParallel(seq);
    }

    /**
     * Run each task only when the previous one
     * was completed
     * @param {Array} items - functions to call
     */
    function runInSequence(items) {

        var runner = Rx.Observable
            .fromArray(items)
            .concatAll();

        /**
         * Accept values sent through 'onNext'
         */
        runner
            .subscribe(
                x => {
                    console.log(x);
                },
                e => {
                    var currentTask = sequence[success-1].task.taskName;
                    logger.error('{red:ERROR in task {cyan:' +  currentTask);
                    console.error(e.stack.split('\n').map(x => logger.compile('{gray:'+currentTask+' -- }' + x)).join('\n'));
                    cb(e);
                },
                s => {
                    cb(null, {tasks, runSequence: seq, sequence: sequence});
                }
            );
    }

    /**
     * Run each function as quickly as possible
     * Don't wait for previous ones to complete
     * @param {Array} items - functions to call
     */
    function runInParallel(items) {

        Rx.Observable
            .forkJoin
            .apply(null, items)
            .subscribe(
                x => {
                    console.log(x);
                },
                e => cb(e),
                s => {
                    cb(null, {tasks, runSequence: seq, sequence: sequence});
                }
            );
    }





    //prom.create(sequence)('', input.ctx)
    //    .then(function () {
    //
    //        var topLevel = '{ok: } task {cyan:%s} completed';
    //        var subLevel = '{gray:--> %s';
    //
    //        logTasks(tasks.valid, topLevel);
    //
    //        function logTasks(tasks, template) {
    //            tasks.forEach(function (task) {
    //                logger.info(template, task.taskName);
    //                if (task.tasks.length) {
    //                    logTasks(task.tasks, subLevel);
    //                }
    //            });
    //        }
    //        cb(null, {tasks, sequence});
    //    })
    //    .progress(function (report) {
    //        if (Array.isArray(report.msg)) {
    //            logger[report.level].apply(logger, report.msg);
    //        } else {
    //            logger[report.level](report.msg);
    //        }
    //    })
    //    .catch(function (err) {
    //        throw err;
    //    }).done();
};