import {zone} from './operate'

declare const process: any

const Bound = Symbol()
const BlockingModules = ['fs', 'spawn_sync']

// Bind internal modules
if ('binding' in process) {
  let binding = process.binding

  process.binding = (id: string) => {
    let module = binding.call(process)
    if (module[Bound]) return module
    module[Bound] = true

    for (let symbol in module) {
      let func = module[symbol]
      if (typeof func !== 'function') continue

      let binding = module[symbol] = function (...args) {
        if (!(this instanceof binding)) {
          // Current call invokes an internal function
          if (zone.blocking === false && BlockingModules.indexOf(id) !== -1) {
            let req = args[args.length - 1]
            if (typeof req !== 'function' || req.oncomplete) {
              // Function was called with no request handler so it would be executed synchronously
              throw new Error(`No permission to execute the synchronous system operation ${id}.${symbol}`)
            }
          }
          return func.apply(this, args)
        }

        // Proxy object construction
        let object = new func(...args)
        let cancelled = false

        setImmediate(() => {
          let oncomplete = object.oncomplete

          if (oncomplete) {
            // Current object is a request handler
            zone.add(func, null, () => cancelled = true)
            object.oncomplete = function (...args) { if (!cancelled) oncomplete.apply(object, args) }
          }
        })
        return object
      }
    }
  }
}
