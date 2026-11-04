import util from 'node:util'

export const {
  format,
  formatWithOptions,
  inspect,
  promisify,
  stripVTControlCharacters,
  types,
  TextEncoder,
  TextDecoder,
   callbackify,
  debuglog,
  deprecate,
   inherits,
  isDeepStrictEqual
} = util

export const styleText = typeof util.styleText === 'function'
  ? util.styleText
  : (_format, text) => String(text)

export const parseEnv = typeof util.parseEnv === 'function'
  ? util.parseEnv
  : (content) => {
      const result = {}
      for (const line of String(content).split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        result[key] = val
      }
      return result
    }

export default {
  ...util,
  styleText,
  parseEnv
}
