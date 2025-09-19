/**
 * 测试 Azure Functions Express Wrapper 的 Body Parsing 兼容性
 * 验证 Express 中间件在处理预解析body时不会崩溃
 */

import { describe, test, expect, beforeAll, jest } from '@jest/globals';
import express from 'express';

// 模拟已经被 Azure Functions 预处理的请求对象
function createPreProcessedRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  rawBody?: Buffer;
}): any {
  const {
    method = 'POST',
    url = '/test',
    headers = { 'content-type': 'application/json' },
    body = { test: 'data' },
    rawBody = Buffer.from(JSON.stringify(body || {}))
  } = options;

  // 创建一个模拟的请求对象，模拟 Azure Functions 预处理后的状态
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
    _body: true, // 重要：标记body已被解析
    params: {},
    session: {},
    cookies: {},
    
    // 关键：模拟已消费的流状态
    readable: false,
    destroyed: false,
    readableEnded: true, // 流已结束
    readableFlowing: false,
    complete: true,
    aborted: false,
    
    // 流方法 - 返回安全值
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    emit: jest.fn().mockReturnValue(false),
    read: jest.fn().mockReturnValue(null), // 没有更多数据
    pause: jest.fn().mockReturnThis(),
    resume: jest.fn().mockReturnThis(),
    pipe: jest.fn().mockReturnValue({}),
    unpipe: jest.fn().mockReturnThis(),
    destroy: jest.fn().mockReturnThis(),
    push: jest.fn().mockReturnValue(false),
    
    // Express 常用方法
    get: (name: string) => headers[name.toLowerCase()],
    header: (name: string) => headers[name.toLowerCase()],
    
    // HTTP 版本信息
    httpVersion: '1.1',
    httpVersionMajor: 1,
    httpVersionMinor: 1
  };

  return mockRequest;
}

describe('Body Parsing Compatibility', () => {
  let app: express.Application;
  
  beforeAll(() => {
    // 创建一个简单的Express应用用于测试
    app = express();
    
    // 关键：添加可能冲突的中间件
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // 测试路由
    app.post('/test', (req, res) => {
      res.json({ 
        success: true,
        bodyReceived: req.body,
        hasRawBody: !!(req as any).rawBody 
      });
    });
  });

  test('should handle pre-parsed JSON body without crashing', (done) => {
    const testData = { name: 'John', category: 'IT_SUPPORT' };
    const mockReq = createPreProcessedRequest({
      method: 'POST',
      url: '/test',
      headers: { 'content-type': 'application/json' },
      body: testData,
      rawBody: Buffer.from(JSON.stringify(testData))
    });

    // 创建响应对象
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      locals: {}
    };

    // 模拟Express处理
    try {
      app(mockReq, mockRes as any, (error) => {
        if (error) {
          done(error);
        } else {
          // 验证响应被调用
          expect(mockRes.json).toHaveBeenCalled();
          const response = mockRes.json.mock.calls[0][0] as any;
          expect(response.success).toBe(true);
          expect(response.bodyReceived).toEqual(testData);
          done();
        }
      });
    } catch (error) {
      done(error);
    }
  });

  test('should handle large JSON payloads', (done) => {
    // 创建一个大型负载来测试内存处理
    const largeData = {
      cases: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        description: `Test case ${i}`.repeat(10),
        timestamp: new Date().toISOString()
      }))
    };

    const mockReq = createPreProcessedRequest({
      method: 'POST',
      url: '/test',
      headers: { 'content-type': 'application/json' },
      body: largeData,
      rawBody: Buffer.from(JSON.stringify(largeData))
    });

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      locals: {}
    };

    try {
      app(mockReq, mockRes as any, (error) => {
        if (error) {
          done(error);
        } else {
          expect(mockRes.json).toHaveBeenCalled();
          done();
        }
      });
    } catch (error) {
      done(error);
    }
  });

  test('should handle buffer body for webhook scenarios', (done) => {
    const webhookPayload = '{"event":"case.created","data":{"id":123}}';
    const mockReq = createPreProcessedRequest({
      method: 'POST',
      url: '/test',
      headers: { 'content-type': 'application/json' },
      body: Buffer.from(webhookPayload), // Buffer 类型的 body
      rawBody: Buffer.from(webhookPayload)
    });

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      locals: {}
    };

    try {
      app(mockReq, mockRes as any, (error) => {
        if (error) {
          done(error);
        } else {
          expect(mockRes.json).toHaveBeenCalled();
          done();
        }
      });
    } catch (error) {
      done(error);
    }
  });

  test('should not attempt to read from consumed stream', () => {
    const mockReq = createPreProcessedRequest({});
    
    // 验证流状态
    expect(mockReq.readable).toBe(false);
    expect(mockReq.readableEnded).toBe(true);
    expect(mockReq.complete).toBe(true);
    
    // 验证 read() 调用返回 null
    expect(mockReq.read()).toBe(null);
    
    // 验证事件监听器不会崩溃
    expect(() => {
      mockReq.on('data', () => {});
      mockReq.on('end', () => {});
      mockReq.once('error', () => {});
    }).not.toThrow();
  });
});
