const _ = require('../lodash.custom');

import {Task} from "./task.resolve.d";
import {CommandTrigger} from "./command.run";
import {TaskStats} from "./task.runner";

export enum SequenceItemTypes {
    SeriesGroup = <any>"SeriesGroup",
    ParallelGroup = <any>"ParallelGroup",
    Task = <any>"Task"
}

export interface SequenceItem {
    type: SequenceItemTypes
    taskName?: string
    task?: Task
    items: SequenceItem[]
    factory?: (opts: any, ctx: CommandTrigger, observer: Rx.Observer<any>) => any
    fnName?: string
    options?: any
    subTaskName?: string
    stats?: TaskStats
    seqUID: number
}

export interface SequenceSeriesGroup {
    taskName: string
    items: any[]
}

export interface SequenceParallelGroup extends SequenceSeriesGroup {
}

export interface SequenceTask {
    fnName: string,
    factory: TaskFactory,
    task: Task,
    options: any
}

export interface TaskFactory {
    (task: Task, trigger: CommandTrigger): any
    tasks?: TaskFactory[]
    name?: string
}
var seqUID = 0;
export function createSequenceTaskItem(incoming: SequenceTask): SequenceItem {
    return _.assign({type: SequenceItemTypes.Task, items: [], seqUID: seqUID++}, incoming);
}

export function createSequenceSeriesGroup(incoming: SequenceSeriesGroup): SequenceItem {
    return _.assign({type: SequenceItemTypes.SeriesGroup}, incoming);
}

export function createSequenceParallelGroup(incoming: SequenceParallelGroup): SequenceItem {
    return _.assign({type: SequenceItemTypes.ParallelGroup}, incoming);
}
