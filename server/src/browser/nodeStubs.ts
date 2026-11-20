/**
 * Stand-ins for `node:fs/promises` and `node:path` in the in-browser demo. Only LocalDiskStorage uses them, and the
 * browser build never constructs it (it uses BlobImageStorage), so these only need to exist.
 */
const unavailable = async () => {
  throw new Error('No file system in the browser demo')
}
export const mkdir = unavailable
export const writeFile = unavailable
export const unlink = unavailable
export const join = (...p: string[]) => p.join('/')
export const resolve = (...p: string[]) => p.join('/')
export const sep = '/'
export default { mkdir, writeFile, unlink, join, resolve, sep }
