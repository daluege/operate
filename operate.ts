module.exports = exports = operate

const Timers: { set: string, clear: string, once: boolean }[] = [
  { set: 'setImmediate', clear: 'clearImmediate', once: true },
  { set: 'setInterval', clear: 'clearInterval', once: false },
  { set: 'setTimeout', clear: 'clearTimeout', once: true },
]

export interface ZoneOptions {
  blocking?: boolean
  callback?: (callback: Function) => any
}

export default function operate (callback: () => void, context: any = {}, options?: Zone): PromiseLike<any> {
  let zone = new Zone(callback.name, options, context)
  setImmediate(() => zone.run(callback))
  return zone
}

export interface Task {
  type?
  id?
  cancel: () => void
}

export class Zone implements PromiseLike<any> {
  static current: Zone = null

  parent: Zone = null
  value = undefined
  running = false
  tasks = new Set<Task>()

  private types = new Map<any, Map<any, Task>>()
  private promise = new Promise<any>((resolve, reject) => (this.resolve = resolve, this.reject = reject))
  private resolve: (global: any) => void
  private reject: (error: any) => void

  constructor (public name?: string, public context: any = {}, private options: ZoneOptions = {}) {
    if (options != null) Object.assign(this, options)
  }

  static operate = operate

  callback = (callback: Function) => callback()

  fork (name?: string, options?: any) {
    return new Zone(name == null ? this.name : name, Object.create(this.context))
  }

  add (type: any, id: any, cancel: () => void): Task {
    let task: Task = { type, id, cancel }
    this.tasks.add(task)
    if (id == null) return task

    let tasks = this.types.get(type)
    if (!tasks) this.types.set(type, (tasks = new Map<any, Task>()))
    tasks.set(id, task)
    return task
  }

  get (type: any, id: any): Task {
    let tasks = this.types.get(type)
    if (tasks) return tasks.get(id)
  }

  has (type: any, id: any): boolean {
    let tasks = this.types.get(type)
    return tasks && tasks.has(id)
  }

  delete (type: any, id: any): boolean {
    let task = this.get(type, id)
    if (!task) return
    let tasks = this.types.get(type)
    if (tasks) tasks.delete(id)
    return this.tasks.delete(task)
  }

  then (resolve: (value: any) => any, reject: (reason: any) => any): Promise<any> {
    return this.promise.then(resolve, reject)
  }

  cancel (reason?: any): void {
    for (let task of this.tasks.values()) {
      try { task.cancel() }
      catch (error) { this.reject(error) }
    }
    this.tasks.clear()
    this.running = false
    if (reason != null) this.reject(reason)
    else this.resolve(this.value)
  }

  do (callback: () => any) {
    this.parent = Zone.current
    try {
      Zone.current = this
      this.running = true

      return this.callback(callback)
    } catch (error) {
      this.cancel(error)
    } finally {
      Zone.current = this.parent
      if (!this.tasks.size) this.cancel()
    }
  }

  run (callback: () => any, thisArg?: any, ...args: any[]): any {
    if (arguments.length > 1) return this.run(() => callback.apply(thisArg, args))

    this.value = this.do(callback)
    return this.value
  }
}

for (let timer of Timers) {
  let set = global[timer.set]
  let clear = global[timer.clear]
  let type = set

  global[timer.set] = (callback: () => void, ...args: any[]) => {
    let zone = Zone.current
    if (!zone) return set(callback, ...args)

    let id = set(
      () => {
        if (timer.once) zone.delete(set, id)
        zone.do(callback)
      },
      ...args)

    zone.add(type, id, () => global[timer.clear](id))
    return id
  }
  global[timer.clear] = (id: any) => {
    let zone = Zone.current
    if (!zone) return clear(id)

    // Verify that the task is owned by the current zone
    if (!zone.has(type, id)) return

    clear(id)

    zone.delete(type, id)
  }
}

const then = Promise.prototype.then

Promise.prototype.then = function (resolve, reject): any {
  let cancelled = false

  const zone = Zone.current
  if (zone == null) return then.apply(this, arguments)

  const execute = callback => {
    if (typeof callback === 'function') {
      return value => !cancelled && zone.tasks.delete(task) && zone.do(() => callback(value))
    }
  }
  const result = then.call(this, execute(resolve), execute(reject))
  const task = zone.add(Promise, null, () => (cancelled = true))

  return result
}
