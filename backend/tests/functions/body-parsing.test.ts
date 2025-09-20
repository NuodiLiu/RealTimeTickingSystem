/**
 * 测试 Azure Functions Express Wrapper 的 Body Parsing 兼容性
 * 验证 raw-body/express.json() 在读取"假请求流"时不会崩溃
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import express from 'express';
import { createExpressResponse } from '../../src/functions';

// Mock Azure Functions类型
interface MockHttpRequest {
  method: string;
  url: string;
  headers: Map<string, string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

interface MockInvocationContext {
  log: jest.Mock;
}

// 创建一个简单的测试Express应用，模拟真实的body parsing场景
function createTestExpressApp(): express.Application {
  const app = express();
  
  // 关键：添加 body parsing 中间件，这会尝试读取请求流
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // 测试路由
  app.post('/test-json', (req, res) => {
    res.json({ 
      receivedBody: req.body,
      bodyType: typeof req.body,
      rawBodyExists: !!(req as any).rawBody
    });
  });
  
  app.post('/test-webhook', express.raw({ type: 'application/json' }), (req, res) => {
    res.json({
      bodyIsBuffer: Buffer.isBuffer(req.body),
      bodyLength: req.body?.length || 0
    });
  });
  
  return app;
}试 Azure Functions Express Wrapper 的 Body Parsing 兼容性
 * 验证 raw-body/express.json() 在读取"假请求流"时不会崩溃
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import express from 'express';
import { httpTrigger, convertAzureRequestToExpress, createExpressResponse } from '../../src/functions';

// 模拟 Azure Functions 预解析的请求对象
function createMockRequestWithPreParsedBody(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[]>;
  body?: any;
  rawBody?: Buffer;
  _body?: boolean;
}) {
  const {
    method = 'POST',
    url = '/cases',
    headers = { 'content-type': 'application/json' },
    body = { test: 'data' },
    rawBody = Buffer.from(JSON.stringify(body || {})),
    _body = true
  } = options;

  // 模拟 Azure Functions 转换后的请求对象
  const mockRequest = {
    method,
    url,
    originalUrl: url,
    path: url,
    baseUrl: '',
    query: {},
    headers,
    body,
    rawBody,
    _body, // 标记 body 已预解析
    params: {},
    session: {},
    cookies: {},
    
    // 关键：模拟已消费的流属性
    readable: false,
    destroyed: false,
    readableEnded: true,
    readableFlowing: false,
    complete: true,
    aborted: false,
    
    // 流方法 - 返回安全值防止崩溃
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    emit: jest.fn().mockReturnValue(false),
    removeListener: jest.fn().mockReturnThis(),
    removeAllListeners: jest.fn().mockReturnThis(),
    pipe: jest.fn().mockReturnValue({}),
    unpipe: jest.fn().mockReturnThis(),
    read: jest.fn().mockReturnValue(null),
    setEncoding: jest.fn().mockReturnThis(),
    pause: jest.fn().mockReturnThis(),
    resume: jest.fn().mockReturnThis(),
    destroy: jest.fn().mockReturnThis(),
    push: jest.fn().mockReturnValue(false),
    unshift: jest.fn().mockReturnValue(undefined),
    
    // 辅助方法
    get: (name: string) => headers[name.toLowerCase()],
    header: (name: string) => headers[name.toLowerCase()],
    
    // HTTP 版本信息
    httpVersion: '1.1',
    httpVersionMajor: 1,
    httpVersionMinor: 1
  };

  return mockRequest;
}

describe('Azure Functions Body Parsing Compatibility', () => {
  let app: express.Application;
  
  beforeAll(() => {
    // 模拟 Azure Functions 环境
    process.env.FUNCTIONS_WORKER_RUNTIME = 'node';
    process.env.SESSION_KEYS = 'test-key1,test-key2';
    
    app = createExpressApp();
  });

  afterAll(() => {
    delete process.env.FUNCTIONS_WORKER_RUNTIME;
  });

  describe('Pre-parsed Body Handling', () => {
    test('should not attempt to re-parse pre-parsed JSON body', async () => {
      const testData = { name: 'John', category: 'IT_SUPPORT' };
      const mockReq = createMockRequestWithPreParsedBody({
        url: '/test-route',
        body: testData,
        _body: true
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis()
      };

      // 添加一个测试路由来验证 body 是否正确传递
      app.use('/test-route', (req: any, res: any) => {
        expect(req.body).toEqual(testData);
        expect(req._body).toBe(true);
        res.json({ success: true, receivedBody: req.body });
      });

      // 直接调用中间件栈而不是通过 HTTP
      return new Promise<void>((resolve, reject) => {
        app(mockReq as any, mockRes as any, (err: any) => {
          if (err) {
            reject(err);
          } else {
            // 验证响应被正确调用
            expect(mockRes.json).toHaveBeenCalled();
            resolve();
          }
        });
      });
    });

    test('should preserve rawBody for signature verification', async () => {
      const webhookData = { event: 'test', id: '123' };
      const rawBodyBuffer = Buffer.from(JSON.stringify(webhookData));
      
      const mockReq = createMockRequestWithPreParsedBody({
        url: '/webhook-test',
        headers: {
          'content-type': 'application/json',
          'x-signature': 'sha256=test-signature'
        },
        body: webhookData,
        rawBody: rawBodyBuffer,
        _body: true
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis()
      };

      // 添加 webhook 测试路由
      app.use('/webhook-test', (req: any, res: any) => {
        expect(req.body).toEqual(webhookData);
        expect(req.rawBody).toEqual(rawBodyBuffer);
        expect(Buffer.isBuffer(req.rawBody)).toBe(true);
        res.json({ verified: true });
      });

      return new Promise<void>((resolve, reject) => {
        app(mockReq as any, mockRes as any, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });

    test('should handle empty body gracefully', async () => {
      const mockReq = createMockRequestWithPreParsedBody({
        url: '/empty-body-test',
        body: null,
        rawBody: Buffer.alloc(0),
        _body: true
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis()
      };

      app.use('/empty-body-test', (req: any, res: any) => {
        expect(req.body).toBeNull();
        res.json({ success: true });
      });

      return new Promise<void>((resolve, reject) => {
        app(mockReq as any, mockRes as any, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  });

  describe('Stream Safety', () => {
    test('should not throw when stream methods are called', async () => {
      const mockReq = createMockRequestWithPreParsedBody({
        url: '/stream-test',
        body: { test: 'data' }
      });

      // 验证调用流方法不会抛出错误
      expect(() => {
        mockReq.read();
        mockReq.pipe({} as any);
        mockReq.pause();
        mockReq.resume();
        mockReq.on('data', () => {});
        mockReq.once('end', () => {});
      }).not.toThrow();
    });

    test('should indicate stream is consumed', async () => {
      const mockReq = createMockRequestWithPreParsedBody({
        url: '/consumed-test',
        body: { test: 'data' }
      });

      // 验证流状态指示已消费
      expect(mockReq.readable).toBe(false);
      expect(mockReq.readableEnded).toBe(true);
      expect(mockReq.complete).toBe(true);
      expect(mockReq.read()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed pre-parsed body', async () => {
      const mockReq = createMockRequestWithPreParsedBody({
        url: '/malformed-test',
        body: undefined, // 模拟解析失败的情况
        rawBody: Buffer.from('{"invalid": json}'),
        _body: false
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis()
      };

      app.use('/malformed-test', (req: any, res: any) => {
        // 应该能处理未解析的 body
        res.json({ success: true });
      });

      return new Promise<void>((resolve, reject) => {
        app(mockReq as any, mockRes as any, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  });
});
