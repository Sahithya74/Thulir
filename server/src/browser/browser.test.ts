import { createHash as nodeHash, randomBytes as nodeRandom } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { BrowserBuffer } from './buffer.js'
import { createHash, randomInt, timingSafeEqual } from './crypto.js'
import { Router, type ShimRequest, type ShimResponse } from './express.js'
import jwt from './jwt.js'

describe('browser stand-ins agree with Node', () => {
  it('sha256 matches node:crypto for many lengths, including block boundaries', () => {
    for (const n of [0, 1, 3, 55, 56, 63, 64, 65, 119, 120, 128, 1000]) {
      const data = nodeRandom(n)
      expect(createHash('sha256').update(new Uint8Array(data)).digest('hex'), `len ${n}`).toBe(nodeHash('sha256').update(data).digest('hex'))
    }
    expect(createHash('sha256').update('Thulir துளிர்').digest('hex')).toBe(nodeHash('sha256').update('Thulir துளிர்').digest('hex'))
  })

  it('hex / base64 / base64url / latin1 encodings match Buffer', () => {
    for (let n = 0; n < 40; n++) {
      const raw = nodeRandom(n)
      const b = BrowserBuffer.make(Array.from(raw))
      for (const enc of ['hex', 'base64', 'base64url', 'latin1'] as const) expect(b.toString(enc), `${enc} ${n}`).toBe(raw.toString(enc))
    }
    expect(BrowserBuffer.make('a1ff', 'hex').toString('hex')).toBe('a1ff')
    expect(BrowserBuffer.make('RIFF', 'latin1').equals(Buffer.from('RIFF', 'latin1'))).toBe(true)
  })

  it('randomInt stays in range; timingSafeEqual compares', () => {
    for (let i = 0; i < 500; i++) {
      const v = randomInt(1000, 10000)
      expect(v).toBeGreaterThanOrEqual(1000)
      expect(v).toBeLessThan(10000)
    }
    expect(timingSafeEqual(BrowserBuffer.make('abc'), BrowserBuffer.make('abc'))).toBe(true)
    expect(timingSafeEqual(BrowserBuffer.make('abc'), BrowserBuffer.make('abd'))).toBe(false)
  })

  it('session tokens verify, and tampered / foreign / expired ones do not', () => {
    const t = jwt.sign({ sub: 'u-1' }, 'secret-a', { expiresIn: '12h' })
    expect(jwt.verify(t, 'secret-a').sub).toBe('u-1')
    expect(() => jwt.verify(t, 'secret-b')).toThrow()
    const [h, , s] = t.split('.')
    const forged = `${h}.${BrowserBuffer.make(JSON.stringify({ sub: 'u-admin' })).toString('base64url')}.${s}`
    expect(() => jwt.verify(forged, 'secret-a')).toThrow()
    expect(() => jwt.verify(jwt.sign({ sub: 'x' }, 'k', { expiresIn: -10 }), 'k')).toThrow()
  })
})

describe('router stand-in behaves like Express for the patterns the API uses', () => {
  const req = (method: string, path: string): ShimRequest => ({ method, path, url: path, query: {}, params: {}, body: undefined, headers: {}, cookies: {}, ip: 'x', header: () => undefined, get: () => undefined })
  const res = (): ShimResponse => {
    const r: ShimResponse = {
      statusCode: 200, locals: {}, headers: {}, body: undefined, finished: false,
      status: (c) => ((r.statusCode = c), r),
      json: (b) => ((r.body = b), (r.finished = true), r),
      setHeader: () => r, cookie: () => r, clearCookie: () => r,
    }
    return r
  }
  const run = async (root: ReturnType<typeof Router>, method: string, path: string) => {
    const q = req(method, path)
    const s = res()
    const handled = await root.__handle(q, s, path.split('/').filter(Boolean), {})
    return { handled, body: s.body, status: s.statusCode }
  }

  it('matches params, merges parent params, falls through, and runs middleware only under its prefix', async () => {
    const inner = Router({ mergeParams: true })
    inner.get('/items/:pid', (q, s) => void s.json({ store: q.params.storeId, pid: q.params.pid }))
    const owner = Router()
    owner.use((q: ShimRequest, _s: ShimResponse, next: () => void) => ((q.headers.seen = 'yes'), next()))
    owner.use('/stores/:storeId', inner)
    const stores = Router()
    stores.get('/:id', async (q, s) => void s.json({ id: q.params.id }))
    const catalog = Router()
    catalog.get('/stores/:id/catalog', (q, s) => void s.json({ catalog: q.params.id }))
    const root = Router()
    root.use('/stores', stores)
    root.use(catalog)
    root.use('/owner', owner)

    expect((await run(root, 'GET', '/stores/s1')).body).toEqual({ id: 's1' })
    expect((await run(root, 'GET', '/stores/s1/catalog')).body).toEqual({ catalog: 's1' })
    expect((await run(root, 'GET', '/owner/stores/s9/items/p%2F1')).body).toEqual({ store: 's9', pid: 'p/1' })
    expect((await run(root, 'POST', '/stores/s1')).handled).toBe(false)
    expect((await run(root, 'GET', '/nowhere')).handled).toBe(false)
  })

  it('passes thrown and rejected errors up, and stops at the first answer', async () => {
    const r = Router()
    r.get('/sync', () => {
      throw new Error('boom')
    })
    r.get('/async', async () => {
      throw new Error('later')
    })
    r.get('/next-err', (_q, _s, next) => next(new Error('via next')))
    r.get('/twice', (_q, s) => void s.json({ n: 1 }))
    r.get('/twice', (_q, s) => void s.json({ n: 2 }))
    await expect(run(r, 'GET', '/sync')).rejects.toThrow('boom')
    await expect(run(r, 'GET', '/async')).rejects.toThrow('later')
    await expect(run(r, 'GET', '/next-err')).rejects.toThrow('via next')
    expect((await run(r, 'GET', '/twice')).body).toEqual({ n: 1 })
  })
})
