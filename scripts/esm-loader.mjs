export async function resolve(specifier, context, nextResolve) {
  if (
    specifier === 'node:util' &&
    context.parentURL &&
    !context.parentURL.endsWith('util-shim.mjs')
  ) {
    return {
      shortCircuit: true,
      url: new URL('./util-shim.mjs', import.meta.url).href
    }
  }
  return nextResolve(specifier, context)
}
