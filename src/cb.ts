#!/usr/bin/env node
import {RunComplete} from "./command.run.execute";
import {TasksCommandComplete} from "./command.tasks";
import cli from "./cli";
import handleIncoming from "./index";
import logger from "./logger";
import Rx = require('rx');
import * as reports from "./reporter.resolve";

const parsed = cli(process.argv.slice(2));

const cliOutputObserver = new Rx.Subject<reports.OutgoingReport>();
cliOutputObserver.subscribe(function (report) {
    report.data.forEach(function (x) {
        logger.info(x);
    });
});

if (parsed.execute) {

    if (parsed.cli.command === 'run') {
        handleIncoming<RunComplete>(parsed.cli, null, cliOutputObserver)
            .subscribe(require('./command.run.post-execution').postCliExecution);
    }

    if (parsed.cli.command === 'tasks' || parsed.cli.command === 'ls') {
        const out = handleIncoming<TasksCommandComplete>(parsed.cli, null, cliOutputObserver);
        if (out && out.subscribe && typeof out.subscribe === 'function') {
            out.subscribe();
        }
    }
}