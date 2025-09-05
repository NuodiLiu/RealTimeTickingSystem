import { beforeEach, afterEach, afterAll } from '@jest/globals';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

let consoleErrorSpy: jest.SpyInstance;

beforeEach(() => {
  // Mock console.error globally for unit tests
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console.error after each test
  consoleErrorSpy.mockRestore();
});

afterAll(async () => {});
