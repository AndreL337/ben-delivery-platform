// Polyfill Node 20.19+ APIs (globalThis.CustomEvent, node:util.styleText, node:util.parseEnv) for Node 18 compatibility
const { register } = require('node:module')
const { pathToFileURL } = require('node:url')

if (typeof globalThis.CustomEvent === 'undefined') {
  class CustomEvent extends Event {
    constructor(type, eventInitDict = {}) {
      super(type, eventInitDict)
      this.detail = eventInitDict.detail ?? null
    }
  }
  globalThis.CustomEvent = CustomEvent
}

if (typeof register === 'function') {
  register('./esm-loader.mjs', pathToFileURL(__filename))
}
