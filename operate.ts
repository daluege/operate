exports = operate

export declare var zone: Zone

const Timers: { set: string, clear: string, once: boolean }[] = [
  { set: 'setImmediate', clear: 'clearImmediate', once: true },
  { set: 'setInterval', clear: 'clearInterval', once: false },
  { set: 'setTimeout', clear: 'clearTimeout', once: true },
]

export interface ZoneOptions {
  blocking?: boolean
  callback?: (callback: Function) => any
}

export default function operate (callback: Function, options?: Zone, context?: any): PromiseLike<any> {
  let zone = new Zone(callback.name, options, context)
  setImmediate(() => zone.run(callback))
  return zone
}

export interface Task {
  type?
  id?
  cancel: () => void
}

export class Zone extends Promise<any> {
  static current: Zone = null

  value = undefined
  running = false
  blocking = true
  callback = (callback: Function) => callback()
  tasks = new Set<Task>()

  private types = new Map<any, Map<any, Task>>()
  private resolve: (global: any) => void
  private reject: (error: any) => void

  constructor (public id?: string, options?: ZoneOptions, public context: any = {}) {
    super((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })

    if (options != null) Object.assign(this, options)
  }

  add (type: any, id: any, cancel: () => void): Task {
    let task: Task = { type, id, cancel }
    this.tasks.add(task)
    if (id == null) return task

    let tasks = this.types.get(type)
    if (!tasks) this.types.set(type, (tasks = new Map()))
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

  cancel (): void {
    for (var task of this.tasks.values()) {
      try { task.cancel() }
      catch (error) { this.reject(error) }
    }
    this.tasks.clear()
    this.running = false
  }

  run (callback: Function, thisArg: any = null, ...args: any[]): any {
    if (arguments.length > 1) return this.run(() => callback.apply(thisArg, args))

    let globalZone = zone
    let currentZone = Zone.current
    try {
      zone = Zone.current = this
      this.running = true

      return this.callback(callback)
    } catch (error) {
      this.cancel()
      this.reject(error)
    } finally {
      zone = globalZone
      Zone.current = currentZone

      if (args.length) this.value = args[0]

      if (!this.tasks.size) {
        this.cancel()
        this.resolve(this.value)
      }
    }
  }
}

let globals: any = {}

for (let timer of Timers) {
  let set = global[timer.set]
  let clear = global[timer.clear]
  let type = set

  global[timer.set] = (callback: Function, ...args: any[]) => {
    let id = set(() => {
      if (timer.once) zone.delete(set, id)
      callback()
    }, ...args)

    let task = zone.add(type, id, () => global[timer.clear](id))
  }
  global[timer.clear] = (id: any) => {
    // Verify that the task is owned by the current zone
    if (!zone.has(type, id)) return

    clear(id)
    zone.delete(type, id)
  }
}
