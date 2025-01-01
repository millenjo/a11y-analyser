import { AsyncResource } from 'node:async_hooks'
import { EventEmitter } from 'node:events'
import { Worker } from 'node:worker_threads'
import type { AnalyzeMessageTask, AnalyzeResult } from './analyze-page.ts'

type TaskCallback = (
  err: Error | undefined | null,
  result: AnalyzeResult | null | undefined
) => void

const kTaskInfo = Symbol('kTaskInfo')
const kWorkerFreedEvent = Symbol('kWorkerFreedEvent')

class WorkerPoolTaskInfo extends AsyncResource {
  callback: TaskCallback
  task: AnalyzeMessageTask
  runInAsyncScope: AsyncResource['runInAsyncScope']
  emitDestroy: AsyncResource['emitDestroy']

  constructor(task: AnalyzeMessageTask, callback: TaskCallback) {
    super('WorkerPoolTaskInfo')
    this.task = task
    this.callback = callback
    this.runInAsyncScope = AsyncResource.prototype.runInAsyncScope
    this.emitDestroy = AsyncResource.prototype.emitDestroy
  }

  done(err: string | undefined | null, result: AnalyzeResult) {
    this.runInAsyncScope(this.callback, null, err, result)
    this.emitDestroy() // `TaskInfo`s are used only once.
  }
}

export default class PageAnalyzerWorkerPool extends EventEmitter {
  numThreads: number
  workers: Worker[]
  freeWorkers: Worker[]
  tasks: { task: AnalyzeMessageTask; callback: TaskCallback }[] = []
  on: EventEmitter['on']
  emit: EventEmitter['emit']

  constructor(numThreads: number) {
    super()
    this.numThreads = numThreads
    this.workers = []
    this.freeWorkers = []
    this.tasks = []

    this.emit = EventEmitter.prototype.emit
    this.on = EventEmitter.prototype.on
    for (let i = 0; i < numThreads; i++) this.addNewWorker()

    // Any time the kWorkerFreedEvent is emitted, dispatch
    // the next task pending in the queue, if any.
    this.on(kWorkerFreedEvent, () => {
      if (this.tasks.length > 0) {
        const taskItem = this.tasks.shift()
        if (taskItem) this.runTask(taskItem.task, taskItem.callback)
      }
    })
  }

  workerDone(worker: Worker, err: string | undefined | null) {
    if (!err) {
      this.freeWorkers.push(worker)
      this.emit(kWorkerFreedEvent)
    } else {
      this.workers.splice(this.workers.indexOf(worker), 1)
      this.addNewWorker()
    }
  }

  addNewWorker() {
    const worker = new Worker(new URL('./analyze-page.ts', import.meta.url), {
      name: `worker-${this.workers.length}`,
    })

    worker.on('message', (result: AnalyzeResult) => {
      worker[kTaskInfo].done(null, result)
      worker[kTaskInfo] = null
      this.workerDone(worker, null)
    })

    worker.on('error', (err: Error) => {
      if (worker[kTaskInfo]) worker[kTaskInfo].done(err, null)
      else this.emit('error', err)
      // Remove the worker from the list and start a new Worker to replace the
      // current one.
      this.workerDone(worker, err.message)
    })

    this.workers.push(worker)
    this.freeWorkers.push(worker)
    this.emit(kWorkerFreedEvent)
  }

  runTask(task: AnalyzeMessageTask, callback: TaskCallback) {
    if (this.freeWorkers.length === 0) {
      // No free threads, wait until a worker thread becomes free.
      this.tasks.push({ task, callback })
      return
    }

    const worker = this.freeWorkers.pop()
    worker[kTaskInfo] = new WorkerPoolTaskInfo(task, callback)
    worker.postMessage(task)
  }

  close() {
    for (const worker of this.workers) worker.terminate()
  }
}
