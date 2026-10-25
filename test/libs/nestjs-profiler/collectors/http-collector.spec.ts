import { HttpCollector } from '../../../../libs/nestjs-profiler/src/collectors/http-collector';

describe('HttpCollector fetch support', () => {
  const originalFetch = globalThis.fetch;
  let addHttpCall: jest.Mock;
  let collector: HttpCollector;

  beforeEach(() => {
    addHttpCall = jest.fn();
    collector = new HttpCollector(
      { getCurrentProfile: () => ({}), addHttpCall } as any,
      { collectHttp: true },
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('captures native fetch responses used by @nestjs/http-client', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    (collector as any).patchFetch();

    const response = await fetch('https://api.example.com/users?page=2', {
      method: 'POST',
      headers: { authorization: 'secret', 'x-client': 'nestjs' },
    });

    expect(response.status).toBe(201);
    expect(addHttpCall).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'https://api.example.com/users?page=2',
        host: 'api.example.com',
        path: '/users?page=2',
        protocol: 'https',
        statusCode: 201,
        requestHeaders: {
          authorization: '[redacted]',
          'x-client': 'nestjs',
        },
        responseHeaders: { 'content-type': 'application/json' },
      }),
    );
  });

  it('captures fetch failures and preserves the rejection', async () => {
    const networkError = new Error('connection failed');
    globalThis.fetch = jest.fn().mockRejectedValue(networkError);
    (collector as any).patchFetch();

    await expect(fetch('http://api.example.com/users')).rejects.toBe(
      networkError,
    );
    expect(addHttpCall).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://api.example.com/users',
        error: 'connection failed',
      }),
    );
  });

  it('passes through without recording when no request profile is active', async () => {
    const response = new Response('ok');
    const fetchMock = jest.fn().mockResolvedValue(response);
    globalThis.fetch = fetchMock;
    collector = new HttpCollector(
      { getCurrentProfile: () => undefined, addHttpCall } as any,
      { collectHttp: true },
    );
    (collector as any).patchFetch();

    await expect(fetch('https://api.example.com/users')).resolves.toBe(
      response,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(addHttpCall).not.toHaveBeenCalled();
  });

  it('skips internal profiler requests', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response('ok'));
    globalThis.fetch = fetchMock;
    (collector as any).patchFetch();

    await fetch('https://api.example.com/users', {
      headers: { 'x-profiler-internal': '1' },
    });
    await fetch('https://api.example.com/__profiler/events');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(addHttpCall).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid URL', '/api', undefined],
    [
      'invalid headers',
      'https://api.example.com',
      { headers: { 'bad header': 'value' } },
    ],
  ])('preserves the native fetch error for %s', async (_case, input, init) => {
    const nativeError = new TypeError('native fetch error');
    const fetchMock = jest.fn().mockRejectedValue(nativeError);
    globalThis.fetch = fetchMock;
    (collector as any).patchFetch();

    await expect(fetch(input, init)).rejects.toBe(nativeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(addHttpCall).not.toHaveBeenCalled();
  });

  it('does not let storage errors break a successful response', async () => {
    const response = new Response('ok', { status: 200 });
    globalThis.fetch = jest.fn().mockResolvedValue(response);
    addHttpCall.mockImplementation(() => {
      throw new Error('storage exploded');
    });
    (collector as any).patchFetch();

    await expect(fetch('https://api.example.com/users')).resolves.toBe(
      response,
    );
  });

  it('does not replace a network error when storage also fails', async () => {
    const networkError = new Error('connection failed');
    globalThis.fetch = jest.fn().mockRejectedValue(networkError);
    addHttpCall.mockImplementation(() => {
      throw new Error('storage exploded');
    });
    (collector as any).patchFetch();

    await expect(fetch('https://api.example.com/users')).rejects.toBe(
      networkError,
    );
  });
});
